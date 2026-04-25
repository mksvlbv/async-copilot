import type { User } from "@supabase/supabase-js";
import { generateText } from "ai";
import {
  TRIAGE_MODEL_ID,
  TRIAGE_PROVIDER,
  triageModel,
  isAIEnabled,
} from "@/lib/ai/client";
import {
  getStagePrompt,
  type StageContext,
  type StagePrompt,
} from "@/lib/ai/prompts";
import { appendRunEvent, userActorPayload } from "@/lib/runs/events";
import { retry } from "@/lib/retry";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Case,
  Run,
  RunStage,
  Sample,
  StageExecutionMode,
  StageFallbackReason,
  StageProvenance,
  UrgencyLevel,
} from "@/lib/supabase/types";
import {
  buildFallbackResponsePack,
  finalStateFor,
  syntheticOutputFor,
} from "@/lib/triage/run-model";

type AdminClient = ReturnType<typeof createAdminClient>;
type ExecutionUser = Pick<User, "id" | "email"> | null;
type StageGenerationResult = {
  output: Record<string, unknown>;
  provenance: StageProvenance | null;
};

export type ExecuteRunStepResult = {
  run: Run;
  advanced: boolean;
  terminal: boolean;
  yielded: boolean;
  ai: boolean;
  stageCompleted: string | null;
};

export function isRunTerminalState(state: Run["state"]) {
  return state === "completed" || state === "escalated" || state === "failed";
}

export function buildStageProvenance({
  prompt,
  executionMode,
  fallbackReason = null,
  parseError = false,
}: {
  prompt?: Pick<StagePrompt, "prompt_key" | "prompt_version">;
  executionMode: StageExecutionMode;
  fallbackReason?: StageFallbackReason | null;
  parseError?: boolean;
}): StageProvenance {
  return {
    prompt_key: prompt?.prompt_key ?? null,
    prompt_version: prompt?.prompt_version ?? null,
    provider: executionMode === "ai" ? TRIAGE_PROVIDER : null,
    model: executionMode === "ai" ? TRIAGE_MODEL_ID : null,
    execution_mode: executionMode,
    fallback_reason: fallbackReason,
    parse_error: parseError,
  };
}

export function stageProvenanceUsesAI(provenance: StageProvenance | null | undefined) {
  return provenance?.execution_mode === "ai";
}

function buildSyntheticStageOutput(
  stageKey: string,
  ctx: StageContext,
  prompt: StagePrompt | undefined,
  fallbackReason: StageFallbackReason,
): StageGenerationResult {
  return {
    output: syntheticOutputFor(stageKey, {
      caseTitle: ctx.title,
      caseBody: ctx.body,
    }),
    provenance: buildStageProvenance({
      prompt,
      executionMode: "synthetic",
      fallbackReason,
    }),
  };
}

export async function loadRunById(admin: AdminClient, runId: string) {
  const { data, error } = await admin
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) {
    return null as Run | null;
  }

  return data as Run;
}

export async function executeRunStep({
  admin,
  runId,
  user = null,
}: {
  admin: AdminClient;
  runId: string;
  user?: ExecutionUser;
}): Promise<ExecuteRunStepResult> {
  const loaded = await loadRunWithCase(admin, runId);
  if (!loaded) {
    throw new Error("Run not found");
  }

  let run = loaded.run;
  const caseRow = loaded.caseRow;
  if (isRunTerminalState(run.state)) {
    return {
      run,
      advanced: false,
      terminal: true,
      yielded: false,
      ai: false,
      stageCompleted: null,
    };
  }

  const sample = await loadSampleForCase(admin, caseRow.sample_id);
  const nextCursor = run.advance_cursor + 1;

  if (nextCursor > run.total_stages) {
    const finalized = await finalizeRun(admin, run, caseRow, sample);
    return {
      run: finalized,
      advanced: false,
      terminal: true,
      yielded: false,
      ai: false,
      stageCompleted: null,
    };
  }

  const stageRow = await loadStageByOrder(admin, runId, nextCursor);
  if (!stageRow) {
    throw new Error(`stage ${nextCursor} not found`);
  }

  run = await ensureRunStarted(admin, run, user, stageRow.started_at ?? new Date().toISOString());

  if (stageRow.state === "completed") {
    const recoveredRun = await recoverCompletedStage(admin, run, caseRow, sample, stageRow);
    return {
      run: recoveredRun,
      advanced: true,
      terminal: isRunTerminalState(recoveredRun.state),
      yielded: false,
      ai: false,
      stageCompleted: stageRow.stage_key,
    };
  }

  if (stageRow.state !== "pending") {
    const currentRun = (await loadRunById(admin, runId)) ?? run;
    return {
      run: currentRun,
      advanced: false,
      terminal: isRunTerminalState(currentRun.state),
      yielded: true,
      ai: false,
      stageCompleted: null,
    };
  }

  const stageStartedAt = stageRow.started_at ?? new Date().toISOString();
  const { data: claimedStage } = await admin
    .from("run_stages")
    .update({
      state: "running",
      started_at: stageStartedAt,
    })
    .eq("id", stageRow.id)
    .eq("state", "pending")
    .select("*")
    .maybeSingle();

  if (!claimedStage) {
    const currentRun = (await loadRunById(admin, runId)) ?? run;
    return {
      run: currentRun,
      advanced: false,
      terminal: isRunTerminalState(currentRun.state),
      yielded: true,
      ai: false,
      stageCompleted: null,
    };
  }

  if (!stageRow.started_at) {
    await appendRunEvent(admin, {
      workspace_id: run.workspace_id,
      case_id: run.case_id,
      run_id: run.id,
      event_type: "stage.started",
      actor_type: "system",
      stage_key: stageRow.stage_key,
      payload: {
        summary: `Started ${stageRow.stage_label}.`,
        stage_order: stageRow.stage_order,
        stage_label: stageRow.stage_label,
      },
      created_at: stageStartedAt,
    });
  }

  let output: Record<string, unknown> = stageRow.output ?? {};
  let usedAI = false;
  let provenance: StageProvenance | null = null;

  try {
    if (!output || Object.keys(output).length === 0) {
      const stageCtx: StageContext = {
        title: caseRow.title ?? "",
        body: caseRow.body ?? "",
        customerName: caseRow.customer_name ?? null,
        customerAccount: caseRow.customer_account ?? null,
        customerPlan: caseRow.customer_plan ?? null,
      };
      const prompt = getStagePrompt(stageRow.stage_key);

      if (isAIEnabled()) {
        const generated = await generateStageOutput(stageRow.stage_key, stageCtx, prompt);
        output = generated.output;
        provenance = generated.provenance;
        usedAI = stageProvenanceUsesAI(provenance);
      } else {
        const generated = buildSyntheticStageOutput(
          stageRow.stage_key,
          stageCtx,
          prompt,
          "ai_disabled",
        );
        output = generated.output;
        provenance = generated.provenance;
        usedAI = stageProvenanceUsesAI(provenance);
      }
    }
  } catch (error) {
    await admin
      .from("run_stages")
      .update({ state: "pending" })
      .eq("id", stageRow.id)
      .eq("state", "running");

    throw error;
  }

  const completedAt = new Date().toISOString();
  const { data: completedStage } = await admin
    .from("run_stages")
    .update({
      state: "completed",
      completed_at: completedAt,
      output,
    })
    .eq("id", stageRow.id)
    .eq("state", "running")
    .select("*")
    .maybeSingle();

  if (!completedStage) {
    const currentRun = (await loadRunById(admin, runId)) ?? run;
    return {
      run: currentRun,
      advanced: false,
      terminal: isRunTerminalState(currentRun.state),
      yielded: true,
      ai: usedAI,
      stageCompleted: null,
    };
  }

  await appendRunEvent(admin, {
    workspace_id: run.workspace_id,
    case_id: run.case_id,
    run_id: run.id,
    event_type: "stage.completed",
    actor_type: "system",
    stage_key: stageRow.stage_key,
    payload: {
      summary: `Completed ${stageRow.stage_label}.`,
      stage_order: stageRow.stage_order,
      stage_label: stageRow.stage_label,
      duration_ms: stageRow.duration_ms,
      ...(provenance ?? {}),
    },
    created_at: completedAt,
  });

  const advancedRun = await advanceRunCursor(admin, run, stageRow.stage_order, completedAt);
  if (stageRow.stage_order >= advancedRun.total_stages) {
    const finalized = await finalizeRun(admin, advancedRun, caseRow, sample, completedAt);
    return {
      run: finalized,
      advanced: true,
      terminal: true,
      yielded: false,
      ai: usedAI,
      stageCompleted: stageRow.stage_key,
    };
  }

  return {
    run: advancedRun,
    advanced: true,
    terminal: false,
    yielded: false,
    ai: usedAI,
    stageCompleted: stageRow.stage_key,
  };
}

export async function resetRunningStages(admin: AdminClient, runId: string) {
  await admin
    .from("run_stages")
    .update({ state: "pending" })
    .eq("run_id", runId)
    .eq("state", "running");
}

async function loadRunWithCase(admin: AdminClient, runId: string) {
  const { data, error } = await admin
    .from("runs")
    .select("*, case:cases(*)")
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) {
    return null as { run: Run; caseRow: Case } | null;
  }

  const caseRowRaw = Array.isArray(data.case) ? data.case[0] : data.case;
  if (!caseRowRaw) {
    throw new Error("Case not found for run");
  }

  return {
    run: data as Run,
    caseRow: caseRowRaw as Case,
  };
}

async function loadSampleForCase(admin: AdminClient, sampleId: string | null) {
  if (!sampleId) {
    return null as Sample | null;
  }

  const { data } = await admin.from("samples").select("*").eq("id", sampleId).single();
  return (data as Sample | null) ?? null;
}

async function loadStageByOrder(admin: AdminClient, runId: string, stageOrder: number) {
  const { data, error } = await admin
    .from("run_stages")
    .select("*")
    .eq("run_id", runId)
    .eq("stage_order", stageOrder)
    .maybeSingle();

  if (error || !data) {
    return null as RunStage | null;
  }

  return data as RunStage;
}

async function ensureRunStarted(
  admin: AdminClient,
  run: Run,
  user: ExecutionUser,
  startedAt: string,
) {
  if (run.state !== "pending") {
    return run;
  }

  const { data: startedRun } = await admin
    .from("runs")
    .update({
      state: "running",
      started_at: run.started_at ?? startedAt,
    })
    .eq("id", run.id)
    .eq("state", "pending")
    .select("*")
    .maybeSingle();

  if (startedRun) {
    await appendRunEvent(admin, {
      workspace_id: run.workspace_id,
      case_id: run.case_id,
      run_id: run.id,
      event_type: "run.started",
      actor_type: "system",
      payload: user
        ? userActorPayload(user as User, "Run execution started.", { state: "running" })
        : { summary: "Run execution started.", state: "running" },
      created_at: run.started_at ?? startedAt,
    });

    return startedRun as Run;
  }

  return (await loadRunById(admin, run.id)) ?? { ...run, state: "running", started_at: startedAt };
}

async function recoverCompletedStage(
  admin: AdminClient,
  run: Run,
  caseRow: Case,
  sample: Sample | null,
  stageRow: RunStage,
) {
  const recoveredAt = stageRow.completed_at ?? new Date().toISOString();
  const advancedRun = await advanceRunCursor(admin, run, stageRow.stage_order, recoveredAt);

  if (stageRow.stage_order >= advancedRun.total_stages) {
    return finalizeRun(admin, advancedRun, caseRow, sample, recoveredAt);
  }

  return advancedRun;
}

async function advanceRunCursor(
  admin: AdminClient,
  run: Run,
  stageOrder: number,
  completedAt: string,
) {
  const patch: Record<string, unknown> = {
    advance_cursor: Math.max(run.advance_cursor, stageOrder),
    last_advanced_at: completedAt,
  };

  if (run.state === "pending") {
    patch.state = "running";
    patch.started_at = run.started_at ?? completedAt;
  }

  const { data, error } = await admin
    .from("runs")
    .update(patch)
    .eq("id", run.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "failed to advance run cursor");
  }

  return data as Run;
}

async function finalizeRun(
  admin: AdminClient,
  run: Run,
  caseRow: Case,
  sample: Sample | null,
  completedAt = new Date().toISOString(),
) {
  const confidence = sample?.expected_confidence ?? baselineConfidence(caseRow.body ?? "");
  const urgency = (run.urgency ?? sample?.urgency ?? "medium") as UrgencyLevel;
  const finalState = finalStateFor(confidence);

  const { data: updated, error: updateError } = await admin
    .from("runs")
    .update({
      state: finalState,
      confidence,
      urgency,
      completed_at: completedAt,
      advance_cursor: run.total_stages,
      last_advanced_at: completedAt,
    })
    .eq("id", run.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "failed to finalize run");
  }

  const { data: existingPack } = await admin
    .from("response_packs")
    .select("id")
    .eq("run_id", run.id)
    .maybeSingle();

  if (!existingPack) {
    const pack = buildFallbackResponsePack({
      run_id: run.id,
      confidence,
      urgency,
      caseTitle: caseRow.title ?? "Untitled case",
      customerName: caseRow.customer_name ?? null,
    });
    await admin.from("response_packs").insert(pack);

    await appendRunEvent(admin, {
      workspace_id: run.workspace_id,
      case_id: run.case_id,
      run_id: run.id,
      event_type: "response_pack.created",
      actor_type: "system",
      payload: {
        summary: "Response pack persisted for review.",
        confidence,
      },
      created_at: completedAt,
    });
  }

  await appendRunEvent(admin, {
    workspace_id: run.workspace_id,
    case_id: run.case_id,
    run_id: run.id,
    event_type: updated.state === "completed" ? "run.completed" : updated.state === "escalated" ? "run.escalated" : "run.failed",
    actor_type: "system",
    payload: {
      summary: `Run ended in ${updated.state}.`,
      state: updated.state,
      confidence: updated.confidence,
      urgency: updated.urgency,
    },
    created_at: completedAt,
  });

  return updated as Run;
}

async function generateStageOutput(
  stageKey: string,
  ctx: StageContext,
  prompt = getStagePrompt(stageKey),
): Promise<StageGenerationResult> {
  if (!prompt) {
    return {
      output: {},
      provenance: null,
    };
  }

  try {
    const { text } = await retry(
      () =>
        generateText({
          model: triageModel,
          system: prompt.system,
          prompt: prompt.user(ctx),
          maxOutputTokens: 400,
          temperature: 0.3,
        }),
      {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryOn: (error: unknown) => {
          if (error instanceof Error) {
            return (
              error.message.includes("fetch") ||
              error.message.includes("NetworkError") ||
              error.message.includes("500") ||
              error.message.includes("502") ||
              error.message.includes("503") ||
              error.message.includes("504")
            );
          }

          return false;
        },
      },
    );

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      return {
        output: JSON.parse(cleaned) as Record<string, unknown>,
        provenance: buildStageProvenance({
          prompt,
          executionMode: "ai",
        }),
      };
    } catch {
      return {
        output: { raw_output: text, parse_error: true },
        provenance: buildStageProvenance({
          prompt,
          executionMode: "ai",
          parseError: true,
        }),
      };
    }
  } catch (error) {
    console.warn(
      `[execute-step] LLM failed for stage ${stageKey} after retries, falling back to synthetic`,
      error,
    );
    return buildSyntheticStageOutput(stageKey, ctx, prompt, "llm_failure");
  }
}

function baselineConfidence(body: string) {
  const len = body.length;
  if (len < 80) return 45;
  if (len < 200) return 68;
  if (len < 500) return 82;
  return 88;
}
