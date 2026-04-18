/**
 * Minimal hand-written types for the Async Copilot tables.
 * No auto-generated types yet — kept manual until schema stabilises.
 * Must stay in sync with supabase/migrations/001_initial_schema.sql.
 */

export type UrgencyLevel = "low" | "medium" | "high";
export type RunState =
  | "pending"
  | "running"
  | "completed"
  | "escalated"
  | "failed";
export type StageState = "pending" | "running" | "completed" | "failed";
export type CaseSource = "intake" | "sample";

export type StageDefinition = {
  key: string;
  label: string;
  duration_ms: number;
};

export type Sample = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  body: string;
  urgency: UrgencyLevel;
  is_golden: boolean;
  expected_confidence: number | null;
  expected_stages: StageDefinition[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Case = {
  id: string;
  case_ref: string;
  title: string;
  body: string;
  source: CaseSource;
  sample_id: string | null;
  customer_name: string | null;
  customer_account: string | null;
  customer_plan: string | null;
  created_at: string;
  updated_at: string;
};

export type Run = {
  id: string;
  case_id: string;
  state: RunState;
  confidence: number | null;
  urgency: UrgencyLevel | null;
  started_at: string | null;
  completed_at: string | null;
  last_advanced_at: string | null;
  advance_cursor: number;
  total_stages: number;
  created_at: string;
  updated_at: string;
};

export type RunStage = {
  id: string;
  run_id: string;
  stage_order: number;
  stage_key: string;
  stage_label: string;
  state: StageState;
  duration_ms: number | null;
  output: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Citation = {
  source: string;
  id: string;
  note: string;
};

export type StagedAction = {
  label: string;
  intent: string;
  status: "queued" | "executed" | "cancelled";
  requires_approval: boolean;
};

export type ResponsePack = {
  id: string;
  run_id: string;
  confidence: number;
  recommendation: string | null;
  internal_summary: string;
  draft_reply: string;
  citations: Citation[];
  staged_actions: StagedAction[];
  escalation_queue: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RunWithDetails = Run & {
  case: Case;
  stages: RunStage[];
  response_pack: ResponsePack | null;
};
