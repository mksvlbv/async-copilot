import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveRunView } from "@/features/runs/components/live-run-view";

const completedRun = {
  id: "run_approval_123",
  workspace_id: "ws_123",
  case_id: "case_123",
  created_by: "user_123",
  state: "completed",
  confidence: 84,
  urgency: "medium",
  started_at: "2026-04-25T08:00:00.000Z",
  completed_at: "2026-04-25T08:05:00.000Z",
  last_advanced_at: "2026-04-25T08:05:00.000Z",
  advance_cursor: 6,
  total_stages: 6,
  execution_status: "completed",
  execution_attempts: 0,
  execution_next_retry_at: null,
  execution_lease_expires_at: null,
  execution_claim_token: null,
  execution_last_error: null,
  created_at: "2026-04-25T08:00:00.000Z",
  updated_at: "2026-04-25T08:05:00.000Z",
  case: {
    id: "case_123",
    workspace_id: "ws_123",
    case_ref: "CASE-123",
    title: "Payment dispute",
    body: "Customer reported a duplicate payment.",
    source: "gmail",
    gmail_message_id: "gmail_row_1",
    sample_id: null,
    created_by: "user_123",
    customer_name: "Jane Doe",
    customer_account: "Acme Corp",
    customer_plan: "Premium",
    created_at: "2026-04-25T08:00:00.000Z",
    updated_at: "2026-04-25T08:00:00.000Z",
    gmail_message: null,
  },
  stages: [
    {
      id: "stage_1",
      run_id: "run_approval_123",
      stage_order: 1,
      stage_key: "ingest",
      stage_label: "Ingest Case",
      state: "completed",
      duration_ms: 10,
      output: {},
      started_at: "2026-04-25T08:00:00.000Z",
      completed_at: "2026-04-25T08:00:01.000Z",
      created_at: "2026-04-25T08:00:00.000Z",
      updated_at: "2026-04-25T08:00:01.000Z",
    },
  ],
  response_pack: {
    id: "pack_123",
    run_id: "run_approval_123",
    confidence: 84,
    recommendation: "Escalate with a verified payment timeline.",
    internal_summary: "Customer was charged twice after a billing retry.",
    draft_reply: "Hi Jane, we are reviewing the duplicate payment timeline now.",
    citations: [],
    staged_actions: [
      {
        label: "Send approved run summary to Slack",
        intent: "slack.notify",
        status: "dry_run",
        requires_approval: true,
        detail: "Slack dispatch simulated in dry-run mode.",
        target: "Slack webhook (dry-run)",
        last_attempt_at: "2026-04-25T08:07:00.000Z",
        attempt_count: 1,
      },
    ],
    escalation_queue: "Tier-2-General",
    approved: true,
    approved_at: "2026-04-25T08:06:00.000Z",
    approved_by: "user_123",
    created_at: "2026-04-25T08:05:00.000Z",
    updated_at: "2026-04-25T08:07:00.000Z",
  },
  events: [
    {
      id: 1,
      workspace_id: "ws_123",
      case_id: "case_123",
      run_id: "run_approval_123",
      event_type: "response_pack.approved",
      actor_type: "user",
      actor_user_id: "user_123",
      stage_key: null,
      payload: {
        actor_label: "reviewer@example.com",
        summary: "Response pack approved for outbound action.",
      },
      created_at: "2026-04-25T08:06:00.000Z",
    },
  ],
  action_attempts: [
    {
      id: "attempt_1",
      workspace_id: "ws_123",
      run_id: "run_approval_123",
      response_pack_id: "pack_123",
      action_intent: "slack.notify",
      action_label: "Send approved run summary to Slack",
      attempt_no: 1,
      status: "dry_run",
      target: "Slack webhook (dry-run)",
      detail: "Slack dispatch simulated in dry-run mode.",
      idempotency_key: "run_approval_123:slack.notify:1",
      actor_user_id: "user_123",
      attempted_at: "2026-04-25T08:07:00.000Z",
      created_at: "2026-04-25T08:07:00.000Z",
    },
  ],
  approval_history: [
    {
      id: "approval_1",
      workspace_id: "ws_123",
      run_id: "run_approval_123",
      response_pack_id: "pack_123",
      actor_user_id: "user_123",
      actor_label: "reviewer@example.com",
      approved_at: "2026-04-25T08:06:00.000Z",
      created_at: "2026-04-25T08:06:00.000Z",
    },
  ],
};

describe("LiveRunView approval history", () => {
  it("renders approval history alongside the action log", () => {
    render(
      <LiveRunView
        initialRun={completedRun as any}
        workspaceSlug="acme-support"
        currentRole="reviewer"
      />,
    );

    expect(screen.getByText("Approval History")).toBeTruthy();
    expect(screen.getByText("reviewer@example.com")).toBeTruthy();
    expect(screen.getByText("2026-04-25 08:06 UTC")).toBeTruthy();
    expect(screen.getByText("Action Log")).toBeTruthy();
    expect(screen.getByText("Attempt #1")).toBeTruthy();
  });
});
