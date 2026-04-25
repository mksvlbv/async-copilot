import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchApprovedRunToSlack } = vi.hoisted(() => ({
  dispatchApprovedRunToSlack: vi.fn(),
}));

const responsePackMaybeSingle = vi.fn();
const runMaybeSingle = vi.fn();
const workspaceMaybeSingle = vi.fn();
const responsePackUpdateSingle = vi.fn();
const responsePackUpdate = vi.fn();
const responsePackApprovalsMaybeSingle = vi.fn();
const responsePackApprovalsUpsert = vi.fn();
const runEventsInsert = vi.fn();
const runActionAttemptMaybeSingle = vi.fn();
const runActionAttemptInsert = vi.fn();
const runActionAttemptUpdate = vi.fn();
const runActionAttemptUpdateEqStatus = vi.fn();

vi.mock("@/lib/auth/workspace", () => ({
  getSessionUser: vi.fn(async () => ({ id: "user_123", email: "reviewer@example.com" })),
  getRunAccess: vi.fn(async () => ({
    run: { workspace_id: "ws_123", case_id: "case_123" },
  })),
}));

vi.mock("@/lib/integrations/slack", () => ({
  SLACK_ACTION_INTENT: "slack.notify",
  ensureSlackDispatchAction: (actions: Array<Record<string, unknown>>) => {
    if (actions.some((action) => action.intent === "slack.notify")) {
      return actions;
    }

    return [
      ...actions,
      {
        label: "Send approved run summary to Slack",
        intent: "slack.notify",
        status: "queued",
        requires_approval: true,
      },
    ];
  },
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
                eq: () => ({
                  select: () => ({
                    maybeSingle: responsePackUpdateSingle,
                    single: responsePackUpdateSingle,
                  }),
                }),
                select: () => ({
                  maybeSingle: responsePackUpdateSingle,
                  single: responsePackUpdateSingle,
                }),
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

      if (table === "response_pack_approvals") {
        return {
          upsert: (payload: Record<string, unknown>, options: Record<string, unknown>) => {
            responsePackApprovalsUpsert(payload, options);
            return {
              select: () => ({ maybeSingle: responsePackApprovalsMaybeSingle }),
            };
          },
        };
      }

      if (table === "run_action_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({ maybeSingle: runActionAttemptMaybeSingle }),
                }),
              }),
            }),
          }),
          insert: runActionAttemptInsert,
          update: (payload: Record<string, unknown>) => {
            runActionAttemptUpdate(payload);
            return {
              eq: () => ({
                eq: runActionAttemptUpdateEqStatus,
              }),
            };
          },
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
    responsePackApprovalsMaybeSingle.mockResolvedValue({
      data: {
        id: "approval_123",
        response_pack_id: "pack_123",
      },
      error: null,
    });
    runActionAttemptMaybeSingle.mockResolvedValue({ data: null, error: null });
    runActionAttemptInsert.mockResolvedValue({ error: null });
    runActionAttemptUpdateEqStatus.mockResolvedValue({ error: null });
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
    expect(responsePackApprovalsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        response_pack_id: "pack_123",
        actor_user_id: "user_123",
        actor_label: "reviewer@example.com",
      }),
      expect.objectContaining({
        onConflict: "response_pack_id",
      }),
    );
    expect(runActionAttemptInsert).toHaveBeenCalledOnce();
    expect(runActionAttemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        target: "Slack webhook (dry-run)",
      }),
    );
    expect(body.dispatch.status).toBe("dry_run");
  });

  it("does not redispatch when approval already has a successful Slack attempt", async () => {
    responsePackMaybeSingle.mockResolvedValue({
      data: {
        id: "pack_123",
        run_id: "run_123",
        confidence: 90,
        recommendation: "Ship it",
        escalation_queue: null,
        approved: true,
        staged_actions: [
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
    runMaybeSingle.mockResolvedValue({
      data: {
        id: "run_123",
        state: "completed",
        confidence: 90,
        urgency: "medium",
        case: { case_ref: "CASE-123", title: "Payment dispute" },
      },
      error: null,
    });
    runActionAttemptMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "attempt_123",
        workspace_id: "ws_123",
        run_id: "run_123",
        response_pack_id: "pack_123",
        action_intent: "slack.notify",
        action_label: "Send approved run summary to Slack",
        attempt_no: 1,
        status: "dry_run",
        target: "Slack webhook (dry-run)",
        detail: "Slack dispatch simulated in dry-run mode.",
        idempotency_key: "run_123:slack.notify:1",
        actor_user_id: "user_123",
        attempted_at: "2026-04-20T01:00:00.000Z",
        created_at: "2026-04-20T01:00:00.000Z",
      },
      error: null,
    });
    responsePackUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "pack_123",
        approved: true,
        staged_actions: [
          {
            label: "Send approved run summary to Slack",
            intent: "slack.notify",
            status: "dry_run",
            requires_approval: true,
            target: "Slack webhook (dry-run)",
          },
        ],
      },
      error: null,
    });

    const response = await POST(
      new Request("https://async-copilot.vercel.app/api/runs/run_123/approve"),
      { params: Promise.resolve({ runId: "run_123" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dispatchApprovedRunToSlack).not.toHaveBeenCalled();
    expect(responsePackApprovalsUpsert).not.toHaveBeenCalled();
    expect(runActionAttemptInsert).not.toHaveBeenCalled();
    expect(body.already_approved).toBe(true);
    expect(body.dispatch.status).toBe("dry_run");
  });

  it("retries failed Slack dispatch without duplicating approval history", async () => {
    responsePackMaybeSingle.mockResolvedValue({
      data: {
        id: "pack_123",
        run_id: "run_123",
        confidence: 61,
        recommendation: "Escalate with context",
        escalation_queue: "Tier-2-General",
        approved: true,
        approved_at: "2026-04-20T01:00:00.000Z",
        approved_by: "user_123",
        staged_actions: [
          {
            label: "Send approved run summary to Slack",
            intent: "slack.notify",
            status: "failed",
            requires_approval: true,
            detail: "Slack webhook returned 500.",
            target: "Slack webhook",
          },
        ],
      },
      error: null,
    });
    runMaybeSingle.mockResolvedValue({
      data: {
        id: "run_123",
        state: "escalated",
        confidence: 61,
        urgency: "high",
        case: { case_ref: "CASE-123", title: "Payment dispute" },
      },
      error: null,
    });
    runActionAttemptMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "attempt_123",
        workspace_id: "ws_123",
        run_id: "run_123",
        response_pack_id: "pack_123",
        action_intent: "slack.notify",
        action_label: "Send approved run summary to Slack",
        attempt_no: 1,
        status: "failed",
        target: "Slack webhook",
        detail: "Slack webhook returned 500.",
        idempotency_key: "run_123:slack.notify:1",
        actor_user_id: "user_123",
        attempted_at: "2026-04-20T01:05:00.000Z",
        created_at: "2026-04-20T01:05:00.000Z",
      },
      error: null,
    });
    dispatchApprovedRunToSlack.mockResolvedValue({
      ok: true,
      status: "dry_run",
      detail: "Slack dispatch simulated in dry-run mode.",
      target: "Slack webhook (dry-run)",
      last_attempt_at: "2026-04-20T01:10:00.000Z",
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
            label: "Send approved run summary to Slack",
            intent: "slack.notify",
            status: "dry_run",
            requires_approval: true,
            target: "Slack webhook (dry-run)",
          },
        ],
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
    expect(responsePackApprovalsUpsert).not.toHaveBeenCalled();
    expect(runActionAttemptInsert).toHaveBeenCalledOnce();
    expect(body.retried).toBe(true);
    expect(body.dispatch.status).toBe("dry_run");
  });
});
