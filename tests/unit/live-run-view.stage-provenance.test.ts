import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveRunView } from "@/features/runs/components/live-run-view";

function buildCompletedRun(
  eventPayload: Record<string, unknown>,
  stageOverrides?: Record<string, unknown>,
) {
  const stage = {
    id: "stage_1",
    run_id: "run_stage_123",
    stage_order: 1,
    stage_key: "ingest",
    stage_label: "Ingest Case",
    state: "completed",
    duration_ms: 18,
    output: { parsed: "text", tokens: 50 },
    started_at: "2026-04-25T08:00:00.000Z",
    completed_at: "2026-04-25T08:00:01.000Z",
    created_at: "2026-04-25T08:00:00.000Z",
    updated_at: "2026-04-25T08:00:01.000Z",
    ...(stageOverrides ?? {}),
  };

  return {
    id: "run_stage_123",
    workspace_id: "ws_123",
    case_id: "case_123",
    created_by: "user_123",
    state: "completed",
    confidence: 82,
    urgency: "medium",
    started_at: "2026-04-25T08:00:00.000Z",
    completed_at: "2026-04-25T08:03:00.000Z",
    last_advanced_at: "2026-04-25T08:03:00.000Z",
    advance_cursor: 1,
    total_stages: 1,
    execution_status: "completed",
    execution_attempts: 0,
    execution_next_retry_at: null,
    execution_lease_expires_at: null,
    execution_claim_token: null,
    execution_last_error: null,
    created_at: "2026-04-25T08:00:00.000Z",
    updated_at: "2026-04-25T08:03:00.000Z",
    case: {
      id: "case_123",
      workspace_id: "ws_123",
      case_ref: "CASE-123",
      title: "Payment dispute",
      body: "Customer reported a duplicate charge.",
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
      stage,
    ],
    response_pack: null,
    events: [
      {
        id: 1,
        workspace_id: "ws_123",
        case_id: "case_123",
        run_id: "run_stage_123",
        event_type: "stage.completed",
        actor_type: "system",
        actor_user_id: null,
        stage_key: "ingest",
        payload: {
          summary: "Completed Ingest Case.",
          stage_order: 1,
          stage_label: "Ingest Case",
          duration_ms: 18,
          ...eventPayload,
        },
        created_at: "2026-04-25T08:00:01.000Z",
      },
    ],
    action_attempts: [],
    approval_history: [],
  };
}

describe("LiveRunView stage provenance", () => {
  it("renders AI prompt provenance and parse warnings inside the completed stage card", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildCompletedRun({
          prompt_key: "triage.ingest",
          prompt_version: "v1",
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          execution_mode: "ai",
          fallback_reason: null,
          parse_error: true,
        }) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Provenance");
    expect(markup).toContain("triage.ingest · v1");
    expect(markup).toContain("groq · llama-3.3-70b-versatile");
    expect(markup).toContain("1.0s");
    expect(markup).not.toContain("18 ms");
    expect(markup).toContain("Model returned non-JSON output; raw stage output was kept for review.");
  });

  it("renders synthetic fallback provenance when AI is unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildCompletedRun({
          prompt_key: "triage.ingest",
          prompt_version: "v1",
          provider: null,
          model: null,
          execution_mode: "synthetic",
          fallback_reason: "ai_disabled",
          parse_error: false,
        }) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Synthetic fallback");
    expect(markup).toContain("Synthetic fallback · AI unavailable in this environment");
  });

  it("ignores provenance events when stage order does not match", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildCompletedRun({
          prompt_key: "triage.ingest",
          prompt_version: "v1",
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          execution_mode: "ai",
          fallback_reason: null,
          parse_error: false,
          stage_order: 99,
        }) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).not.toContain("Provenance");
    expect(markup).not.toContain("triage.ingest · v1");
  });

  it("falls back to estimated duration labeling when timestamps are unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildCompletedRun(
          {
            prompt_key: "triage.ingest",
            prompt_version: "v1",
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            execution_mode: "ai",
            fallback_reason: null,
            parse_error: false,
          },
          {
            started_at: null,
            completed_at: null,
          },
        ) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("est. 18ms");
  });
});
