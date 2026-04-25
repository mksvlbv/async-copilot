import { NextResponse } from "next/server";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { hasActiveExecutionLease, processRunUntilYield } from "@/lib/runs/background";
import { loadRunById } from "@/lib/runs/execute-step";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[runId]/advance
 * Executes at most one server-owned step when background execution is idle.
 * If a background lease is already active, this becomes a no-op observer tick.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = await getRunAccess(runId);
  if (!access) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const run = await loadRunById(admin, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.state === "completed" || run.state === "escalated" || run.state === "failed") {
    return NextResponse.json({ run, advanced: false, terminal: true });
  }

  if (hasActiveExecutionLease(run)) {
    return NextResponse.json({
      run,
      advanced: false,
      terminal: false,
      busy: true,
    });
  }

  const result = await processRunUntilYield({
    admin,
    runId,
    user,
    maxSteps: 1,
    maxDurationMs: 15_000,
  });

  const latestRun = result.run ?? (await loadRunById(admin, runId)) ?? run;

  return NextResponse.json({
    run: latestRun,
    advanced: result.advanced,
    terminal: result.terminal,
    busy: result.busy,
    retrying: result.retrying,
    stage_completed: result.stageCompleted,
    ai: result.ai,
    error: result.error,
  });
}
