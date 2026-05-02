import { SLACK_ACTION_INTENT } from "@/lib/integrations/slack";
import type {
  CaseSource,
  GmailMessage,
  RunEvent,
  RunStage,
  RunWithDetails,
  Sample,
  UrgencyLevel,
  WorkspaceMembershipWithWorkspace,
} from "@/lib/supabase/types";

export type VisualRunVariant = "running" | "completed" | "escalated";

export type VisualSimilarCase = {
  id: string;
  case_ref: string;
  title: string;
  body: string;
  similarity: number;
};

export type VisualRunsTableRow = {
  id: string;
  state: RunWithDetails["state"];
  confidence: number | null;
  urgency: UrgencyLevel | null;
  created_at: string;
  advance_cursor: number;
  total_stages: number;
  case: {
    case_ref: string;
    title: string;
    customer_name: string | null;
    source: CaseSource;
  } | null;
};

const WORKSPACE_ID = "ws_visual_123";
const WORKSPACE_CREATED_AT = "2026-04-25T08:00:00.000Z";
const USER_ID = "user_visual_123";

export const VISUAL_WORKSPACE_SLUG = "visual-ops";
export const VISUAL_WORKSPACE_NAME = "Visual Ops";
export const visualCurrentUserEmail = "reviewer@example.com";

const visualExpectedStages = [
  { key: "ingest", label: "Ingest Case", duration_ms: 18 },
  { key: "normalize", label: "Normalize Facts", duration_ms: 42 },
  { key: "classify", label: "Classify Issue & Urgency", duration_ms: 65 },
  { key: "query", label: "Query Internal State", duration_ms: 120 },
  { key: "policy", label: "Check Policy & Risk", duration_ms: 80 },
  { key: "draft", label: "Draft Response Pack", duration_ms: 160 },
];

export const visualMemberships: WorkspaceMembershipWithWorkspace[] = [
  {
    id: "membership_visual_123",
    workspace_id: WORKSPACE_ID,
    user_id: USER_ID,
    role: "reviewer",
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
    workspace: {
      id: WORKSPACE_ID,
      slug: VISUAL_WORKSPACE_SLUG,
      name: VISUAL_WORKSPACE_NAME,
      created_by: USER_ID,
      created_at: WORKSPACE_CREATED_AT,
      updated_at: WORKSPACE_CREATED_AT,
    },
  },
];

export const visualGmailConnection = {
  id: "gmail_account_visual_123",
  gmailUserEmail: "shared-inbox+visual@async-copilot.dev",
};

export const visualSamples: Sample[] = [
  {
    id: "sample_visual_payments",
    slug: "payments-dispute",
    name: "Payments Dispute",
    summary: "Duplicate charge dispute with a blocked finance close and a likely Tier-2 escalation path.",
    body: [
      "Hi Support,",
      "",
      "Our finance lead found a duplicate charge after a retry flow triggered on invoice INV-4221.",
      "The customer is threatening a chargeback if we cannot provide a timeline and owner today.",
      "Trace: bill_retry_9af2.",
      "",
      "Please advise urgently.",
    ].join("\n"),
    urgency: "high",
    is_golden: true,
    expected_confidence: 84,
    expected_stages: visualExpectedStages,
    tags: ["billing", "chargeback", "golden"],
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  },
  {
    id: "sample_visual_timeout",
    slug: "orders-timeout",
    name: "Orders API Timeout",
    summary: "Checkout traffic is timing out on `/v2/orders` after a regional incident begins.",
    body: "We are seeing repeat 504s on /v2/orders and checkout is blocked for EMEA.",
    urgency: "high",
    is_golden: false,
    expected_confidence: 79,
    expected_stages: visualExpectedStages,
    tags: ["api", "checkout", "incident"],
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  },
  {
    id: "sample_visual_auth",
    slug: "two-factor-reset",
    name: "2FA Reset",
    summary: "Customer lost backup codes and needs a verified 2FA reset path.",
    body: "Customer lost device access and no longer has 2FA recovery codes.",
    urgency: "medium",
    is_golden: false,
    expected_confidence: 92,
    expected_stages: visualExpectedStages,
    tags: ["auth", "account"],
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  },
  {
    id: "sample_visual_export",
    slug: "csv-export-stall",
    name: "CSV Export Stall",
    summary: "A long-running data export never completes, with support needing status and next steps.",
    body: "Customer started a CSV export six hours ago and still sees the spinner.",
    urgency: "medium",
    is_golden: false,
    expected_confidence: 73,
    expected_stages: visualExpectedStages,
    tags: ["exports", "async-job"],
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  },
  {
    id: "sample_visual_refund",
    slug: "refund-ledger-gap",
    name: "Refund Ledger Gap",
    summary: "Refund processed in UI but missing from downstream ledger confirmation.",
    body: "Refund appears successful in the app but finance cannot see the ledger entry.",
    urgency: "low",
    is_golden: false,
    expected_confidence: 69,
    expected_stages: visualExpectedStages,
    tags: ["refunds", "ledger"],
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  },
];

export const visualSimilarCases: VisualSimilarCase[] = [
  {
    id: "similar_case_1",
    case_ref: "CASE-041",
    title: "Duplicate charge after billing retry",
    body: "Customer was charged twice after a retry sequence and requested a same-day timeline.",
    similarity: 0.94,
  },
  {
    id: "similar_case_2",
    case_ref: "CASE-037",
    title: "Chargeback warning during refund investigation",
    body: "Support coordinated with finance after the customer threatened a chargeback.",
    similarity: 0.89,
  },
  {
    id: "similar_case_3",
    case_ref: "CASE-012",
    title: "Ledger mismatch after manual invoice adjustment",
    body: "A manual adjustment left the customer-visible state inconsistent with the ledger export.",
    similarity: 0.81,
  },
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildGmailMessage(subject: string): GmailMessage {
  return {
    id: "gmail_row_visual_123",
    workspace_id: WORKSPACE_ID,
    gmail_account_id: visualGmailConnection.id,
    gmail_message_id: "189c2fa1bcd00001",
    gmail_thread_id: "189c2fa1bcd0thread",
    subject,
    from_name: "Jane Doe",
    from_email: "jane.doe@acme.example",
    to_emails: [visualGmailConnection.gmailUserEmail],
    cc_emails: ["finance@acme.example"],
    sent_at: "2026-04-25T07:58:00.000Z",
    snippet: "Finance found a duplicate charge after a retry flow.",
    body_text: "Duplicate charge complaint with timeline request.",
    raw_payload: { provider: "gmail", mailbox: visualGmailConnection.gmailUserEmail },
    imported_at: "2026-04-25T08:00:00.000Z",
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
  };
}

function buildCase(overrides: Partial<RunWithDetails["case"]>): RunWithDetails["case"] {
  return {
    id: "case_visual_123",
    workspace_id: WORKSPACE_ID,
    case_ref: "CASE-123",
    title: "Payment dispute with duplicate charge",
    body: [
      "Hi Support,",
      "",
      "We traced a duplicate charge after the billing retry sequence and need a same-day response for the customer.",
      "Finance also needs to know whether this is isolated or tied to a larger incident.",
      "",
      "Please confirm next steps.",
    ].join("\n"),
    source: "gmail",
    gmail_message_id: "gmail_row_visual_123",
    sample_id: "sample_visual_payments",
    created_by: USER_ID,
    customer_name: "Jane Doe",
    customer_account: "Acme Corp",
    customer_plan: "Premium",
    created_at: WORKSPACE_CREATED_AT,
    updated_at: WORKSPACE_CREATED_AT,
    gmail_message: buildGmailMessage("Duplicate charge after billing retry"),
    ...overrides,
  };
}

function buildStage(stage: Partial<RunStage> & Pick<RunStage, "id" | "stage_order" | "stage_key" | "stage_label">): RunStage {
  return {
    id: stage.id,
    run_id: stage.run_id ?? "run_visual_default",
    stage_order: stage.stage_order,
    stage_key: stage.stage_key,
    stage_label: stage.stage_label,
    state: stage.state ?? "pending",
    duration_ms: stage.duration_ms ?? null,
    output: stage.output ?? {},
    started_at: stage.started_at ?? null,
    completed_at: stage.completed_at ?? null,
    created_at: stage.created_at ?? WORKSPACE_CREATED_AT,
    updated_at: stage.updated_at ?? WORKSPACE_CREATED_AT,
  };
}

function buildEvent(event: Omit<RunEvent, "workspace_id" | "case_id">): RunEvent {
  return {
    ...event,
    workspace_id: WORKSPACE_ID,
    case_id: "case_visual_123",
  };
}

const runningRun: RunWithDetails = {
  id: "run_visual_running",
  workspace_id: WORKSPACE_ID,
  case_id: "case_visual_123",
  created_by: USER_ID,
  state: "running",
  confidence: 71,
  urgency: "high",
  started_at: "2026-04-25T08:00:00.000Z",
  completed_at: null,
  last_advanced_at: "2026-04-25T08:02:40.000Z",
  advance_cursor: 3,
  total_stages: 6,
  execution_status: "running",
  execution_attempts: 1,
  execution_next_retry_at: null,
  execution_lease_expires_at: "2026-04-25T08:03:10.000Z",
  execution_claim_token: "lease_visual_running",
  execution_last_error: null,
  created_at: WORKSPACE_CREATED_AT,
  updated_at: "2026-04-25T08:02:40.000Z",
  case: buildCase({}),
  stages: [
    buildStage({
      id: "stage_visual_running_1",
      run_id: "run_visual_running",
      stage_order: 1,
      stage_key: "ingest",
      stage_label: "Ingest Case",
      state: "completed",
      duration_ms: 18,
      output: { parsed: "customer email", source: "gmail" },
      started_at: "2026-04-25T08:00:00.000Z",
      completed_at: "2026-04-25T08:00:01.000Z",
      updated_at: "2026-04-25T08:00:01.000Z",
    }),
    buildStage({
      id: "stage_visual_running_2",
      run_id: "run_visual_running",
      stage_order: 2,
      stage_key: "normalize",
      stage_label: "Normalize Facts",
      state: "completed",
      duration_ms: 42,
      output: { entities_extracted: ["invoice", "retry flow", "chargeback risk"] },
      started_at: "2026-04-25T08:00:01.000Z",
      completed_at: "2026-04-25T08:00:02.000Z",
      updated_at: "2026-04-25T08:00:02.000Z",
    }),
    buildStage({
      id: "stage_visual_running_3",
      run_id: "run_visual_running",
      stage_order: 3,
      stage_key: "classify",
      stage_label: "Classify Issue & Urgency",
      state: "completed",
      duration_ms: 65,
      output: { intent: "duplicate_charge", urgency: "high", confidence: 71 },
      started_at: "2026-04-25T08:00:02.000Z",
      completed_at: "2026-04-25T08:00:03.000Z",
      updated_at: "2026-04-25T08:00:03.000Z",
    }),
    buildStage({
      id: "stage_visual_running_4",
      run_id: "run_visual_running",
      stage_order: 4,
      stage_key: "query",
      stage_label: "Query Internal State",
    }),
    buildStage({
      id: "stage_visual_running_5",
      run_id: "run_visual_running",
      stage_order: 5,
      stage_key: "policy",
      stage_label: "Check Policy & Risk",
    }),
    buildStage({
      id: "stage_visual_running_6",
      run_id: "run_visual_running",
      stage_order: 6,
      stage_key: "draft",
      stage_label: "Draft Response Pack",
    }),
  ],
  response_pack: null,
  events: [
    buildEvent({
      id: 1,
      run_id: "run_visual_running",
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
        summary: "Customer message normalized into case context.",
      },
      created_at: "2026-04-25T08:00:01.000Z",
    }),
    buildEvent({
      id: 2,
      run_id: "run_visual_running",
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
        summary: "Finance and billing entities extracted for investigation.",
      },
      created_at: "2026-04-25T08:00:02.000Z",
    }),
    buildEvent({
      id: 3,
      run_id: "run_visual_running",
      event_type: "stage.completed",
      actor_type: "system",
      actor_user_id: null,
      stage_key: "classify",
      payload: {
        stage_order: 3,
        stage_label: "Classify Issue & Urgency",
        prompt_key: "triage.classify",
        prompt_version: "v2",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        execution_mode: "ai",
        fallback_reason: null,
        parse_error: false,
        summary: "Issue classified as duplicate charge with chargeback risk.",
      },
      created_at: "2026-04-25T08:00:03.000Z",
    }),
  ],
  action_attempts: [],
  approval_history: [],
};

const completedRun: RunWithDetails = {
  id: "run_visual_completed",
  workspace_id: WORKSPACE_ID,
  case_id: "case_visual_123",
  created_by: USER_ID,
  state: "completed",
  confidence: 86,
  urgency: "medium",
  started_at: "2026-04-25T08:00:00.000Z",
  completed_at: "2026-04-25T08:05:00.000Z",
  last_advanced_at: "2026-04-25T08:05:00.000Z",
  advance_cursor: 6,
  total_stages: 6,
  execution_status: "completed",
  execution_attempts: 1,
  execution_next_retry_at: null,
  execution_lease_expires_at: null,
  execution_claim_token: null,
  execution_last_error: null,
  created_at: WORKSPACE_CREATED_AT,
  updated_at: "2026-04-25T08:05:00.000Z",
  case: buildCase({
    case_ref: "CASE-219",
    title: "Billing dispute resolved with finance timeline",
  }),
  stages: [
    buildStage({
      id: "stage_visual_completed_1",
      run_id: "run_visual_completed",
      stage_order: 1,
      stage_key: "ingest",
      stage_label: "Ingest Case",
      state: "completed",
      duration_ms: 18,
      output: { parsed: "text" },
      started_at: "2026-04-25T08:00:00.000Z",
      completed_at: "2026-04-25T08:00:01.000Z",
      updated_at: "2026-04-25T08:00:01.000Z",
    }),
    buildStage({
      id: "stage_visual_completed_2",
      run_id: "run_visual_completed",
      stage_order: 2,
      stage_key: "normalize",
      stage_label: "Normalize Facts",
      state: "completed",
      duration_ms: 42,
      output: { entities_extracted: ["invoice", "retry flow"] },
      started_at: "2026-04-25T08:00:01.000Z",
      completed_at: "2026-04-25T08:00:02.000Z",
      updated_at: "2026-04-25T08:00:02.000Z",
    }),
    buildStage({
      id: "stage_visual_completed_3",
      run_id: "run_visual_completed",
      stage_order: 3,
      stage_key: "classify",
      stage_label: "Classify Issue & Urgency",
      state: "completed",
      duration_ms: 65,
      output: { intent: "duplicate_charge", urgency: "medium" },
      started_at: "2026-04-25T08:00:02.000Z",
      completed_at: "2026-04-25T08:00:03.000Z",
      updated_at: "2026-04-25T08:00:03.000Z",
    }),
    buildStage({
      id: "stage_visual_completed_4",
      run_id: "run_visual_completed",
      stage_order: 4,
      stage_key: "query",
      stage_label: "Query Internal State",
      state: "completed",
      duration_ms: 95,
      output: { ledger_mismatch: false, linked_incident: null },
      started_at: "2026-04-25T08:00:03.000Z",
      completed_at: "2026-04-25T08:00:04.000Z",
      updated_at: "2026-04-25T08:00:04.000Z",
    }),
    buildStage({
      id: "stage_visual_completed_5",
      run_id: "run_visual_completed",
      stage_order: 5,
      stage_key: "policy",
      stage_label: "Check Policy & Risk",
      state: "completed",
      duration_ms: 77,
      output: { policy_path: "billing-refund-verified", risk: "low" },
      started_at: "2026-04-25T08:00:04.000Z",
      completed_at: "2026-04-25T08:00:04.500Z",
      updated_at: "2026-04-25T08:00:04.500Z",
    }),
    buildStage({
      id: "stage_visual_completed_6",
      run_id: "run_visual_completed",
      stage_order: 6,
      stage_key: "draft",
      stage_label: "Draft Response Pack",
      state: "completed",
      duration_ms: 160,
      output: { generated: true, channel: "email" },
      started_at: "2026-04-25T08:00:04.500Z",
      completed_at: "2026-04-25T08:00:05.000Z",
      updated_at: "2026-04-25T08:00:05.000Z",
    }),
  ],
  response_pack: {
    id: "pack_visual_completed",
    run_id: "run_visual_completed",
    confidence: 86,
    recommendation: "Send a verified billing timeline and offer a finance follow-up within one business day.",
    internal_summary: "Billing retry produced a duplicate charge, but ledger verification confirms a single refund path and no active incident.",
    draft_reply: [
      "Hi Jane,",
      "",
      "Thanks for the detailed report. We verified the billing retry timeline and confirmed the corrective refund path.",
      "",
      "Finance will send a reconciled timeline within one business day, and you do not need to take further action in the meantime.",
      "",
      "Best,",
      "Async Copilot Support",
    ].join("\n"),
    citations: [
      { source: "Billing retry playbook", id: "doc-billing-retry", note: "Verified refund timeline and escalation boundary." },
      { source: "Resolved ticket #7721", id: "ticket-7721", note: "Historical precedent for duplicate-charge communication." },
    ],
    staged_actions: [
      {
        label: "Send approved run summary to Slack",
        intent: SLACK_ACTION_INTENT,
        status: "queued",
        requires_approval: true,
        detail: "Dispatch the approved run summary to Slack after human approval.",
        target: "Slack webhook",
        last_attempt_at: null,
        attempt_count: 0,
      },
    ],
    escalation_queue: null,
    approved: false,
    approved_at: null,
    approved_by: null,
    created_at: "2026-04-25T08:05:00.000Z",
    updated_at: "2026-04-25T08:05:00.000Z",
  },
  events: [
    buildEvent({
      id: 11,
      run_id: "run_visual_completed",
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
    }),
    buildEvent({
      id: 12,
      run_id: "run_visual_completed",
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
    }),
    buildEvent({
      id: 13,
      run_id: "run_visual_completed",
      event_type: "stage.completed",
      actor_type: "system",
      actor_user_id: null,
      stage_key: "classify",
      payload: {
        stage_order: 3,
        stage_label: "Classify Issue & Urgency",
        prompt_key: "triage.classify",
        prompt_version: "v2",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        execution_mode: "ai",
        fallback_reason: null,
        parse_error: false,
      },
      created_at: "2026-04-25T08:00:03.000Z",
    }),
    buildEvent({
      id: 14,
      run_id: "run_visual_completed",
      event_type: "stage.completed",
      actor_type: "system",
      actor_user_id: null,
      stage_key: "query",
      payload: {
        stage_order: 4,
        stage_label: "Query Internal State",
        prompt_key: "triage.query",
        prompt_version: "v1",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        execution_mode: "ai",
        fallback_reason: null,
        parse_error: false,
      },
      created_at: "2026-04-25T08:00:04.000Z",
    }),
    buildEvent({
      id: 15,
      run_id: "run_visual_completed",
      event_type: "stage.completed",
      actor_type: "system",
      actor_user_id: null,
      stage_key: "policy",
      payload: {
        stage_order: 5,
        stage_label: "Check Policy & Risk",
        prompt_key: "triage.policy",
        prompt_version: "v1",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        execution_mode: "ai",
        fallback_reason: null,
        parse_error: false,
      },
      created_at: "2026-04-25T08:00:04.500Z",
    }),
    buildEvent({
      id: 16,
      run_id: "run_visual_completed",
      event_type: "stage.completed",
      actor_type: "system",
      actor_user_id: null,
      stage_key: "draft",
      payload: {
        stage_order: 6,
        stage_label: "Draft Response Pack",
        prompt_key: "triage.draft",
        prompt_version: "v1",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        execution_mode: "ai",
        fallback_reason: null,
        parse_error: true,
      },
      created_at: "2026-04-25T08:00:05.000Z",
    }),
    buildEvent({
      id: 17,
      run_id: "run_visual_completed",
      event_type: "response_pack.created",
      actor_type: "system",
      actor_user_id: null,
      stage_key: null,
      payload: {
        summary: "Response pack persisted for review.",
        confidence: 86,
      },
      created_at: "2026-04-25T08:05:00.000Z",
    }),
  ],
  action_attempts: [],
  approval_history: [],
};

const escalatedRun: RunWithDetails = {
  id: "run_visual_escalated",
  workspace_id: WORKSPACE_ID,
  case_id: "case_visual_123",
  created_by: USER_ID,
  state: "escalated",
  confidence: 58,
  urgency: "high",
  started_at: "2026-04-25T08:00:00.000Z",
  completed_at: "2026-04-25T08:07:00.000Z",
  last_advanced_at: "2026-04-25T08:07:00.000Z",
  advance_cursor: 6,
  total_stages: 6,
  execution_status: "completed",
  execution_attempts: 2,
  execution_next_retry_at: null,
  execution_lease_expires_at: null,
  execution_claim_token: null,
  execution_last_error: null,
  created_at: WORKSPACE_CREATED_AT,
  updated_at: "2026-04-25T08:07:00.000Z",
  case: buildCase({
    case_ref: "CASE-337",
    title: "High-risk duplicate charge requires escalation",
    customer_account: "Northstar Retail",
  }),
  stages: completedRun.stages.map((stage) => ({ ...stage, run_id: "run_visual_escalated", id: `${stage.id}_esc` })),
  response_pack: {
    id: "pack_visual_escalated",
    run_id: "run_visual_escalated",
    confidence: 58,
    recommendation: "Escalate to Tier 2 and send a manual finance summary to the escalation queue.",
    internal_summary: "Signals conflict between the billing retry path and downstream ledger state; risk remains too high for a direct customer response.",
    draft_reply: [
      "Hi Jane,",
      "",
      "We are escalating this billing case to a specialist team because the downstream ledger state still needs manual verification.",
      "",
      "We will follow up with a confirmed timeline shortly.",
      "",
      "Best,",
      "Async Copilot Support",
    ].join("\n"),
    citations: [
      { source: "Payments escalation policy", id: "doc-escalation-policy", note: "Tier-2 review required when ledger mismatch persists." },
      { source: "Incident #1042", id: "incident-1042", note: "Related payment subsystem degradation during retry window." },
    ],
    staged_actions: [
      {
        label: "Send escalation summary to Slack",
        intent: SLACK_ACTION_INTENT,
        status: "dry_run",
        requires_approval: true,
        detail: "Slack dispatch simulated in dry-run mode.",
        target: "Slack webhook (dry-run)",
        last_attempt_at: "2026-04-25T08:07:00.000Z",
        attempt_count: 1,
      },
    ],
    escalation_queue: "Tier-2-Payments",
    approved: true,
    approved_at: "2026-04-25T08:06:00.000Z",
    approved_by: USER_ID,
    created_at: "2026-04-25T08:05:00.000Z",
    updated_at: "2026-04-25T08:07:00.000Z",
  },
  events: [
    ...completedRun.events.map((eventItem) => ({ ...eventItem, run_id: "run_visual_escalated" })),
    buildEvent({
      id: 30,
      run_id: "run_visual_escalated",
      event_type: "response_pack.approved",
      actor_type: "user",
      actor_user_id: USER_ID,
      stage_key: null,
      payload: {
        actor_label: visualCurrentUserEmail,
        summary: "Response pack approved for escalation dispatch.",
      },
      created_at: "2026-04-25T08:06:00.000Z",
    }),
  ],
  action_attempts: [
    {
      id: "action_attempt_visual_1",
      workspace_id: WORKSPACE_ID,
      run_id: "run_visual_escalated",
      response_pack_id: "pack_visual_escalated",
      action_intent: SLACK_ACTION_INTENT,
      action_label: "Send escalation summary to Slack",
      attempt_no: 1,
      status: "dry_run",
      target: "Slack webhook (dry-run)",
      detail: "Slack dispatch simulated in dry-run mode.",
      idempotency_key: "run_visual_escalated:slack.notify:1",
      actor_user_id: USER_ID,
      attempted_at: "2026-04-25T08:07:00.000Z",
      created_at: "2026-04-25T08:07:00.000Z",
    },
  ],
  approval_history: [
    {
      id: "approval_visual_1",
      workspace_id: WORKSPACE_ID,
      run_id: "run_visual_escalated",
      response_pack_id: "pack_visual_escalated",
      actor_user_id: USER_ID,
      actor_label: visualCurrentUserEmail,
      approved_at: "2026-04-25T08:06:00.000Z",
      created_at: "2026-04-25T08:06:00.000Z",
    },
  ],
};

const visualRunFixtures: Record<VisualRunVariant, RunWithDetails> = {
  running: runningRun,
  completed: completedRun,
  escalated: escalatedRun,
};

export const visualRunsTableRows: VisualRunsTableRow[] = [
  {
    id: runningRun.id,
    state: runningRun.state,
    confidence: runningRun.confidence,
    urgency: runningRun.urgency,
    created_at: runningRun.created_at,
    advance_cursor: runningRun.advance_cursor,
    total_stages: runningRun.total_stages,
    case: {
      case_ref: runningRun.case.case_ref,
      title: runningRun.case.title,
      customer_name: runningRun.case.customer_name,
      source: runningRun.case.source,
    },
  },
  {
    id: completedRun.id,
    state: completedRun.state,
    confidence: completedRun.confidence,
    urgency: completedRun.urgency,
    created_at: completedRun.created_at,
    advance_cursor: completedRun.advance_cursor,
    total_stages: completedRun.total_stages,
    case: {
      case_ref: completedRun.case.case_ref,
      title: completedRun.case.title,
      customer_name: completedRun.case.customer_name,
      source: completedRun.case.source,
    },
  },
  {
    id: escalatedRun.id,
    state: escalatedRun.state,
    confidence: escalatedRun.confidence,
    urgency: escalatedRun.urgency,
    created_at: escalatedRun.created_at,
    advance_cursor: escalatedRun.advance_cursor,
    total_stages: escalatedRun.total_stages,
    case: {
      case_ref: escalatedRun.case.case_ref,
      title: escalatedRun.case.title,
      customer_name: escalatedRun.case.customer_name,
      source: escalatedRun.case.source,
    },
  },
  {
    id: "run_visual_failed",
    state: "failed",
    confidence: 33,
    urgency: "high",
    created_at: WORKSPACE_CREATED_AT,
    advance_cursor: 2,
    total_stages: 6,
    case: {
      case_ref: "CASE-401",
      title: "CSV export stalled after schema mismatch",
      customer_name: "Pine Labs",
      source: "intake",
    },
  },
];

export function visualHarnessEnabled() {
  return process.env.ENABLE_VISUAL_HARNESS === "1";
}

export function getVisualRunFixture(variant: VisualRunVariant) {
  return deepClone(visualRunFixtures[variant]);
}

export function getVisualSamplesFixture() {
  return deepClone(visualSamples);
}

export function getVisualSimilarCasesFixture() {
  return deepClone(visualSimilarCases);
}

export function getVisualRunsTableRowsFixture() {
  return deepClone(visualRunsTableRows);
}
