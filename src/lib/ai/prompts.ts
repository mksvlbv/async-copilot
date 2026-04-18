/**
 * System prompts for each triage stage.
 *
 * Each prompt receives the case context (title + body + customer info)
 * and must return structured JSON that matches the stage's expected output.
 */

export type StagePrompt = {
  system: string;
  /** Template that receives {title, body, customer} placeholders. */
  user: (ctx: StageContext) => string;
};

export type StageContext = {
  title: string;
  body: string;
  customerName: string | null;
  customerAccount: string | null;
  customerPlan: string | null;
};

const STAGE_PROMPTS: Record<string, StagePrompt> = {
  ingest: {
    system: `You are an AI triage system's Ingest stage. Parse the incoming support ticket and extract basic metadata.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "parsed": the format detected ("text", "html", "email")
- "tokens": estimated token count of the body (integer)
- "language": detected language code (e.g. "en")
- "has_attachments": boolean`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}`,
  },

  normalize: {
    system: `You are an AI triage system's Normalize stage. Extract named entities from the support ticket.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "entities_extracted": array of entity strings found (e.g. "amount", "invoice", "api_endpoint", "auth", "security", "date", "product")
- "normalized_body": a cleaned-up 1-2 sentence summary of the core issue`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}`,
  },

  classify: {
    system: `You are an AI triage system's Classify stage. Determine the intent and urgency of a support ticket.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "intent": one of "payments_issue", "api_issue", "feature_request", "auth_issue", "security_issue", "general_inquiry"
- "urgency": one of "low", "medium", "high"
- "reasoning": 1-2 sentence explanation of why you chose this classification`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}\n\nCustomer: ${ctx.customerName ?? "Unknown"} (${ctx.customerPlan ?? "unknown plan"})`,
  },

  query: {
    system: `You are an AI triage system's Query stage. Determine which internal systems should be checked to resolve this ticket.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "internal_checks": array of system names to query (e.g. "status_page", "customer_profile", "recent_orders", "billing_ledger", "api_logs", "auth_logs")
- "signals": overall signal assessment, one of "positive", "mixed", "negative"
- "findings": 1-2 sentence summary of expected findings`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}\n\nCustomer account: ${ctx.customerAccount ?? "N/A"}`,
  },

  policy: {
    system: `You are an AI triage system's Policy Check stage. Evaluate the ticket against company policies and assess risk.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "policy": the applicable policy (e.g. "standard_response_allowed", "escalation_required", "refund_eligible", "security_protocol")
- "risk": one of "low", "medium", "high"
- "compliance_notes": 1-2 sentence note on any compliance considerations`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}\n\nCustomer: ${ctx.customerName ?? "Unknown"} (Plan: ${ctx.customerPlan ?? "unknown"}, Account: ${ctx.customerAccount ?? "N/A"})`,
  },

  draft: {
    system: `You are an AI triage system's Draft stage. Generate a professional customer-facing response draft.
Respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "generated": true
- "tone": the tone used (e.g. "helpful_concise", "empathetic_detailed", "urgent_professional")
- "draft_snippet": a 2-3 sentence preview of the draft response (the full draft goes into the response pack)
- "confidence_boost": a number 0-15 representing how much this stage increased overall confidence`,
    user: (ctx) =>
      `Ticket title: ${ctx.title}\n\nTicket body:\n${ctx.body}\n\nCustomer name: ${ctx.customerName ?? "there"}`,
  },
};

/** Get the prompt config for a given stage key. Returns undefined for unknown stages. */
export function getStagePrompt(stageKey: string): StagePrompt | undefined {
  return STAGE_PROMPTS[stageKey];
}

export { STAGE_PROMPTS };
