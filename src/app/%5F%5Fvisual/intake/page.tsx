import { NewCasePage } from "@/features/intake/components/new-case-page";
import {
  VISUAL_WORKSPACE_SLUG,
  visualGmailConnection,
} from "@/lib/testing/visual-fixtures";

export const dynamic = "force-dynamic";

export default function VisualHarnessIntakePage() {
  return (
    <NewCasePage
      workspaceSlug={VISUAL_WORKSPACE_SLUG}
      currentRole="admin"
      gmailConnection={visualGmailConnection}
    />
  );
}
