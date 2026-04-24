import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRunView } from "@/features/runs/components/live-run-view";
import { getWorkspaceAccessBySlug } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import type { RunWithDetails } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceRunDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; runId: string }>;
}) {
  const { workspaceSlug, runId } = await params;
  const access = await getWorkspaceAccessBySlug(workspaceSlug);

  if (!access) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("runs")
    .select(
      `*,
       case:cases ( * ),
       stages:run_stages ( * ),
       response_pack:response_packs ( * ),
       events:run_events ( * )`,
    )
    .eq("id", runId)
    .eq("workspace_id", access.workspace.id)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
    .order("id", { foreignTable: "run_events", ascending: true })
    .maybeSingle();

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-8 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Couldn&apos;t load this run</h1>
        <p className="text-sm text-gray-500">
          This run is temporarily unavailable. Reload the page or return to the runs list.
        </p>
        <Link
          href={`/app/w/${access.workspace.slug}/runs` as never}
          className="inline-flex mt-4 text-sm text-gray-700 hover:text-gray-900 underline underline-offset-4"
        >
          Back to Runs
        </Link>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const pack = Array.isArray(data.response_pack)
    ? (data.response_pack[0] ?? null)
    : (data.response_pack ?? null);
  const caseRow = Array.isArray(data.case) ? data.case[0] : data.case;

  const initialRun: RunWithDetails = {
    ...data,
    case: caseRow,
    stages: data.stages ?? [],
    response_pack: pack,
    events: data.events ?? [],
  };

  return (
    <LiveRunView
      initialRun={initialRun}
      workspaceSlug={access.workspace.slug}
      currentRole={access.membership.role}
    />
  );
}
