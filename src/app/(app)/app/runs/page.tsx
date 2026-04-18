import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs list — placeholder for Unit 8 (full table with filters).
 * For now: renders a compact list so operators can jump to any run.
 */
export default async function RunsListPlaceholder() {
  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, created_at,
       case:cases ( case_ref, title, customer_name )`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Recent Runs
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mt-2">
          Runs
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick a run to see its timeline and response pack. Full filtering UI
          lands in Unit 8.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-mono uppercase tracking-widest text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Case</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">State</th>
              <th className="text-left px-4 py-3">Conf.</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {(runs ?? []).map((r) => {
              const c = Array.isArray(r.case) ? r.case[0] : r.case;
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/runs/${r.id}` as never} className="block">
                      <div className="text-gray-900 font-medium">{c?.title ?? "—"}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{c?.case_ref ?? r.id.slice(0, 8)}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c?.customer_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={r.state} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {r.confidence != null ? `${r.confidence}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(r.created_at).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              );
            })}
            {(!runs || runs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                  No runs yet. <Link href="/app" className="text-black font-medium underline">Start one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 border-gray-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    escalated: "bg-red-50 text-red-700 border-red-200",
    failed: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider border ${map[state] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
    >
      {state}
    </span>
  );
}
