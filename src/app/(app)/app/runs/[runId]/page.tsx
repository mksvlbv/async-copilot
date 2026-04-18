import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run detail — placeholder for Unit 6 (Live Triage Run signature screen).
 * For now: confirms the run exists and shows the current state. Real 3-column
 * lockup (Case Context / Visible Triage / Response Pack) lands in Unit 6.
 */
export default async function RunDetailPlaceholder({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, advance_cursor, total_stages,
       case:cases ( case_ref, title, customer_name )`,
    )
    .eq("id", runId)
    .maybeSingle();

  if (!run) notFound();

  const caseRow = Array.isArray(run.case) ? run.case[0] : run.case;

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            Run {runId.slice(0, 8)} · {caseRow?.case_ref}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">
          {caseRow?.title ?? "Triage Run"}
        </h1>
        {caseRow?.customer_name && (
          <p className="text-sm text-gray-500 mb-8">{caseRow.customer_name}</p>
        )}

        <dl className="grid grid-cols-3 gap-6 mt-6 text-sm">
          <Stat label="State" value={run.state} />
          <Stat
            label="Progress"
            value={`${run.advance_cursor} / ${run.total_stages}`}
          />
          <Stat
            label="Confidence"
            value={run.confidence != null ? `${run.confidence}%` : "—"}
          />
        </dl>

        <div className="mt-10 p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
          <strong className="font-semibold">Unit 6 placeholder.</strong> The live
          3-column triage screen (Case Context / Visible Triage / Response Pack)
          lands in the next build step. Right now the run is persisted and the
          API is live — you can still advance/approve it via the API routes.
        </div>

        <div className="mt-6 flex gap-3 text-sm">
          <Link
            href={"/app" as never}
            className="text-gray-600 hover:text-black font-medium transition-colors"
          >
            ← New case
          </Link>
          <span className="text-gray-300">·</span>
          <a
            href={`/api/runs/${runId}`}
            className="text-gray-600 hover:text-black font-medium transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            View raw JSON
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">
        {label}
      </dt>
      <dd className="text-lg font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
