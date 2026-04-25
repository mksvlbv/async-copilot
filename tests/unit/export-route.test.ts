import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const query = {
  eq: vi.fn(() => query),
  order: vi.fn(() => query),
  maybeSingle,
};
const select = vi.fn(() => query);
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/auth/workspace", () => ({
  getSessionUser: vi.fn(async () => ({ id: "user_123", email: "reviewer@example.com" })),
  getRunAccess: vi.fn(async () => ({
    run: { workspace_id: "ws_123" },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

import { GET } from "@/app/api/runs/[runId]/export/route";

function buildReadyExportData() {
  return {
    id: "run_123",
    state: "completed",
    confidence: 84,
    urgency: "high",
    started_at: "2026-04-25T08:00:00.000Z",
    completed_at: "2026-04-25T08:05:00.000Z",
    case: {
      id: "case_123",
      case_ref: "CASE-123",
      title: "Payment dispute",
      customer_name: "Jane Doe",
      customer_account: "Acme Corp",
      customer_plan: "Premium",
      sample: [
        {
          slug: "golden-billing-case",
          name: "Golden Billing Case",
          urgency: "high",
          is_golden: true,
          expected_confidence: 84,
          expected_stages: [
            { key: "ingest", label: "Ingest Case", duration_ms: 18 },
            { key: "normalize", label: "Normalize Facts", duration_ms: 42 },
            { key: "draft", label: "Draft Response Pack", duration_ms: 120 },
          ],
        },
      ],
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
        output: { parsed: "text" },
        started_at: "2026-04-25T08:00:00.000Z",
        completed_at: "2026-04-25T08:00:01.000Z",
        created_at: "2026-04-25T08:00:00.000Z",
        updated_at: "2026-04-25T08:00:01.000Z",
      },
      {
        id: "stage_2",
        run_id: "run_123",
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
        run_id: "run_123",
        stage_order: 3,
        stage_key: "draft",
        stage_label: "Draft Response Pack",
        state: "completed",
        duration_ms: 120,
        output: { generated: true },
        started_at: "2026-04-25T08:00:02.000Z",
        completed_at: "2026-04-25T08:00:04.500Z",
        created_at: "2026-04-25T08:00:02.000Z",
        updated_at: "2026-04-25T08:00:04.500Z",
      },
    ],
    events: [
      {
        id: 1,
        workspace_id: "ws_123",
        case_id: "case_123",
        run_id: "run_123",
        event_type: "stage.completed",
        actor_type: "system",
        actor_user_id: null,
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
        id: 2,
        workspace_id: "ws_123",
        case_id: "case_123",
        run_id: "run_123",
        event_type: "stage.completed",
        actor_type: "system",
        actor_user_id: null,
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
        id: 3,
        workspace_id: "ws_123",
        case_id: "case_123",
        run_id: "run_123",
        event_type: "stage.completed",
        actor_type: "system",
        actor_user_id: null,
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
        created_at: "2026-04-25T08:00:04.500Z",
      },
      {
        id: 4,
        workspace_id: "ws_123",
        case_id: "case_123",
        run_id: "run_123",
        event_type: "response_pack.created",
        actor_type: "system",
        actor_user_id: null,
        stage_key: null,
        payload: {
          summary: "Response pack persisted for review.",
          confidence: 84,
        },
        created_at: "2026-04-25T08:05:00.000Z",
      },
    ],
    action_attempts: [
      {
        id: "attempt_123",
        workspace_id: "ws_123",
        run_id: "run_123",
        response_pack_id: "pack_123",
        action_intent: "slack.notify",
        action_label: "Notify escalation channel",
        attempt_no: 1,
        status: "executed",
        target: "#tier2-payments",
        detail: "Slack webhook delivered.",
        idempotency_key: "idem_123",
        actor_user_id: "user_123",
        attempted_at: "2026-04-25T08:06:00.000Z",
        created_at: "2026-04-25T08:06:00.000Z",
      },
    ],
    approval_history: [
      {
        id: "approval_123",
        workspace_id: "ws_123",
        run_id: "run_123",
        response_pack_id: "pack_123",
        actor_user_id: "user_123",
        actor_label: "Jane Reviewer",
        approved_at: "2026-04-25T08:05:30.000Z",
        created_at: "2026-04-25T08:05:30.000Z",
      },
    ],
    response_pack: [
      {
        id: "pack_123",
        run_id: "run_123",
        confidence: 84,
        recommendation: "Escalate with a verified billing timeline.",
        internal_summary: "Customer was charged twice after a retry sequence.",
        draft_reply: "Hi Jane, we are reviewing the duplicate charge timeline now.",
        citations: [],
        staged_actions: [
          {
            label: "Notify escalation channel",
            intent: "slack.notify",
            status: "executed",
            requires_approval: true,
          },
        ],
        escalation_queue: "Tier-2-General",
        approved: true,
        approved_at: "2026-04-25T08:05:30.000Z",
        approved_by: "user_123",
        created_at: "2026-04-25T08:05:00.000Z",
        updated_at: "2026-04-25T08:06:00.000Z",
      },
    ],
  };
}

function buildFullGoldenDriftData() {
  const data = buildReadyExportData();
  data.case.sample = [
    {
      slug: "golden-billing-case",
      name: "Golden Billing Case",
      urgency: "high",
      is_golden: true,
      expected_confidence: 91,
      expected_stages: [
        { key: "ingest", label: "Ingest Case", duration_ms: 18 },
        { key: "classify", label: "Classify Issue & Urgency", duration_ms: 42 },
        { key: "draft", label: "Draft Response Pack", duration_ms: 120 },
      ],
    },
  ];
  data.stages = data.stages.map((stage) => ({
    ...stage,
    started_at: null,
    completed_at: null,
  }));
  data.stages[1].duration_ms = 99;
  data.urgency = "medium";
  data.response_pack[0].staged_actions = [
    {
      label: "Notify escalation channel",
      intent: "slack.notify",
      status: "executed",
      requires_approval: false,
    },
  ];

  return data;
}

function buildDurationOnlyDriftData() {
  const data = buildReadyExportData();
  data.stages[1].duration_ms = 99;
  return data;
}

function buildNonGoldenExportData() {
  const data = buildReadyExportData();
  data.case.sample = [
    {
      slug: "non-golden-billing-case",
      name: "Non-Golden Billing Case",
      urgency: "high",
      is_golden: false,
      expected_confidence: 84,
      expected_stages: [
        { key: "ingest", label: "Ingest Case", duration_ms: 18 },
        { key: "normalize", label: "Normalize Facts", duration_ms: 42 },
        { key: "draft", label: "Draft Response Pack", duration_ms: 120 },
      ],
    },
  ];
  return data;
}

describe("GET /api/runs/[runId]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select });
    select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
  });

  it("returns 409 markdown text when the response pack is not ready", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "run_123",
        state: "pending",
        confidence: null,
        urgency: null,
        started_at: null,
        completed_at: null,
        case: null,
        response_pack: null,
      },
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=markdown");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    await expect(response.text()).resolves.toContain("Response pack not available");
  });

  it("returns JSON 409 when the caller asks for json and no pack exists", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "run_123",
        state: "pending",
        confidence: null,
        urgency: null,
        started_at: null,
        completed_at: null,
        case: null,
        response_pack: null,
      },
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=json");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "No response pack — run not completed" });
  });

  it("returns json export with portable trust evidence", async () => {
    maybeSingle.mockResolvedValue({
      data: buildReadyExportData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=json");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      run: {
        id: "run_123",
        state: "completed",
      },
      pack: {
        approved: true,
      },
      evidence: {
        pack_lineage: {
          execution_summary: "Mixed execution · 2 AI · 1 synthetic",
          timing_summary: "4.5s active stage time · slowest Draft Response Pack (2.5s)",
          signals_summary: "1 synthetic fallback stage · 1 parse warning",
        },
        golden_assertions: [
          {
            key: "stage_template",
            passed: true,
            detail: "3/3 stages matched the configured golden template",
          },
          {
            key: "stage_duration_profile",
            passed: true,
            detail: "3/3 stage durations matched the configured golden template",
          },
          {
            key: "confidence",
            passed: true,
            detail: "Expected 84% and exported 84%",
          },
          {
            key: "urgency",
            passed: true,
            detail: "Expected high and exported high",
          },
          {
            key: "timing_evidence",
            passed: true,
            detail: "4.5s active stage time · slowest Draft Response Pack (2.5s)",
          },
          {
            key: "slack_approval_boundary",
            passed: true,
            detail: "Notify escalation channel remains approval-gated",
          },
        ],
        approval_history: [
          {
            actor_label: "Jane Reviewer",
            approved_at: "2026-04-25T08:05:30.000Z",
          },
        ],
        action_log: [
          {
            action_label: "Notify escalation channel",
            status: "executed",
            idempotency_key: "idem_123",
          },
        ],
      },
    });
  });

  it("returns markdown export with trust evidence sections", async () => {
    maybeSingle.mockResolvedValue({
      data: buildReadyExportData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=markdown");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");

    const text = await response.text();
    expect(text).toContain("## Trust evidence");
    expect(text).toContain("- **Timing:** 4.5s active stage time · slowest Draft Response Pack (2.5s)");
    expect(text).toContain("### Stage lineage");
    expect(text).toContain("### Golden trust assertions");
    expect(text).toContain("[PASS] **Golden stage template matched:** 3/3 stages matched the configured golden template");
    expect(text).toContain("[PASS] **Golden stage duration template matched:** 3/3 stage durations matched the configured golden template");
    expect(text).toContain("[PASS] **Golden confidence matched:** Expected 84% and exported 84%");
    expect(text).toContain("[PASS] **Golden urgency matched:** Expected high and exported high");
    expect(text).toContain("[PASS] **Slack approval boundary preserved:** Notify escalation channel remains approval-gated");
    expect(text).toContain("- 01 Ingest Case — AI");
    expect(text).toContain("- 02 Normalize Facts — Synthetic fallback");
    expect(text).toContain("### Approval history");
    expect(text).toContain("Jane Reviewer");
    expect(text).toContain("### Action log");
    expect(text).toContain("Idempotency key: idem_123");
  });

  it("returns text export with golden trust assertions", async () => {
    maybeSingle.mockResolvedValue({
      data: buildReadyExportData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=text");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("Trust evidence:");
    expect(text).toContain("Golden trust assertions:");
    expect(text).toContain("[PASS] Golden stage template matched: 3/3 stages matched the configured golden template");
    expect(text).toContain("[PASS] Golden stage duration template matched: 3/3 stage durations matched the configured golden template");
    expect(text).toContain("[PASS] Golden confidence matched: Expected 84% and exported 84%");
    expect(text).toContain("[PASS] Golden urgency matched: Expected high and exported high");
    expect(text).toContain("[PASS] Slack approval boundary preserved: Notify escalation channel remains approval-gated");
  });

  it("returns failing golden assertions when the exported run drifts from the configured golden contract", async () => {
    const data = buildFullGoldenDriftData();

    maybeSingle.mockResolvedValue({
      data,
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=json");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      evidence: {
        golden_assertions: [
          {
            key: "stage_template",
            passed: false,
            detail: "Expected stage 2 classify, recorded normalize",
          },
          {
            key: "stage_duration_profile",
            passed: false,
            detail:
              "Golden stage duration template could not be verified until the stage template matches (Expected stage 2 classify, recorded normalize)",
          },
          {
            key: "confidence",
            passed: false,
            detail: "Expected 91% and exported 84%",
          },
          {
            key: "urgency",
            passed: false,
            detail: "Expected high and exported medium",
          },
          {
            key: "timing_evidence",
            passed: false,
            detail: "No timing summary was present in the exported trust evidence",
          },
          {
            key: "slack_approval_boundary",
            passed: false,
            detail: "Notify escalation channel no longer requires approval",
          },
        ],
      },
    });
  });

  it("returns markdown export with failing golden assertion lines when the configured golden contract drifts", async () => {
    maybeSingle.mockResolvedValue({
      data: buildFullGoldenDriftData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=markdown");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");

    const text = await response.text();
    expect(text).toContain("### Golden trust assertions");
    expect(text).toContain("[FAIL] **Golden stage template matched:** Expected stage 2 classify, recorded normalize");
    expect(text).toContain("[FAIL] **Golden stage duration template matched:** Golden stage duration template could not be verified until the stage template matches (Expected stage 2 classify, recorded normalize)");
    expect(text).toContain("[FAIL] **Golden confidence matched:** Expected 91% and exported 84%");
    expect(text).toContain("[FAIL] **Golden urgency matched:** Expected high and exported medium");
    expect(text).toContain("[FAIL] **Timing evidence recorded:** No timing summary was present in the exported trust evidence");
    expect(text).toContain("[FAIL] **Slack approval boundary preserved:** Notify escalation channel no longer requires approval");
  });

  it("returns text export with failing golden assertion lines when the configured golden contract drifts", async () => {
    maybeSingle.mockResolvedValue({
      data: buildFullGoldenDriftData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=text");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("Golden trust assertions:");
    expect(text).toContain("[FAIL] Golden stage template matched: Expected stage 2 classify, recorded normalize");
    expect(text).toContain("[FAIL] Golden stage duration template matched: Golden stage duration template could not be verified until the stage template matches (Expected stage 2 classify, recorded normalize)");
    expect(text).toContain("[FAIL] Golden confidence matched: Expected 91% and exported 84%");
    expect(text).toContain("[FAIL] Golden urgency matched: Expected high and exported medium");
    expect(text).toContain("[FAIL] Timing evidence recorded: No timing summary was present in the exported trust evidence");
    expect(text).toContain("[FAIL] Slack approval boundary preserved: Notify escalation channel no longer requires approval");
  });

  it("omits golden assertion evidence for non-golden exports", async () => {
    const data = buildNonGoldenExportData();
    maybeSingle.mockResolvedValue({
      data,
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=json");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      evidence: {
        golden_assertions: null,
      },
    });
  });

  it("omits golden assertion sections in markdown export for non-golden runs", async () => {
    maybeSingle.mockResolvedValue({
      data: buildNonGoldenExportData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=markdown");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");

    const text = await response.text();
    expect(text).toContain("## Trust evidence");
    expect(text).not.toContain("### Golden trust assertions");
    expect(text).not.toContain("Golden stage template matched");
  });

  it("omits golden assertion sections in text export for non-golden runs", async () => {
    maybeSingle.mockResolvedValue({
      data: buildNonGoldenExportData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=text");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("Trust evidence:");
    expect(text).not.toContain("Golden trust assertions:");
    expect(text).not.toContain("Golden stage template matched");
  });

  it("returns a failing duration-template assertion when stage timing drifts but the golden stage template still matches", async () => {
    const data = buildDurationOnlyDriftData();

    maybeSingle.mockResolvedValue({
      data,
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=json");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      evidence: {
        golden_assertions: expect.arrayContaining([
          expect.objectContaining({
            key: "stage_template",
            passed: true,
            detail: "3/3 stages matched the configured golden template",
          }),
          expect.objectContaining({
            key: "stage_duration_profile",
            passed: false,
            detail: "Expected stage 2 normalize duration 42ms, recorded 99ms",
          }),
        ]),
      },
    });
  });

  it("returns markdown export with a failing duration-template assertion when stage timing drifts but the golden stage template still matches", async () => {
    maybeSingle.mockResolvedValue({
      data: buildDurationOnlyDriftData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=markdown");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");

    const text = await response.text();
    expect(text).toContain("### Golden trust assertions");
    expect(text).toContain("[PASS] **Golden stage template matched:** 3/3 stages matched the configured golden template");
    expect(text).toContain("[FAIL] **Golden stage duration template matched:** Expected stage 2 normalize duration 42ms, recorded 99ms");
  });

  it("returns text export with a failing duration-template assertion when stage timing drifts but the golden stage template still matches", async () => {
    maybeSingle.mockResolvedValue({
      data: buildDurationOnlyDriftData(),
      error: null,
    });

    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/export?format=text");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("Golden trust assertions:");
    expect(text).toContain("[PASS] Golden stage template matched: 3/3 stages matched the configured golden template");
    expect(text).toContain("[FAIL] Golden stage duration template matched: Expected stage 2 normalize duration 42ms, recorded 99ms");
  });
});
