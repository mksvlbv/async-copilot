import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchApprovedRunToSlack,
  ensureSlackDispatchAction,
  SLACK_ACTION_INTENT,
} from "@/lib/integrations/slack";

describe("slack integration helpers", () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...env };
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_DRY_RUN;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("adds a Slack action once", () => {
    const actions = ensureSlackDispatchAction(
      [
        {
          label: "Send draft reply",
          intent: "email.send",
          status: "queued",
          requires_approval: true,
        },
      ],
      "Tier-2-General",
    );

    expect(actions).toHaveLength(2);
    expect(actions.at(-1)?.intent).toBe(SLACK_ACTION_INTENT);

    const deduped = ensureSlackDispatchAction(actions, "Tier-2-General");
    expect(deduped).toHaveLength(2);
  });

  it("simulates Slack dispatch when no webhook is configured", async () => {
    const result = await dispatchApprovedRunToSlack({
      runId: "run_123",
      runState: "escalated",
      confidence: 34,
      urgency: "high",
      caseRef: "CASE-123",
      caseTitle: "Payment dispute",
      recommendation: "Escalate to Tier 2",
      escalationQueue: "Tier-2-General",
      runUrl: "https://async-copilot.vercel.app/app/runs/run_123",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("dry_run");
    expect(result.detail).toContain("simulated");
  });

  it("sends a real webhook when dry-run is disabled", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/demo";
    process.env.SLACK_WEBHOOK_DRY_RUN = "false";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchApprovedRunToSlack({
      runId: "run_123",
      runState: "completed",
      confidence: 92,
      urgency: "medium",
      caseRef: "CASE-123",
      caseTitle: "Payment dispute",
      recommendation: "Send the approved reply",
      escalationQueue: null,
      runUrl: "https://async-copilot.vercel.app/app/runs/run_123",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.status).toBe("executed");
  });

  it("retries transient 5xx webhook responses", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/demo";
    process.env.SLACK_WEBHOOK_DRY_RUN = "false";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: vi.fn(async () => "temporarily unavailable") })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchApprovedRunToSlack({
      runId: "run_123",
      runState: "completed",
      confidence: 92,
      urgency: "medium",
      caseRef: "CASE-123",
      caseTitle: "Payment dispute",
      recommendation: "Send the approved reply",
      escalationQueue: null,
      runUrl: "https://async-copilot.vercel.app/app/runs/run_123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("executed");
  });
});
