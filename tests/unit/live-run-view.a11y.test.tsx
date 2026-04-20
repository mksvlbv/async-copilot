import { describe, it, expect } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { render } from "@testing-library/react";
import { LiveRunView } from "@/features/runs/components/live-run-view";

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

// Mock data for testing
const mockRun = {
  id: "run_123",
  state: "pending",
  urgency: "medium",
  confidence: 75,
  advance_cursor: 0,
  total_stages: 5,
  case: {
    id: "case_123",
    case_ref: "CASE-001",
    title: "Test Case",
    customer_name: "John Doe",
    customer_account: "ACC-001",
    customer_plan: "Premium",
    source: "email",
    body: "This is a test case body for accessibility testing.",
  },
  stages: [
    {
      id: "stage_1",
      run_id: "run_123",
      stage_order: 1,
      stage_key: "ingest",
      stage_label: "Ingest Case",
      state: "completed",
      duration_ms: 18,
      output: { parsed: "text", tokens: 50 },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
    {
      id: "stage_2",
      run_id: "run_123",
      stage_order: 2,
      stage_key: "normalize",
      stage_label: "Normalize Facts",
      state: "pending",
      duration_ms: 45,
      output: {},
      started_at: null,
      completed_at: null,
    },
    {
      id: "stage_3",
      run_id: "run_123",
      stage_order: 3,
      stage_key: "classify",
      stage_label: "Classify Issue & Urgency",
      state: "pending",
      duration_ms: 120,
      output: {},
      started_at: null,
      completed_at: null,
    },
    {
      id: "stage_4",
      run_id: "run_123",
      stage_order: 4,
      stage_key: "query",
      stage_label: "Query Internal State",
      state: "pending",
      duration_ms: 280,
      output: {},
      started_at: null,
      completed_at: null,
    },
    {
      id: "stage_5",
      run_id: "run_123",
      stage_order: 5,
      stage_key: "policy",
      stage_label: "Check Policy & Risk",
      state: "pending",
      duration_ms: 90,
      output: {},
      started_at: null,
      completed_at: null,
    },
  ],
  response_pack: null,
};

describe("LiveRunView accessibility", () => {
  it("should have no accessibility violations when rendered", async () => {
    const { container } = render(<LiveRunView initialRun={mockRun as any} />);
    const results = await axe(container);
    // @ts-expect-error - vitest/jest-axe type conflict
    expect(results).toHaveNoViolations();
  });

  it("should have no accessibility violations in terminal state", async () => {
    const terminalRun = {
      ...mockRun,
      state: "completed",
      advance_cursor: 5,
      response_pack: {
        id: "pack_123",
        run_id: "run_123",
        confidence: 85,
        recommendation: "Send draft reply",
        internal_summary: "Standard resolution path.",
        draft_reply: "Hi John,\n\nThanks for the message. We'll follow up shortly.",
        citations: [
          { source: "Customer message", id: "msg_original", note: "Original ticket body" },
          { source: "Internal signals", id: "sig_default", note: "Baseline internal checks" },
        ],
        staged_actions: [
          {
            id: "action_1",
            run_id: "run_123",
            label: "Send draft reply",
            intent: "email.send",
            status: "queued",
            requires_approval: true,
            detail: null,
            target: null,
            last_attempt_at: null,
          },
        ],
        escalation_queue: null,
        approved: false,
        approved_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const { container } = render(<LiveRunView initialRun={terminalRun as any} />);
    const results = await axe(container);
    // @ts-expect-error - vitest/jest-axe type conflict
    expect(results).toHaveNoViolations();
  });
});