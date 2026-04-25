import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveRunView } from "@/features/runs/components/live-run-view";

function buildRun(
  events: Array<Record<string, unknown>>,
  stageOverrides?: Array<Record<string, unknown>>,
) {
  const stages = [
    {
      id: "stage_1",
      run_id: "run_pack_provenance_123",
      stage_order: 1,
      stage_key: "ingest",
      stage_label: "Ingest Case",
      state: "completed",
      duration_ms: 18,
      output: { parsed: "text" },
      started_at: "2026-04-25T08:00:00.000Z",
      completed_at: "2026-04-25T08:00:01.000Z",
      created_at: "2026-04-25T08:00:00.000Z",
      updated_at: "2026-04-25T08:00:01.000Z",
    },
    {
      id: "stage_2",
      run_id: "run_pack_provenance_123",
      stage_order: 2,
      stage_key: "normalize",
      stage_label: "Normalize Facts",
      state: "completed",
      duration_ms: 42,
      output: { entities_extracted: ["amount"] },
      started_at: "2026-04-25T08:00:01.000Z",
      completed_at: "2026-04-25T08:00:02.000Z",
      created_at: "2026-04-25T08:00:01.000Z",
      updated_at: "2026-04-25T08:00:02.000Z",
    },
    {
      id: "stage_3",
      run_id: "run_pack_provenance_123",
      stage_order: 3,
      stage_key: "draft",
      stage_label: "Draft Response Pack",
      state: "completed",
      duration_ms: 120,
      output: { generated: true },
      started_at: "2026-04-25T08:00:02.000Z",
      completed_at: "2026-04-25T08:00:03.000Z",
      created_at: "2026-04-25T08:00:02.000Z",
      updated_at: "2026-04-25T08:00:03.000Z",
    },
  ].map((stage, index) => ({
    ...stage,
    ...(stageOverrides?.[index] ?? {}),
  }));

  return {
    id: "run_pack_provenance_123",
    workspace_id: "ws_123",
    case_id: "case_123",
    created_by: "user_123",
    state: "completed",
    confidence: 84,
    urgency: "high",
    started_at: "2026-04-25T08:00:00.000Z",
    completed_at: "2026-04-25T08:05:00.000Z",
    last_advanced_at: "2026-04-25T08:05:00.000Z",
    advance_cursor: 3,
    total_stages: 3,
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
      body: "Customer reported a duplicate charge after a billing retry.",
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
    stages,
    response_pack: {
      id: "pack_123",
      run_id: "run_pack_provenance_123",
      confidence: 84,
      recommendation: "Escalate with a verified billing timeline.",
      internal_summary: "Customer was charged twice after a retry sequence.",
      draft_reply: "Hi Jane, we are reviewing the duplicate charge timeline now.",
      citations: [],
      staged_actions: [],
      escalation_queue: "Tier-2-General",
      approved: false,
      approved_at: null,
      approved_by: null,
      created_at: "2026-04-25T08:05:00.000Z",
      updated_at: "2026-04-25T08:05:00.000Z",
    },
    events: events.map((eventItem, index) => ({
      id: index + 1,
      workspace_id: "ws_123",
      case_id: "case_123",
      run_id: "run_pack_provenance_123",
      actor_user_id: null,
      ...eventItem,
    })),
    action_attempts: [],
    approval_history: [],
  };
}

describe("LiveRunView response pack provenance", () => {
  it("renders pack-level lineage, execution summary, timing evidence, and trust signals", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildRun([
          {
            event_type: "stage.completed",
            actor_type: "system",
            stage_key: "ingest",
            payload: {
              stage_order: 1,
              stage_label: "Ingest Case",
              prompt_key: "triage.ingest",
              prompt_version: "v1",
              provider: "groq",
              model: "llama-3.3-70b-versatile",
              execution_mode: "ai",
              fallback_reason: null,
              parse_error: false,
            },
            created_at: "2026-04-25T08:00:01.000Z",
          },
          {
            event_type: "stage.completed",
            actor_type: "system",
            stage_key: "normalize",
            payload: {
              stage_order: 2,
              stage_label: "Normalize Facts",
              prompt_key: "triage.normalize",
              prompt_version: "v1",
              provider: null,
              model: null,
              execution_mode: "synthetic",
              fallback_reason: "ai_disabled",
              parse_error: false,
            },
            created_at: "2026-04-25T08:00:02.000Z",
          },
          {
            event_type: "stage.completed",
            actor_type: "system",
            stage_key: "draft",
            payload: {
              stage_order: 3,
              stage_label: "Draft Response Pack",
              prompt_key: "triage.draft",
              prompt_version: "v1",
              provider: "groq",
              model: "llama-3.3-70b-versatile",
              execution_mode: "ai",
              fallback_reason: null,
              parse_error: true,
            },
            created_at: "2026-04-25T08:00:03.000Z",
          },
          {
            event_type: "response_pack.created",
            actor_type: "system",
            stage_key: null,
            payload: {
              summary: "Response pack persisted for review.",
              confidence: 84,
            },
            created_at: "2026-04-25T08:04:00.000Z",
          },
        ], [{}, {}, { completed_at: "2026-04-25T08:00:04.500Z", updated_at: "2026-04-25T08:00:04.500Z" }]) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Pack Provenance");
    expect(markup).toContain("2026-04-25 08:04 UTC");
    expect(markup).toContain("Mixed execution · 2 AI · 1 synthetic");
    expect(markup).toContain("Timing");
    expect(markup).toContain("4.5s active stage time · slowest Draft Response Pack (2.5s)");
    expect(markup).toContain("1 synthetic fallback stage · 1 parse warning");
    expect(markup).not.toContain("No provenance");
    expect(markup).not.toContain("120ms active stage time");
  });

  it("falls back gracefully for historical runs without stage provenance", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildRun([]) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Pack Provenance");
    expect(markup).toContain("2026-04-25 08:05 UTC");
    expect(markup).toContain(
      "Stage lineage recorded; runtime provenance unavailable for this historical run",
    );
    expect(markup).toContain("3.0s active stage time · slowest Ingest Case (1.0s)");
    expect(markup).toContain("Ingest Case");
    expect(markup).toContain("Normalize Facts");
    expect(markup).toContain("Draft Response Pack");
    expect(markup).not.toContain("No provenance");
  });

  it("omits timing evidence when completed stages do not have valid timestamp pairs", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildRun([], [
          { started_at: null, completed_at: null, updated_at: "2026-04-25T08:00:01.000Z" },
          { started_at: null, completed_at: null, updated_at: "2026-04-25T08:00:02.000Z" },
          { started_at: null, completed_at: null, updated_at: "2026-04-25T08:00:03.000Z" },
        ]) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Pack Provenance");
    expect(markup).not.toContain("active stage time");
    expect(markup).not.toContain("slowest ");
  });

  it("summarizes partial runtime provenance without noisy missing-stage badges", () => {
    const markup = renderToStaticMarkup(
      createElement(LiveRunView, {
        initialRun: buildRun([
          {
            event_type: "stage.completed",
            actor_type: "system",
            stage_key: "ingest",
            payload: {
              stage_order: 1,
              stage_label: "Ingest Case",
              prompt_key: "triage.ingest",
              prompt_version: "v1",
              provider: "groq",
              model: "llama-3.3-70b-versatile",
              execution_mode: "ai",
              fallback_reason: null,
              parse_error: false,
            },
            created_at: "2026-04-25T08:00:01.000Z",
          },
          {
            event_type: "stage.completed",
            actor_type: "system",
            stage_key: "draft",
            payload: {
              stage_order: 3,
              stage_label: "Draft Response Pack",
              prompt_key: "triage.draft",
              prompt_version: "v1",
              provider: "groq",
              model: "llama-3.3-70b-versatile",
              execution_mode: "ai",
              fallback_reason: null,
              parse_error: false,
            },
            created_at: "2026-04-25T08:00:03.000Z",
          },
          {
            event_type: "response_pack.created",
            actor_type: "system",
            stage_key: null,
            payload: {
              summary: "Response pack persisted for review.",
              confidence: 84,
            },
            created_at: "2026-04-25T08:04:00.000Z",
          },
        ]) as any,
        workspaceSlug: "acme-support",
        currentRole: "reviewer",
      }),
    );

    expect(markup).toContain("Partial runtime provenance · 2/3 stages recorded");
    expect(markup).toContain("Ingest Case");
    expect(markup).toContain("Normalize Facts");
    expect(markup).toContain("Draft Response Pack");
    expect(markup).not.toContain("No provenance");
  });
});
