import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup-stale
 *
 * Self-healing cron job: finds runs stuck in "running" state for >30 min
 * and marks them as "failed". Prevents zombie runs from accumulating.
 *
 * Secured via CRON_SECRET header (Vercel Cron sets this automatically).
 */
export async function GET(request: Request) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Find stale runs: state = "running" AND last_advanced_at < 30 min ago
  const { data: staleRuns, error: fetchErr } = await admin
    .from("runs")
    .select("id, case_id, last_advanced_at, advance_cursor, total_stages")
    .eq("state", "running")
    .lt("last_advanced_at", thirtyMinAgo);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!staleRuns || staleRuns.length === 0) {
    return NextResponse.json({ cleaned: 0, message: "No stale runs found" });
  }

  // Mark each stale run as failed
  const ids = staleRuns.map((r) => r.id);
  const { error: updateErr } = await admin
    .from("runs")
    .update({
      state: "failed",
      completed_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Also fail any pending/running stages on those runs
  await admin
    .from("run_stages")
    .update({ state: "failed" })
    .in("run_id", ids)
    .in("state", ["pending", "running"]);

  console.log(`[cron/cleanup-stale] Cleaned ${ids.length} stale run(s): ${ids.join(", ")}`);

  return NextResponse.json({
    cleaned: ids.length,
    run_ids: ids,
    threshold: thirtyMinAgo,
  });
}
