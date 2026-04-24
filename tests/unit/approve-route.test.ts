import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchApprovedRunToSlack } = vi.hoisted(() => ({
  dispatchApprovedRunToSlack: vi.fn(),
}));

const responsePackMaybeSingle = vi.fn();
const runMaybeSingle = vi.fn();
const workspaceMaybeSingle = vi.fn();
const responsePackUpdateSingle = vi.fn();
const responsePackUpdate = vi.fn();
const runEventsInsert = vi.fn();

vi.mock("@/lib/auth/workspace", () => ({
  getSessionUser: vi.fn(async () => ({ id: "user_123", email: "reviewer@example.com" })),
  getRunAccess: vi.fn(async () => ({
    run: { workspace_id: "ws_123", case_id: "case_123" },
  })),
}));

vi.mock("@/lib/integrations/slack", () => ({
  SLACK_ACTION_INTENT: "slack.notify",
  ensureSlackDispatchAction: (actions: Array<Record<string, unknown>>) => [
    ...actions,
    {
      label: "Send approved run summary to Slack",
      intent: "slack.notify",
      status: "queued",
      requires_approval: true,
    },
  ],
  dispatchApprovedRunToSlack,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "response_packs") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: responsePackMaybeSingle }),
          }),
          update: (payload: Record<string, unknown>) => {
            responsePackUpdate(payload);
            return {
              eq: () => ({
                select: () => ({ single: responsePackUpdateSingle }),
              }),
            };
          },
        };
      }

      if (table === "runs") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: runMaybeSingle }),
          }),
        };
      }

      if (table === "workspaces") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: workspaceMaybeSingle }),
          }),
        };
      }

      if (table === "run_events") {
        return {
          insert: runEventsInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

import { POST } from "@/app/api/runs/[runId]/approve/route";

describe("POST /api/runs/[runId]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves the pack and records Slack dry-run status", async () => {
    responsePackMaybeSingle.mockResolvedValue({
      data: {
        id: "pack_123",
        run_id: "run_123",
        confidence: 34,
        recommendation: "Escalate to Tier 2",
        escalation_queue: "Tier-2-General",
        approved: false,
        staged_actions: [
          {
            label: "Flag for senior operator review",
            intent: "internal.flag_review",
            status: "queued",
            requires_approval: true,
          },
        ],
      },
      error: null,
    });
    runMaybeSingle.mockResolvedValue({
      data: {
        id: "run_123",
        state: "escalated",
        confidence: 34,
        urgency: "high",
        case: { case_ref: "CASE-123", title: "Payment dispute" },
      },
      error: null,
    });
    dispatchApprovedRunToSlack.mockResolvedValue({
      ok: true,
      status: "dry_run",
      detail: "Slack dispatch simulated in dry-run mode.",
      target: "Slack webhook (dry-run)",
      last_attempt_at: "2026-04-20T01:00:00.000Z",
    });
    workspaceMaybeSingle.mockResolvedValue({
      data: { slug: "acme-support" },
      error: null,
    });
    responsePackUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "pack_123",
        approved: true,
        staged_actions: [
          {
            label: "Flag for senior operator review",
            intent: "internal.flag_review",
            status: "queued",
            requires_approval: true,
          },
          {
            label: "Send approved run summary to Slack",
            intent: "slack.notify",
            status: "queued",
            requires_approval: true,
          },
        ],
      },
      error: null,
    });
    responsePackUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "pack_123",
        approved: true,
      },
      error: null,
    });

    const response = await POST(
      new Request("https://async-copilot.vercel.app/api/runs/run_123/approve"),
      { params: Promise.resolve({ runId: "run_123" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dispatchApprovedRunToSlack).toHaveBeenCalledOnce();
    expect(responsePackUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        approved: true,
        approved_by: "user_123",
        staged_actions: expect.arrayContaining([
          expect.objectContaining({
            intent: "slack.notify",
            status: "queued",
          }),
        ]),
      }),
    );
    expect(responsePackUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        staged_actions: expect.arrayContaining([
          expect.objectContaining({
            intent: "slack.notify",
            status: "dry_run",
            target: "Slack webhook (dry-run)",
          }),
        ]),
      }),
    );
    expect(runEventsInsert).toHaveBeenCalledOnce();
    expect(body.dispatch.status).toBe("dry_run");
  });
});
