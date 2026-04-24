import { NextResponse } from "next/server";
import { getWorkspaceAccessForMutation } from "@/lib/auth/workspace";
import { buildGoogleOauthUrl, getGoogleOauthRedirectUri } from "@/lib/integrations/gmail";

const GMAIL_OAUTH_COOKIE = "async_copilot_gmail_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  const { workspaceSlug } = await params;
  const access = await getWorkspaceAccessForMutation(workspaceSlug, ["admin"]);

  if (!access) {
    return NextResponse.redirect(new URL(`/app/w/${workspaceSlug}?gmail=forbidden`, request.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = getGoogleOauthRedirectUri(request);

  let redirectToGoogle: string;
  try {
    redirectToGoogle = buildGoogleOauthUrl({
      state,
      redirectUri,
    });
  } catch {
    return NextResponse.redirect(new URL(`/app/w/${workspaceSlug}?gmail=oauth_env_missing`, request.url));
  }

  const response = NextResponse.redirect(redirectToGoogle);
  response.cookies.set({
    name: GMAIL_OAUTH_COOKIE,
    value: encodeURIComponent(
      JSON.stringify({
        state,
        workspaceSlug: access.workspace.slug,
        userId: access.user.id,
      }),
    ),
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/api/gmail/callback",
    maxAge: 60 * 10,
  });

  return response;
}
