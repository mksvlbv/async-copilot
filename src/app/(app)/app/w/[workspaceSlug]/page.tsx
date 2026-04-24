import { notFound } from "next/navigation";
import { NewCasePage } from "@/features/intake/components/new-case-page";
import { getWorkspaceAccessBySlug } from "@/lib/auth/workspace";

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

  return <NewCasePage workspaceSlug={access.workspace.slug} />;
}
