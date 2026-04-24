import { notFound } from "next/navigation";
import { NewCasePage } from "@/features/intake/components/new-case-page";
import { getWorkspaceAccessBySlug } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceNewCasePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const access = await getWorkspaceAccessBySlug(workspaceSlug);

  if (!access) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: gmailConnection } = await admin
    .from("workspace_gmail_accounts")
    .select("id, gmail_user_email")
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  return (
    <NewCasePage
      workspaceSlug={access.workspace.slug}
      currentRole={access.membership.role}
      gmailConnection={gmailConnection
        ? {
            id: gmailConnection.id,
            gmailUserEmail: gmailConnection.gmail_user_email,
          }
        : null}
    />
  );
}
