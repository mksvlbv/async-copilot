import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRunAccess } from "@/lib/auth/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyRunRedirectPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const access = await getRunAccess(runId);

  if (!access) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("slug")
    .eq("id", access.run.workspace_id)
    .maybeSingle();

  if (!workspace) {
    notFound();
  }

  redirect(`/app/w/${workspace.slug}/runs/${runId}`);
}
