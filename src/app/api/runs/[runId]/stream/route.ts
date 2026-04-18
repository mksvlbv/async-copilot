import { NextResponse } from "next/server";
import { streamText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageModel, isAIEnabled } from "@/lib/ai/client";
import { getStagePrompt } from "@/lib/ai/prompts";
import type { StageContext } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[runId]/stream
 *
 * Server-Sent Events endpoint that streams the full triage pipeline.
 * For each stage: emits stage-start, streams LLM tokens, then stage-done.
 * Clients see tokens appear character-by-character like ChatGPT.
 *
 * Falls back to non-streaming advance if AI is not enabled.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI streaming not available — GROQ_API_KEY not configured" },
      { status: 501 },
    );
  }

  const admin = createAdminClient();

  // Fetch run + case + stages
  const { data: run, error: runErr } = await admin
    .from("runs")
    .select("*, case:cases(*), stages:run_stages(*)")
    .eq("id", runId)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
    .maybeSingle();

  if (runErr || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.state === "completed" || run.state === "escalated" || run.state === "failed") {
    return NextResponse.json({ error: "Run already terminal", state: run.state }, { status: 409 });
  }

  const caseRow = run.case as Record<string, unknown>;
  const stages = (run.stages as Record<string, unknown>[]).sort(
    (a, b) => (a.stage_order as number) - (b.stage_order as number),
  );

  const stageCtx: StageContext = {
    title: (caseRow?.title as string) ?? "",
    body: (caseRow?.body as string) ?? "",
    customerName: (caseRow?.customer_name as string) ?? null,
    customerAccount: (caseRow?.customer_account as string) ?? null,
    customerPlan: (caseRow?.customer_plan as string) ?? null,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        // Mark run as running if pending
        if (run.state === "pending") {
          await admin
            .from("runs")
            .update({ state: "running", started_at: new Date().toISOString() })
            .eq("id", runId);
        }

        send("run-start", { runId, totalStages: stages.length });

        for (const stage of stages) {
          const stageOrder = stage.stage_order as number;
          const stageKey = stage.stage_key as string;
          const stageId = stage.id as string;
          const existingOutput = stage.output as Record<string, unknown> | null;

          // Skip already-completed stages
          if ((stage.state as string) === "completed") continue;

          const now = new Date().toISOString();
          send("stage-start", { stageKey, stageOrder, label: stage.stage_label });

          // Mark stage as running in DB
          await admin
            .from("run_stages")
            .update({ state: "running", started_at: now })
            .eq("id", stageId);

          let output: Record<string, unknown> = {};

          // Use pre-seeded output if available
          if (existingOutput && Object.keys(existingOutput).length > 0) {
            output = existingOutput;
            send("stage-token", { stageKey, token: JSON.stringify(output, null, 2) });
          } else {
            // Stream LLM output
            const prompt = getStagePrompt(stageKey);
            if (prompt) {
              let fullText = "";
              const result = streamText({
                model: triageModel,
                system: prompt.system,
                prompt: prompt.user(stageCtx),
                maxOutputTokens: 400,
                temperature: 0.3,
              });

              for await (const chunk of result.textStream) {
                fullText += chunk;
                send("stage-token", { stageKey, token: chunk });
              }

              // Parse the completed output
              const cleaned = fullText
                .replace(/^```(?:json)?\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
              try {
                output = JSON.parse(cleaned) as Record<string, unknown>;
              } catch {
                output = { raw_output: fullText, parse_error: true };
              }
            }
          }

          // Mark stage completed in DB
          const completedAt = new Date().toISOString();
          await admin
            .from("run_stages")
            .update({
              state: "completed",
              completed_at: completedAt,
              output,
            })
            .eq("id", stageId);

          // Update run cursor
          await admin
            .from("runs")
            .update({
              advance_cursor: stageOrder,
              last_advanced_at: completedAt,
            })
            .eq("id", runId);

          send("stage-done", { stageKey, stageOrder, output });
        }

        // Finalize run
        const { data: sample } = caseRow.sample_id
          ? await admin.from("samples").select("*").eq("id", caseRow.sample_id as string).single()
          : { data: null };

        const confidence = (sample as Record<string, unknown> | null)?.expected_confidence as number
          ?? baselineConfidence((caseRow?.body as string) ?? "");
        const urgency = (run.urgency as string) ?? (sample as Record<string, unknown> | null)?.urgency ?? "medium";
        const finalState = confidence < 70 ? "escalated" : "completed";
        const completedAt = new Date().toISOString();

        await admin
          .from("runs")
          .update({
            state: finalState,
            confidence,
            urgency,
            completed_at: completedAt,
            advance_cursor: stages.length,
            last_advanced_at: completedAt,
          })
          .eq("id", runId);

        // Build response pack
        const { data: existingPack } = await admin
          .from("response_packs")
          .select("id")
          .eq("run_id", runId)
          .maybeSingle();

        if (!existingPack) {
          const { buildFallbackResponsePack } = await import("@/lib/triage/run-model");
          const pack = buildFallbackResponsePack({
            run_id: runId,
            confidence,
            urgency: urgency as "low" | "medium" | "high",
            caseTitle: (caseRow?.title as string) ?? "Untitled case",
            customerName: (caseRow?.customer_name as string) ?? null,
          });
          await admin.from("response_packs").insert(pack);
        }

        send("run-done", { runId, state: finalState, confidence });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function baselineConfidence(body: string): number {
  const len = body.length;
  if (len < 80) return 45;
  if (len < 200) return 68;
  if (len < 500) return 82;
  return 88;
}
