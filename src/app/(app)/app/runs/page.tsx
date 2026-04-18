import { createAdminClient } from "@/lib/supabase/admin";
import { RunsTable } from "./_components/runs-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs list (Unit 8) — Recent Runs with live search + state chip filter.
 * Plan-mandated fix: 'Today's Digest' right-rail dropped (R21 — no analytics).
 */
export default async function RunsListPage() {
  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, created_at, advance_cursor, total_stages,
       case:cases ( case_ref, title, customer_name )`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            Recent Runs
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mt-2">
            Runs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and reopen past triage executions and response packs.
          </p>
        </div>
      </div>
      <RunsTable initialRuns={(runs ?? []) as never} />
    </div>
  );
}
