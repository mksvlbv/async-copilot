/**
 * Server-owned run progression model.
 *
 * One advance() call moves a run forward by exactly one stage:
 *   pending → running (stage 1) → ... → completed | escalated
 *
 * Sample-backed runs replay `sample.expected_stages` (deterministic).
 * Intake runs use `DEFAULT_STAGE_DEFS` as fallback.
 */
import type {
  Citation,
  ResponsePack,
  Run,
  RunStage,
  StagedAction,
  StageDefinition,
  Sample,
  UrgencyLevel,
} from "@/lib/supabase/types";

/** Stages used when a case has no sample template (pure intake). */
export const DEFAULT_STAGE_DEFS: StageDefinition[] = [
  { key: "ingest", label: "Ingest Case", duration_ms: 18 },
  { key: "normalize", label: "Normalize Facts", duration_ms: 45 },
  { key: "classify", label: "Classify Issue & Urgency", duration_ms: 120 },
  { key: "query", label: "Query Internal State", duration_ms: 280 },
  { key: "policy", label: "Check Policy & Risk", duration_ms: 90 },
  { key: "draft", label: "Draft Response Pack", duration_ms: 220 },
];

export function stagesForSample(sample: Sample | null): StageDefinition[] {
  if (sample && sample.expected_stages && sample.expected_stages.length > 0) {
    return sample.expected_stages;
  }
  return DEFAULT_STAGE_DEFS;
}

/** Minimum confidence needed to avoid forced escalation at completion. */
export const ESCALATION_THRESHOLD = 70;

export function finalStateFor(confidence: number): "completed" | "escalated" {
  return confidence < ESCALATION_THRESHOLD ? "escalated" : "completed";
}

/**
 * Synthetic stage output — used when no sample-specific output was seeded.
 * Keeps the demo timeline visually rich even for freeform intake runs.
 */
export function syntheticOutputFor(
  stageKey: string,
  ctx: { caseTitle: string; caseBody: string },
): Record<string, unknown> {
  switch (stageKey) {
    case "ingest":
      return {
        parsed: "text",
        tokens: Math.min(512, Math.max(40, ctx.caseBody.length / 4) | 0),
      };
    case "normalize":
      return {
        entities_extracted: inferEntities(ctx.caseBody),
      };
    case "classify":
      return {
        intent: inferIntent(ctx.caseTitle, ctx.caseBody),
        urgency: inferUrgency(ctx.caseBody),
      };
    case "query":
      return {
        internal_checks: ["status_page", "customer_profile", "recent_orders"],
        signals: "mixed",
      };
    case "policy":
      return {
        policy: "standard_response_allowed",
        risk: "low",
      };
    case "draft":
      return {
        generated: true,
        tone: "helpful_concise",
      };
    default:
      return {};
  }
}

function inferEntities(body: string): string[] {
  const out: string[] = [];
  if (/\$[\d,]+/.test(body)) out.push("amount");
  if (/INV-\d+|invoice/i.test(body)) out.push("invoice");
  if (/\/v\d+\/\w+|endpoint|API/i.test(body)) out.push("api_endpoint");
  if (/SSO|SAML|login|password/i.test(body)) out.push("auth");
  if (/API key|security|unauthorized/i.test(body)) out.push("security");
  return out.length > 0 ? out : ["generic"];
}

function inferIntent(title: string, body: string): string {
  const combined = `${title} ${body}`.toLowerCase();
  if (/refund|charge|payment|invoice/.test(combined)) return "payments_issue";
  if (/timeout|500|504|down|api/.test(combined)) return "api_issue";
  if (/feature|export|request/.test(combined)) return "feature_request";
  if (/login|sso|saml|password/.test(combined)) return "auth_issue";
  if (/security|unauthorized|suspicious/.test(combined)) return "security_issue";
  return "general_inquiry";
}

function inferUrgency(body: string): UrgencyLevel {
  if (/urgent|immediately|today|production|down|outage|security/i.test(body))
    return "high";
  if (/soon|asap|this week/i.test(body)) return "medium";
  return "low";
}

/**
 * Builds a generic response pack for intake-backed runs.
 * For sample-backed runs, prefer the hand-crafted pack in the seed.
 */
export function buildFallbackResponsePack(args: {
  run_id: string;
  confidence: number;
  urgency: UrgencyLevel;
  caseTitle: string;
  customerName: string | null;
}): Omit<ResponsePack, "id" | "created_at" | "updated_at"> {
  const { run_id, confidence, urgency, caseTitle, customerName } = args;
  const escalate = confidence < ESCALATION_THRESHOLD;
  const citations: Citation[] = [
    { source: "Customer message", id: "msg_original", note: "Original ticket body" },
    { source: "Internal signals", id: "sig_default", note: "Baseline internal checks" },
  ];
  const staged_actions: StagedAction[] = [
    {
      label: escalate ? "Flag for senior operator review" : "Send draft reply",
      intent: escalate ? "internal.flag_review" : "email.send",
      status: "queued",
      requires_approval: true,
    },
  ];
  const recommendation = escalate
    ? `Confidence ${confidence}% — route to senior operator before replying.`
    : `Confidence ${confidence}% — safe to send after a quick human glance.`;

  const hi = customerName ? `Hi ${customerName.split(" ")[0]}` : "Hi there";
  const draft_reply = escalate
    ? `${hi},\n\nThanks for reaching out. I'm looping in a senior teammate to make sure we get this exactly right — we'll follow up within a few hours.\n\nBest regards,\nSupport Team`
    : `${hi},\n\nThanks for the message. We've taken a look and here's what we've found: your request is being handled. We'll follow up shortly with the full answer.\n\nBest regards,\nSupport Team`;

  const internal_summary =
    `Case: ${caseTitle}\n` +
    `Urgency: ${urgency}\n` +
    `Confidence: ${confidence}%\n` +
    (escalate
      ? `Escalation suggested — cautious draft prepared.`
      : `Standard resolution path.`);

  return {
    run_id,
    confidence,
    recommendation,
    internal_summary,
    draft_reply,
    citations,
    staged_actions,
    escalation_queue: escalate ? "Tier-2-General" : null,
    approved: false,
    approved_at: null,
  };
}

export type AdvanceResult = {
  run: Run;
  stages: RunStage[];
  response_pack: ResponsePack | null;
  terminal: boolean;
};
