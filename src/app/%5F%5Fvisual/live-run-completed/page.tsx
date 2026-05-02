import { LiveRunView } from "@/features/runs/components/live-run-view";
import {
  getVisualRunFixture,
  VISUAL_WORKSPACE_SLUG,
} from "@/lib/testing/visual-fixtures";

export const dynamic = "force-dynamic";

export default function VisualHarnessLiveRunCompletedPage() {
  return (
    <LiveRunView
      initialRun={getVisualRunFixture("completed")}
      workspaceSlug={VISUAL_WORKSPACE_SLUG}
      currentRole="reviewer"
    />
  );
}
