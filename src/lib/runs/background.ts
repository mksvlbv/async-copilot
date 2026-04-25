import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { appendRunEvent } from "@/lib/runs/events";
import {
  executeRunStep,
  isRunTerminalState,
  loadRunById,
  resetRunningStages,
} from "@/lib/runs/execute-step";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Run } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type ExecutionUser = Pick<User, "id" | "email"> | null;

const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_MAX_STEPS = 6;
const DEFAULT_MAX_DURATION_MS = 20_000;
const MAX_EXECUTION_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 60_000;
const BASE_RETRY_DELAY_MS = 5_000;

type RunClaim = {
  claimed: boolean;
  busy: boolean;
  recovered: boolean;
  token: string | null;
  run: Run | null;
};

export type ProcessRunResult = {
  run: Run | null;
  claimed: boolean;
  busy: boolean;
  advanced: boolean;
  terminal: boolean;
  retrying: boolean;
  ai: boolean;
  stepsProcessed: number;
  stageCompleted: string | null;
  error: string | null;
};

export function hasActiveExecutionLease(
  run: Pick<Run, "execution_status" | "execution_lease_expires_at">,
) {
  if (run.execution_status !== "running") {
    return false;
  }

  const expiresAt = run.execution_lease_expires_at
    ? Date.parse(run.execution_lease_expires_at)
    : Number.NaN;

  return !Number.isNaN(expiresAt) && expiresAt > Date.now();
}

export function runEligibleForBackgroundPickup(
  run: Pick<Run, "state" | "execution_status" | "execution_next_retry_at" | "execution_lease_expires_at">,
) {
  if (isRunTerminalState(run.state)) {
    return false;
  }

  if (run.execution_status === "queued") {
    return true;
  }

  if (run.execution_status === "retrying") {
    if (!run.execution_next_retry_at) {
      return true;
    }

    return Date.parse(run.execution_next_retry_at) <= Date.now();
  }

  if (run.execution_status === "running") {
    return !hasActiveExecutionLease(run);
  }

  return false;
}

export function retryDelayMsForAttempt(attemptNumber: number) {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attemptNumber - 1), MAX_RETRY_DELAY_MS);
}

export async function processRunUntilYield({
  admin = createAdminClient(),
  runId,
  user = null,
  leaseMs = DEFAULT_LEASE_MS,
  maxSteps = DEFAULT_MAX_STEPS,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
}: {
  admin?: AdminClient;
  runId: string;
  user?: ExecutionUser;
  leaseMs?: number;
  maxSteps?: number;
  maxDurationMs?: number;
}): Promise<ProcessRunResult> {
  const claim = await claimRunExecution({ admin, runId, leaseMs });

  if (!claim.claimed || !claim.token) {
    const run = claim.run ?? (await loadRunById(admin, runId));
    return {
      run,
      claimed: false,
      busy: claim.busy,
      advanced: false,
      terminal: run ? isRunTerminalState(run.state) : false,
      retrying: run?.execution_status === "retrying",
      ai: false,
      stepsProcessed: 0,
      stageCompleted: null,
      error: null,
    };
  }

  if (claim.recovered) {
    await resetRunningStages(admin, runId);
  }

  const startedAt = Date.now();
  let run = claim.run;
  let advanced = false;
  let usedAI = false;
  let stepsProcessed = 0;
  let stageCompleted: string | null = null;

  try {
    while (stepsProcessed < maxSteps && Date.now() - startedAt < maxDurationMs) {
      await renewExecutionLease(admin, runId, claim.token, leaseMs);

      const step = await executeRunStep({
        admin,
        runId,
        user,
      });

      run = step.run;
      advanced = advanced || step.advanced;
      usedAI = usedAI || step.ai;
      if (step.stageCompleted) {
        stageCompleted = step.stageCompleted;
      }
      if (step.advanced) {
        stepsProcessed += 1;
      }

      if (step.terminal) {
        const finalized = await markExecutionSettled(
          admin,
          step.run,
          claim.token,
          step.run.state === "failed" ? "failed" : "completed",
        );
        return {
          run: finalized,
          claimed: true,
          busy: false,
          advanced,
          terminal: true,
          retrying: false,
          ai: usedAI,
          stepsProcessed,
          stageCompleted,
          error: null,
        };
      }

      if (!step.advanced || step.yielded) {
        break;
      }
    }

    const queued = await requeueRunExecution(admin, runId, claim.token);
    return {
      run: queued,
      claimed: true,
      busy: false,
      advanced,
      terminal: queued ? isRunTerminalState(queued.state) : false,
      retrying: queued?.execution_status === "retrying",
      ai: usedAI,
      stepsProcessed,
      stageCompleted,
      error: null,
    };
  } catch (error) {
    await resetRunningStages(admin, runId);

    const message = error instanceof Error ? error.message : "Run execution failed";
    const nextAttempt = (run?.execution_attempts ?? 0) + 1;

    if (nextAttempt >= MAX_EXECUTION_RETRIES) {
      const failed = await failRunExecution(admin, runId, claim.token, message, nextAttempt);
      return {
        run: failed,
        claimed: true,
        busy: false,
        advanced,
        terminal: true,
        retrying: false,
        ai: usedAI,
        stepsProcessed,
        stageCompleted,
        error: message,
      };
    }

    const retrying = await scheduleRunRetry(admin, runId, claim.token, message, nextAttempt);
    return {
      run: retrying,
      claimed: true,
      busy: false,
      advanced,
      terminal: false,
      retrying: true,
      ai: usedAI,
      stepsProcessed,
      stageCompleted,
      error: message,
    };
  }
}

async function claimRunExecution({
  admin,
  runId,
  leaseMs,
}: {
  admin: AdminClient;
  runId: string;
  leaseMs: number;
}): Promise<RunClaim> {
  const run = await loadRunById(admin, runId);
  if (!run) {
    return {
      claimed: false,
      busy: false,
      recovered: false,
      token: null,
      run: null,
    };
  }

  if (isRunTerminalState(run.state)) {
    return {
      claimed: false,
      busy: false,
      recovered: false,
      token: null,
      run: await markExecutionSettled(admin, run, run.execution_claim_token, run.state === "failed" ? "failed" : "completed"),
    };
  }

  if (!runEligibleForBackgroundPickup(run)) {
    return {
      claimed: false,
      busy: run.execution_status === "running",
      recovered: false,
      token: null,
      run,
    };
  }

  const token = randomUUID();
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString();
  const claimedRun = await attemptClaimRun(admin, run, token, leaseUntil);
  if (!claimedRun) {
    return {
      claimed: false,
      busy: true,
      recovered: false,
      token: null,
      run: await loadRunById(admin, runId),
    };
  }

  return {
    claimed: true,
    busy: false,
    recovered: run.execution_status === "running" && !hasActiveExecutionLease(run),
    token,
    run: claimedRun,
  };
}

async function attemptClaimRun(
  admin: AdminClient,
  run: Run,
  token: string,
  leaseUntil: string,
) {
  const patch = {
    execution_status: "running" as const,
    execution_lease_expires_at: leaseUntil,
    execution_next_retry_at: null,
    execution_claim_token: token,
    execution_last_error: null,
  };

  if (run.execution_status === "queued") {
    const { data } = await admin
      .from("runs")
      .update(patch)
      .eq("id", run.id)
      .eq("execution_status", "queued")
      .select("*")
      .maybeSingle();

    return (data as Run | null) ?? null;
  }

  if (run.execution_status === "retrying") {
    if (!run.execution_next_retry_at) {
      const { data } = await admin
        .from("runs")
        .update(patch)
        .eq("id", run.id)
        .eq("execution_status", "retrying")
        .is("execution_next_retry_at", null)
        .select("*")
        .maybeSingle();

      return (data as Run | null) ?? null;
    }

    const { data } = await admin
      .from("runs")
      .update(patch)
      .eq("id", run.id)
      .eq("execution_status", "retrying")
      .lte("execution_next_retry_at", new Date().toISOString())
      .select("*")
      .maybeSingle();

    return (data as Run | null) ?? null;
  }

  if (run.execution_status === "running") {
    const expiredAt = run.execution_lease_expires_at ?? new Date(0).toISOString();
    const { data } = await admin
      .from("runs")
      .update(patch)
      .eq("id", run.id)
      .eq("execution_status", "running")
      .eq("execution_lease_expires_at", expiredAt)
      .select("*")
      .maybeSingle();

    return (data as Run | null) ?? null;
  }

  return null;
}

async function renewExecutionLease(
  admin: AdminClient,
  runId: string,
  token: string,
  leaseMs: number,
) {
  await admin
    .from("runs")
    .update({ execution_lease_expires_at: new Date(Date.now() + leaseMs).toISOString() })
    .eq("id", runId)
    .eq("execution_status", "running")
    .eq("execution_claim_token", token);
}

async function requeueRunExecution(admin: AdminClient, runId: string, token: string | null) {
  const query = admin
    .from("runs")
    .update({
      execution_status: "queued",
      execution_lease_expires_at: null,
      execution_next_retry_at: null,
      execution_claim_token: null,
    })
    .eq("id", runId)
    .eq("execution_status", "running")
    .neq("state", "completed")
    .neq("state", "escalated")
    .neq("state", "failed");

  await (token ? query.eq("execution_claim_token", token) : query.is("execution_claim_token", null));
  return loadRunById(admin, runId);
}

async function scheduleRunRetry(
  admin: AdminClient,
  runId: string,
  token: string,
  message: string,
  attemptNumber: number,
) {
  const nextRetryAt = new Date(Date.now() + retryDelayMsForAttempt(attemptNumber)).toISOString();
  await admin
    .from("runs")
    .update({
      execution_status: "retrying",
      execution_attempts: attemptNumber,
      execution_next_retry_at: nextRetryAt,
      execution_lease_expires_at: null,
      execution_claim_token: null,
      execution_last_error: message,
    })
    .eq("id", runId)
    .eq("execution_status", "running")
    .eq("execution_claim_token", token);

  return loadRunById(admin, runId);
}

async function failRunExecution(
  admin: AdminClient,
  runId: string,
  token: string,
  message: string,
  attemptNumber: number,
) {
  const run = await loadRunById(admin, runId);
  if (!run) {
    return null as Run | null;
  }

  const failedAt = new Date().toISOString();

  if (!isRunTerminalState(run.state)) {
    await admin
      .from("run_stages")
      .update({ state: "failed" })
      .eq("run_id", runId)
      .in("state", ["pending", "running"]);

    await admin
      .from("runs")
      .update({
        state: "failed",
        completed_at: failedAt,
        execution_status: "failed",
        execution_attempts: attemptNumber,
        execution_next_retry_at: null,
        execution_lease_expires_at: null,
        execution_claim_token: null,
        execution_last_error: message,
      })
      .eq("id", runId)
      .eq("execution_status", "running")
      .eq("execution_claim_token", token);

    await appendRunEvent(admin, {
      workspace_id: run.workspace_id,
      case_id: run.case_id,
      run_id: run.id,
      event_type: "run.failed",
      actor_type: "system",
      payload: {
        summary: "Run execution failed after background retries.",
        state: "failed",
        error: message,
      },
      created_at: failedAt,
    });
  } else {
    await markExecutionSettled(admin, run, token, "failed");
  }

  return loadRunById(admin, runId);
}

async function markExecutionSettled(
  admin: AdminClient,
  run: Run,
  token: string | null,
  status: Extract<Run["execution_status"], "completed" | "failed">,
) {
  const query = admin
    .from("runs")
    .update({
      execution_status: status,
      execution_lease_expires_at: null,
      execution_next_retry_at: null,
      execution_claim_token: null,
    })
    .eq("id", run.id);

  await (token ? query.eq("execution_claim_token", token) : query);

  return (await loadRunById(admin, run.id)) ?? {
    ...run,
    execution_status: status,
    execution_lease_expires_at: null,
    execution_next_retry_at: null,
    execution_claim_token: null,
  };
}
