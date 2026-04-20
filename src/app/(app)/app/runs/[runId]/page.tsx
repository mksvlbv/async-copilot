import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRunView } from "@/features/runs/components/live-run-view";
import type { RunWithDetails } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run detail — signature screen (Unit 6).
 * Loads the run + case + stages + response pack in a single query,
 * hands off to the client <LiveRunView /> for polling + interaction.
 */
export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("runs")
    .select(
      `*,
       case:cases ( * ),
       stages:run_stages ( * ),
       response_pack:response_packs ( * )`,
    )
    .eq("id", runId)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
    .maybeSingle();

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-8 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Couldn&apos;t load this run</h1>
        <p className="text-sm text-gray-500">
          This run is temporarily unavailable. Reload the page or return to the runs list.
        </p>
        <Link
          href="/app/runs"
          className="inline-flex mt-4 text-sm text-gray-700 hover:text-gray-900 underline underline-offset-4"
        >
          Back to Runs
        </Link>
      </div>
    );
  }
  if (!data) notFound();

  // Collapse response_pack from array → single | null (foreign key join returns array)
  const pack = Array.isArray(data.response_pack) ? (data.response_pack[0] ?? null) : (data.response_pack ?? null);
  const caseRow = Array.isArray(data.case) ? data.case[0] : data.case;

  const initialRun: RunWithDetails = {
    ...data,
    case: caseRow,
    stages: data.stages ?? [],
    response_pack: pack,
  };

  return <LiveRunView initialRun={initialRun} />;
}
