import { notFound } from "next/navigation";
import { RunsTable } from "@/features/runs/components/runs-table";
import { getWorkspaceAccessBySlug } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceRunsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const access = await getWorkspaceAccessBySlug(workspaceSlug);

  if (!access) {
    notFound();
  }

  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("runs")
    .select(
      `id, state, confidence, urgency, created_at, advance_cursor, total_stages,
       case:cases ( case_ref, title, customer_name )`,
    )
    .eq("workspace_id", access.workspace.id)
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
      <RunsTable
        initialRuns={(runs ?? []) as never}
        workspaceSlug={access.workspace.slug}
      />
    </div>
  );
}
