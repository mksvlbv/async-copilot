import { NextResponse } from "next/server";
import { processRunUntilYield, runEligibleForBackgroundPickup } from "@/lib/runs/background";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Run } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 12;

/**
 * GET /api/cron/process-runs
 * Picks up queued/retrying runs or expired execution leases.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("runs")
    .select("*")
    .in("execution_status", ["queued", "retrying", "running"])
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligibleRuns = ((data ?? []) as Run[])
    .filter((run) => runEligibleForBackgroundPickup(run))
    .slice(0, BATCH_SIZE);

  const processed: Array<{ run_id: string; terminal: boolean; retrying: boolean }> = [];

  for (const run of eligibleRuns) {
    const result = await processRunUntilYield({
      admin,
      runId: run.id,
    });

    processed.push({
      run_id: run.id,
      terminal: result.terminal,
      retrying: result.retrying,
    });
  }

  return NextResponse.json({
    picked_up: eligibleRuns.length,
    processed,
  });
}
