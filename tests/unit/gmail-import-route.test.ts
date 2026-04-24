import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  extractGmailCandidateId,
  fetchGmailMessage,
  fetchGmailThread,
  normalizeGmailThread,
  refreshGoogleAccessToken,
  tokenExpiresAtFromNow,
} = vi.hoisted(() => ({
  extractGmailCandidateId: vi.fn(),
  fetchGmailMessage: vi.fn(),
  fetchGmailThread: vi.fn(),
  normalizeGmailThread: vi.fn(),
  refreshGoogleAccessToken: vi.fn(),
  tokenExpiresAtFromNow: vi.fn(),
}));

const { createRunForCase } = vi.hoisted(() => ({
  createRunForCase: vi.fn(),
}));

const workspaceAccountMaybeSingle = vi.fn();
const gmailMessagesUpsert = vi.fn();
const gmailMessagesOrder = vi.fn();
const casesMaybeSingle = vi.fn();
const casesInsert = vi.fn();
const casesInsertSingle = vi.fn();
const runsMaybeSingle = vi.fn();

vi.mock("@/lib/auth/workspace", () => ({
  getSessionUser: vi.fn(async () => ({ id: "user_123", email: "reviewer@example.com" })),
  getWorkspaceAccessForMutation: vi.fn(async () => ({
    user: { id: "user_123", email: "reviewer@example.com" },
    workspace: { id: "ws_123", slug: "acme-support" },
    membership: { role: "admin" },
  })),
}));

vi.mock("@/lib/integrations/gmail", () => ({
  extractGmailCandidateId,
  fetchGmailMessage,
  fetchGmailThread,
  normalizeGmailThread,
  refreshGoogleAccessToken,
  tokenExpiresAtFromNow,
}));

vi.mock("@/lib/runs/create-run", () => ({
  createRunForCase,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "workspace_gmail_accounts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: workspaceAccountMaybeSingle }),
          }),
          update: vi.fn(() => ({ eq: vi.fn() })),
        };
      }

      if (table === "gmail_messages") {
        return {
          upsert: gmailMessagesUpsert,
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  order: gmailMessagesOrder,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "cases") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: casesMaybeSingle }),
          }),
          insert: (payload: Record<string, unknown>) => {
            casesInsert(payload);
            return {
              select: () => ({ single: casesInsertSingle }),
            };
          },
        };
      }

      if (table === "runs") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ maybeSingle: runsMaybeSingle }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

import { POST } from "@/app/api/workspaces/[workspaceSlug]/gmail/import/route";

describe("POST /api/workspaces/[workspaceSlug]/gmail/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    workspaceAccountMaybeSingle.mockResolvedValue({
      data: {
        id: "gmail_account_123",
        workspace_id: "ws_123",
        connected_by: "user_123",
        gmail_user_email: "ops@example.com",
        google_subject: "google_sub_123",
        refresh_token: "refresh_token",
        access_token: "access_token",
        token_expires_at: null,
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        created_at: "2026-04-24T10:00:00.000Z",
        updated_at: "2026-04-24T10:00:00.000Z",
      },
      error: null,
    });
    extractGmailCandidateId.mockReturnValue("thread_123");
    fetchGmailThread.mockResolvedValue({ id: "thread_123", messages: [] });
    fetchGmailMessage.mockResolvedValue({ id: "msg_1", threadId: "thread_123" });
    normalizeGmailThread.mockReturnValue({
      gmailThreadId: "thread_123",
      subject: "Billing outage",
      anchorMessageId: "gmail_msg_1",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      transcript: "Subject: Billing outage\n\nImported from Gmail thread thread_123",
      messages: [
        {
          gmailMessageId: "gmail_msg_1",
          gmailThreadId: "thread_123",
          subject: "Billing outage",
          fromName: "Jane Doe",
          fromEmail: "jane@example.com",
          toEmails: ["ops@example.com"],
          ccEmails: [],
          sentAt: "2026-04-24T10:00:00.000Z",
          snippet: "Billing is broken",
          bodyText: "Billing is broken",
          rawPayload: {},
        },
      ],
    });
    gmailMessagesUpsert.mockResolvedValue({ error: null });
    gmailMessagesOrder.mockResolvedValue({
      data: [
        {
          id: "row_1",
          gmail_message_id: "gmail_msg_1",
        },
      ],
      error: null,
    });
    casesMaybeSingle.mockResolvedValue({ data: null, error: null });
    casesInsertSingle.mockResolvedValue({
      data: {
        id: "case_123",
        workspace_id: "ws_123",
        case_ref: "CASE-9001",
        title: "Billing outage",
        body: "Subject: Billing outage",
        source: "gmail",
        gmail_message_id: "row_1",
        sample_id: null,
        created_by: "user_123",
        customer_name: "Jane Doe",
        customer_account: null,
        customer_plan: null,
        created_at: "2026-04-24T10:00:00.000Z",
        updated_at: "2026-04-24T10:00:00.000Z",
      },
      error: null,
    });
    runsMaybeSingle.mockResolvedValue({ data: null, error: null });
    createRunForCase.mockResolvedValue({ id: "run_123", case_id: "case_123" });
    refreshGoogleAccessToken.mockResolvedValue({
      accessToken: "refreshed_access_token",
      refreshToken: null,
      expiresIn: 3600,
      scopes: [],
    });
    tokenExpiresAtFromNow.mockReturnValue("2026-04-24T11:00:00.000Z");
  });

  it("materializes a Gmail-sourced case and creates a run", async () => {
    const response = await POST(
      new Request("https://async-copilot.vercel.app/api/workspaces/acme-support/gmail/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmail_url_or_id: "thread_123" }),
      }),
      { params: Promise.resolve({ workspaceSlug: "acme-support" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(gmailMessagesUpsert).toHaveBeenCalledOnce();
    expect(casesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "gmail",
        gmail_message_id: "row_1",
        title: "Billing outage",
      }),
    );
    expect(createRunForCase).toHaveBeenCalledWith(
      expect.objectContaining({
        preRunEvents: [
          expect.objectContaining({
            event_type: "gmail.case_ingested",
          }),
        ],
      }),
    );
    expect(body.run.id).toBe("run_123");
    expect(body.existing).toBe(false);
  });

  it("returns the existing run on duplicate Gmail import", async () => {
    casesMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "case_existing",
        workspace_id: "ws_123",
        case_ref: "CASE-9002",
        title: "Billing outage",
        body: "Subject: Billing outage",
        source: "gmail",
        gmail_message_id: "row_1",
        sample_id: null,
        created_by: "user_123",
        customer_name: "Jane Doe",
        customer_account: null,
        customer_plan: null,
        created_at: "2026-04-24T10:00:00.000Z",
        updated_at: "2026-04-24T10:00:00.000Z",
      },
      error: null,
    });
    runsMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "run_existing",
        case_id: "case_existing",
      },
      error: null,
    });

    const response = await POST(
      new Request("https://async-copilot.vercel.app/api/workspaces/acme-support/gmail/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmail_url_or_id: "thread_123" }),
      }),
      { params: Promise.resolve({ workspaceSlug: "acme-support" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createRunForCase).not.toHaveBeenCalled();
    expect(body.run.id).toBe("run_existing");
    expect(body.existing).toBe(true);
  });
});
