import { after, NextResponse } from "next/server";
import { getSessionUser, getWorkspaceAccessForMutation } from "@/lib/auth/workspace";
import {
  extractGmailCandidateId,
  fetchGmailMessage,
  fetchGmailThread,
  normalizeGmailThread,
  refreshGoogleAccessToken,
  tokenExpiresAtFromNow,
} from "@/lib/integrations/gmail";
import { processRunUntilYield } from "@/lib/runs/background";
import { createRunForCase } from "@/lib/runs/create-run";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Case, GmailMessage, WorkspaceGmailAccount } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  const { workspaceSlug } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = await getWorkspaceAccessForMutation(workspaceSlug);
  if (!access) {
    return NextResponse.json({ error: "Workspace access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gmailUrlOrId = typeof body.gmail_url_or_id === "string" ? body.gmail_url_or_id.trim() : "";
  if (!gmailUrlOrId) {
    return NextResponse.json({ error: "Field 'gmail_url_or_id' is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: accountData, error: accountError } = await admin
    .from("workspace_gmail_accounts")
    .select("*")
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!accountData) {
    return NextResponse.json(
      { error: "Connect a workspace Gmail inbox before importing a thread." },
      { status: 409 },
    );
  }

  try {
    const account = accountData as WorkspaceGmailAccount;
    const accessToken = await ensureWorkspaceGmailAccessToken(admin, account);
    const candidateId = extractGmailCandidateId(gmailUrlOrId);
    const thread = await resolveGmailThread(accessToken, candidateId);
    const normalizedThread = normalizeGmailThread(thread, account.gmail_user_email);

    const importedAt = new Date().toISOString();
    const gmailRows = normalizedThread.messages.map((message) => ({
      workspace_id: access.workspace.id,
      gmail_account_id: account.id,
      gmail_message_id: message.gmailMessageId,
      gmail_thread_id: message.gmailThreadId,
      subject: message.subject,
      from_name: message.fromName,
      from_email: message.fromEmail,
      to_emails: message.toEmails,
      cc_emails: message.ccEmails,
      sent_at: message.sentAt,
      snippet: message.snippet,
      body_text: message.bodyText,
      raw_payload: message.rawPayload,
      imported_at: importedAt,
    }));

    const { error: upsertError } = await admin
      .from("gmail_messages")
      .upsert(gmailRows, { onConflict: "workspace_id,gmail_message_id" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const { data: threadMessages, error: threadMessagesError } = await admin
      .from("gmail_messages")
      .select("*")
      .eq("workspace_id", access.workspace.id)
      .eq("gmail_thread_id", normalizedThread.gmailThreadId)
      .order("sent_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (threadMessagesError || !threadMessages) {
      throw new Error(threadMessagesError?.message ?? "Failed to load imported Gmail messages");
    }

    const anchorMessage = (threadMessages as GmailMessage[]).find(
      (message) => message.gmail_message_id === normalizedThread.anchorMessageId,
    );

    if (!anchorMessage) {
      throw new Error("Imported Gmail thread is missing its anchor message.");
    }

    const { data: existingCase, error: existingCaseError } = await admin
      .from("cases")
      .select("*")
      .eq("gmail_message_id", anchorMessage.id)
      .maybeSingle();

    if (existingCaseError) {
      throw new Error(existingCaseError.message);
    }

    if (existingCase) {
      const { data: existingRun, error: existingRunError } = await admin
        .from("runs")
        .select("*")
        .eq("case_id", existingCase.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRunError) {
        throw new Error(existingRunError.message);
      }

      if (existingRun) {
        return NextResponse.json({ case: existingCase, run: existingRun, existing: true });
      }

      const run = await createRunForCase({
        admin,
        caseRow: existingCase as Case,
        user,
        preRunEvents: [
          {
            event_type: "gmail.case_ingested",
            actor_type: "user",
            actor_user_id: user.id,
            payload: {
              actor_label: user.email ?? null,
              summary: `Imported Gmail thread '${normalizedThread.subject}' from ${account.gmail_user_email}.`,
              gmail_user_email: account.gmail_user_email,
              sender_email: normalizedThread.customerEmail,
              gmail_thread_id: normalizedThread.gmailThreadId,
            },
          },
        ],
      });

      scheduleBackgroundRun(run.id, user);

      return NextResponse.json({ case: existingCase, run, existing: true });
    }

    const { data: createdCase, error: caseError } = await admin
      .from("cases")
      .insert({
        workspace_id: access.workspace.id,
        title: normalizedThread.subject,
        body: normalizedThread.transcript,
        source: "gmail",
        gmail_message_id: anchorMessage.id,
        created_by: user.id,
        customer_name: normalizedThread.customerName,
        customer_account: null,
        customer_plan: null,
      })
      .select("*")
      .single();

    if (caseError || !createdCase) {
      throw new Error(caseError?.message ?? "Failed to materialize Gmail case");
    }

    const run = await createRunForCase({
      admin,
      caseRow: createdCase as Case,
      user,
      preRunEvents: [
        {
          event_type: "gmail.case_ingested",
          actor_type: "user",
          actor_user_id: user.id,
          payload: {
            actor_label: user.email ?? null,
            summary: `Imported Gmail thread '${normalizedThread.subject}' from ${account.gmail_user_email}.`,
            gmail_user_email: account.gmail_user_email,
            sender_email: normalizedThread.customerEmail,
            gmail_thread_id: normalizedThread.gmailThreadId,
          },
        },
      ],
    });

    scheduleBackgroundRun(run.id, user);

    return NextResponse.json({ case: createdCase, run, existing: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail import failed" },
      { status: statusForImportError(error) },
    );
  }
}

async function ensureWorkspaceGmailAccessToken(
  admin: ReturnType<typeof createAdminClient>,
  account: WorkspaceGmailAccount,
) {
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : Number.NaN;
  const stillValid = account.access_token && (Number.isNaN(expiresAt) || expiresAt > Date.now() + 60_000);
  if (stillValid) {
    return account.access_token as string;
  }

  const refreshed = await refreshGoogleAccessToken(account.refresh_token);
  const { error } = await admin
    .from("workspace_gmail_accounts")
    .update({
      access_token: refreshed.accessToken,
      token_expires_at: tokenExpiresAtFromNow(refreshed.expiresIn),
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : account.scopes,
    })
    .eq("id", account.id);

  if (error) {
    throw new Error(error.message);
  }

  return refreshed.accessToken;
}

async function resolveGmailThread(accessToken: string, candidateId: string) {
  try {
    return await fetchGmailThread(accessToken, candidateId);
  } catch (threadError) {
    if (!isGoogleNotFoundError(threadError)) {
      throw threadError;
    }

    const message = await fetchGmailMessage(accessToken, candidateId);
    return fetchGmailThread(accessToken, message.threadId);
  }
}

function isGoogleNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("(404)");
}

function statusForImportError(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("Paste a ") ||
    error.message.includes("Could not find a Gmail thread") ||
    error.message.includes("Field 'gmail_url_or_id'")
  ) {
    return 400;
  }

  if (error.message.includes("(404)")) {
    return 404;
  }

  if (error.message.includes("Connect a workspace Gmail inbox")) {
    return 409;
  }

  return 500;
}

function scheduleBackgroundRun(
  runId: string,
  user: { id: string; email?: string | null },
) {
  try {
    after(async () => {
      try {
        await processRunUntilYield({
          runId,
          user: {
            id: user.id,
            email: user.email ?? undefined,
          },
        });
      } catch (error) {
        console.error(`[gmail/import] background processing failed for ${runId}`, error);
      }
    });
  } catch (error) {
    console.warn(`[gmail/import] unable to schedule background processing for ${runId}`, error);
  }
}
