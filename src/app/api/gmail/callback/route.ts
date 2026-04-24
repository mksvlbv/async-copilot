import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getWorkspaceAccessForMutation } from "@/lib/auth/workspace";
import {
  exchangeGoogleCodeForTokens,
  fetchGmailProfile,
  fetchGoogleUserInfo,
  getGoogleOauthRedirectUri,
  tokenExpiresAtFromNow,
} from "@/lib/integrations/gmail";
import { createAdminClient } from "@/lib/supabase/admin";

const GMAIL_OAUTH_COOKIE = "async_copilot_gmail_oauth";

type GmailOauthCookie = {
  state: string;
  workspaceSlug: string;
  userId: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const authError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const oauthCookie = parseOauthCookie(cookieStore.get(GMAIL_OAUTH_COOKIE)?.value ?? null);

  if (authError) {
    return redirectToWorkspace(request, oauthCookie?.workspaceSlug ?? null, authError, true);
  }

  if (!code || !state || !oauthCookie || oauthCookie.state !== state) {
    return redirectToWorkspace(request, oauthCookie?.workspaceSlug ?? null, "invalid_oauth_state", true);
  }

  const access = await getWorkspaceAccessForMutation(oauthCookie.workspaceSlug, ["admin"]);
  if (!access || access.user.id !== oauthCookie.userId) {
    return redirectToWorkspace(request, oauthCookie.workspaceSlug, "workspace_access_lost", true);
  }

  try {
    const redirectUri = getGoogleOauthRedirectUri(request);
    const tokens = await exchangeGoogleCodeForTokens({ code, redirectUri });
    const [userInfo, gmailProfile] = await Promise.all([
      fetchGoogleUserInfo(tokens.accessToken),
      fetchGmailProfile(tokens.accessToken),
    ]);

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("workspace_gmail_accounts")
      .select("id, refresh_token")
      .eq("workspace_id", access.workspace.id)
      .maybeSingle();

    const refreshToken = tokens.refreshToken ?? existing?.refresh_token ?? null;
    if (!refreshToken) {
      throw new Error("Google did not return a refresh token for this workspace connection.");
    }

    const { error } = await admin.from("workspace_gmail_accounts").upsert(
      {
        workspace_id: access.workspace.id,
        connected_by: access.user.id,
        gmail_user_email: gmailProfile.emailAddress,
        google_subject: userInfo.sub,
        refresh_token: refreshToken,
        access_token: tokens.accessToken,
        token_expires_at: tokenExpiresAtFromNow(tokens.expiresIn),
        scopes: tokens.scopes,
      },
      { onConflict: "workspace_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    console.info("[gmail callback] connected", {
      workspaceSlug: access.workspace.slug,
      gmailUserEmail: gmailProfile.emailAddress,
      scopes: tokens.scopes,
    });

    return redirectToWorkspace(request, access.workspace.slug, "connected", true);
  } catch (error) {
    console.error("[gmail callback] failed", {
      workspaceSlug: oauthCookie.workspaceSlug,
      error: error instanceof Error ? error.message : String(error),
    });

    return redirectToWorkspace(
      request,
      oauthCookie.workspaceSlug,
      error instanceof Error ? "connection_failed" : "connection_failed",
      true,
    );
  }
}

function parseOauthCookie(value: string | null) {
  if (!value) {
    return null as GmailOauthCookie | null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as GmailOauthCookie;
  } catch {
    return null as GmailOauthCookie | null;
  }
}

function redirectToWorkspace(
  request: Request,
  workspaceSlug: string | null,
  status: string,
  clearCookie = false,
) {
  const destination = workspaceSlug ? `/app/w/${workspaceSlug}?gmail=${encodeURIComponent(status)}` : "/login";
  const response = NextResponse.redirect(new URL(destination, request.url));

  if (clearCookie) {
    response.cookies.set({
      name: GMAIL_OAUTH_COOKIE,
      value: "",
      path: "/api/gmail/callback",
      maxAge: 0,
    });
  }

  return response;
}
