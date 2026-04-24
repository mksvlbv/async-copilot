import { redirect } from "next/navigation";
import { getDefaultWorkspaceMembership } from "@/lib/auth/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyRunsRedirectPage() {
  const membership = await getDefaultWorkspaceMembership();

  if (!membership) {
    redirect("/app/onboarding");
  }

  redirect(`/app/w/${membership.workspace.slug}/runs`);
}
