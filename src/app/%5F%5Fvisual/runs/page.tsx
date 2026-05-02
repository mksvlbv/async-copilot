import { RunsTable } from "@/features/runs/components/runs-table";
import {
  getVisualRunsTableRowsFixture,
  VISUAL_WORKSPACE_SLUG,
} from "@/lib/testing/visual-fixtures";

export const dynamic = "force-dynamic";

export default function VisualHarnessRunsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        initialRuns={getVisualRunsTableRowsFixture() as never}
        workspaceSlug={VISUAL_WORKSPACE_SLUG}
      />
    </div>
  );
}
