import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFallbackResponsePack,
  finalStateFor,
  syntheticOutputFor,
} from "@/lib/triage/run-model";
import { triageModel, isAIEnabled } from "@/lib/ai/client";
import { getStagePrompt } from "@/lib/ai/prompts";
import type { StageContext } from "@/lib/ai/prompts";
import type { Sample } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[runId]/advance
 * Advances a run by one stage. Idempotent at the terminal state:
 * calling again on a completed/escalated run is a no-op.
 *
 * Progression:
 *   cursor 0 → set state=running, start stage 1 → complete stage 1, cursor=1
 *   cursor n<total → complete stage n+1, cursor=n+1
 *   cursor total → finalize run + build response pack, state=completed|escalated
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const admin = createAdminClient();

  // Fetch current run
  const { data: run, error: runErr } = await admin
    .from("runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (runErr || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Terminal: no-op
  if (run.state === "completed" || run.state === "escalated" || run.state === "failed") {
    return NextResponse.json({ run, advanced: false, terminal: true });
  }

  const now = new Date().toISOString();
  const nextCursor = run.advance_cursor + 1;

  // Fetch case (for fallback output generation)
  const { data: caseRow } = await admin
    .from("cases")
    .select("*")
    .eq("id", run.case_id)
    .single();

  let sample: Sample | null = null;
  if (caseRow?.sample_id) {
    const { data } = await admin
      .from("samples")
      .select("*")
      .eq("id", caseRow.sample_id)
      .single();
    sample = (data as Sample | null) ?? null;
  }

  // Fetch the next stage row
  const { data: stageRow, error: stageErr } = await admin
    .from("run_stages")
    .select("*")
    .eq("run_id", runId)
    .eq("stage_order", nextCursor)
    .single();
  if (stageErr || !stageRow) {
    return NextResponse.json(
      { error: `stage ${nextCursor} not found` },
      { status: 500 },
    );
  }

  // Output: prefer pre-seeded golden output (if completed stage has data),
  // else LLM inference via Groq, else synthetic (regex) fallback.
  let output: Record<string, unknown> = stageRow.output ?? {};
  let usedAI = false;
  if (!output || Object.keys(output).length === 0) {
    const stageCtx: StageContext = {
      title: caseRow?.title ?? "",
      body: caseRow?.body ?? "",
      customerName: caseRow?.customer_name ?? null,
      customerAccount: caseRow?.customer_account ?? null,
      customerPlan: caseRow?.customer_plan ?? null,
    };

    if (isAIEnabled()) {
      try {
        output = await generateStageOutput(stageRow.stage_key, stageCtx);
        usedAI = true;
      } catch (err) {
        console.warn(`[advance] LLM failed for stage ${stageRow.stage_key}, falling back to synthetic`, err);
        output = syntheticOutputFor(stageRow.stage_key, {
          caseTitle: stageCtx.title,
          caseBody: stageCtx.body,
        });
      }
    } else {
      output = syntheticOutputFor(stageRow.stage_key, {
        caseTitle: stageCtx.title,
        caseBody: stageCtx.body,
      });
    }
  }

  // Mark stage completed
  await admin
    .from("run_stages")
    .update({
      state: "completed",
      started_at: stageRow.started_at ?? now,
      completed_at: now,
      output,
    })
    .eq("id", stageRow.id);

  // Run-level update
  const isFirstAdvance = run.state === "pending";
  const isTerminal = nextCursor >= run.total_stages;

  const patch: Record<string, unknown> = {
    advance_cursor: nextCursor,
    last_advanced_at: now,
  };
  if (isFirstAdvance) {
    patch.state = "running";
    patch.started_at = now;
  }

  if (isTerminal) {
    // Compute confidence
    const confidence = sample?.expected_confidence ?? baselineConfidence(caseRow?.body ?? "");
    const urgency = run.urgency ?? sample?.urgency ?? "medium";
    const finalState = finalStateFor(confidence);

    patch.state = finalState;
    patch.confidence = confidence;
    patch.urgency = urgency;
    patch.completed_at = now;

    // Create response pack if none exists
    const { data: existingPack } = await admin
      .from("response_packs")
      .select("id")
      .eq("run_id", runId)
      .maybeSingle();

    if (!existingPack) {
      const pack = buildFallbackResponsePack({
        run_id: runId,
        confidence,
        urgency,
        caseTitle: caseRow?.title ?? "Untitled case",
        customerName: caseRow?.customer_name ?? null,
      });
      await admin.from("response_packs").insert(pack);
    }
  }

  const { data: updated, error: updErr } = await admin
    .from("runs")
    .update(patch)
    .eq("id", runId)
    .select()
    .single();
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    run: updated,
    advanced: true,
    terminal: isTerminal,
    stage_completed: stageRow.stage_key,
    ai: usedAI,
  });
}

/**
 * Call Groq LLM (Llama 3.3 70B) to generate stage output.
 * Returns parsed JSON object matching the stage's expected schema.
 */
async function generateStageOutput(
  stageKey: string,
  ctx: StageContext,
): Promise<Record<string, unknown>> {
  const prompt = getStagePrompt(stageKey);
  if (!prompt) return {};

  const { text } = await generateText({
    model: triageModel,
    system: prompt.system,
    prompt: prompt.user(ctx),
    maxOutputTokens: 400,
    temperature: 0.3,
  });

  // Parse JSON from LLM response — strip markdown fences if model wraps output
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // If JSON parse fails, return the raw text as a fallback field
    return { raw_output: text, parse_error: true };
  }
}

/** Quick deterministic baseline for intake (no sample). */
function baselineConfidence(body: string): number {
  // Shorter/vaguer bodies → lower confidence.
  const len = body.length;
  if (len < 80) return 45;
  if (len < 200) return 68;
  if (len < 500) return 82;
  return 88;
}
