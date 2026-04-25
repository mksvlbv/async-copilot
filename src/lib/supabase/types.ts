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
export type RunExecutionStatus =
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed";
export type StageState = "pending" | "running" | "completed" | "failed";
export type CaseSource = "intake" | "sample" | "gmail";
export type WorkspaceRole = "admin" | "reviewer" | "operator";

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

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMembership = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMembershipWithWorkspace = WorkspaceMembership & {
  workspace: Workspace;
};

export type WorkspaceGmailAccount = {
  id: string;
  workspace_id: string;
  connected_by: string | null;
  gmail_user_email: string;
  google_subject: string;
  refresh_token: string;
  access_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
};

export type GmailMessage = {
  id: string;
  workspace_id: string;
  gmail_account_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  sent_at: string | null;
  snippet: string | null;
  body_text: string;
  raw_payload: Record<string, unknown>;
  imported_at: string;
  created_at: string;
  updated_at: string;
};

export type Case = {
  id: string;
  workspace_id: string;
  case_ref: string;
  title: string;
  body: string;
  source: CaseSource;
  gmail_message_id: string | null;
  sample_id: string | null;
  created_by: string | null;
  customer_name: string | null;
  customer_account: string | null;
  customer_plan: string | null;
  created_at: string;
  updated_at: string;
  gmail_message?: GmailMessage | null;
};

export type Run = {
  id: string;
  workspace_id: string;
  case_id: string;
  created_by: string | null;
  state: RunState;
  confidence: number | null;
  urgency: UrgencyLevel | null;
  started_at: string | null;
  completed_at: string | null;
  last_advanced_at: string | null;
  advance_cursor: number;
  total_stages: number;
  execution_status: RunExecutionStatus;
  execution_attempts: number;
  execution_next_retry_at: string | null;
  execution_lease_expires_at: string | null;
  execution_claim_token: string | null;
  execution_last_error: string | null;
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
  status: "queued" | "executed" | "cancelled" | "dry_run" | "failed";
  requires_approval: boolean;
  detail?: string | null;
  target?: string | null;
  last_attempt_at?: string | null;
  attempt_count?: number | null;
};

export type RunActionAttempt = {
  id: string;
  workspace_id: string;
  run_id: string;
  response_pack_id: string;
  action_intent: string;
  action_label: string;
  attempt_no: number;
  status: "pending" | Extract<StagedAction["status"], "executed" | "dry_run" | "failed">;
  target: string | null;
  detail: string | null;
  idempotency_key: string;
  actor_user_id: string | null;
  attempted_at: string;
  created_at: string;
};

export type ResponsePackApproval = {
  id: string;
  workspace_id: string;
  run_id: string;
  response_pack_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  approved_at: string;
  created_at: string;
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
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RunEvent = {
  id: number;
  workspace_id: string;
  case_id: string;
  run_id: string;
  event_type: string;
  actor_type: "system" | "user";
  actor_user_id: string | null;
  stage_key: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RunWithDetails = Run & {
  case: Case;
  stages: RunStage[];
  response_pack: ResponsePack | null;
  events: RunEvent[];
  action_attempts: RunActionAttempt[];
  approval_history: ResponsePackApproval[];
};
