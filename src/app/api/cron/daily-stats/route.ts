import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/daily-stats
 *
 * Snapshot daily platform metrics into a `daily_stats` table.
 * Runs once per day via Vercel Cron.
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
  const today = new Date().toISOString().slice(0, 10);

  // Gather counts
  const [casesRes, runsRes, completedRes, escalatedRes, failedRes] = await Promise.all([
    admin.from("cases").select("id", { count: "exact", head: true }),
    admin.from("runs").select("id", { count: "exact", head: true }),
    admin.from("runs").select("id", { count: "exact", head: true }).eq("state", "completed"),
    admin.from("runs").select("id", { count: "exact", head: true }).eq("state", "escalated"),
    admin.from("runs").select("id", { count: "exact", head: true }).eq("state", "failed"),
  ]);

  const stats = {
    date: today,
    total_cases: casesRes.count ?? 0,
    total_runs: runsRes.count ?? 0,
    completed_runs: completedRes.count ?? 0,
    escalated_runs: escalatedRes.count ?? 0,
    failed_runs: failedRes.count ?? 0,
  };

  // Upsert into daily_stats (if table exists — graceful no-op otherwise)
  const { error } = await admin
    .from("daily_stats")
    .upsert(stats, { onConflict: "date" });

  if (error) {
    // Table might not exist yet — log but don't fail the cron
    console.warn(`[cron/daily-stats] Upsert failed (table may not exist): ${error.message}`);
    return NextResponse.json({ stats, persisted: false, reason: error.message });
  }

  return NextResponse.json({ stats, persisted: true });
}
