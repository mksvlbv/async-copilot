import { describe, it, expect } from "vitest";
import {
  inferIntent,
  inferUrgency,
  inferEntities,
  buildFallbackResponsePack,
  finalStateFor,
  syntheticOutputFor,
  stagesForSample,
  ESCALATION_THRESHOLD,
  DEFAULT_STAGE_DEFS,
} from "@/lib/triage/run-model";

/* =============================================================
 *  inferIntent
 * ============================================================= */
describe("inferIntent", () => {
  it("detects payments_issue from refund keyword", () => {
    expect(inferIntent("Billing problem", "I need a refund for my last charge")).toBe("payments_issue");
  });

  it("detects api_issue from 500 error", () => {
    expect(inferIntent("API down", "Getting 500 errors on the endpoint")).toBe("api_issue");
  });

  it("detects feature_request", () => {
    expect(inferIntent("CSV export", "Can you add a feature to export data?")).toBe("feature_request");
  });

  it("detects auth_issue from SSO keyword", () => {
    expect(inferIntent("Login broken", "SSO is not working for our team")).toBe("auth_issue");
  });

  it("detects security_issue", () => {
    expect(inferIntent("Suspicious activity", "Unauthorized access detected on our account")).toBe("security_issue");
  });

  it("falls back to general_inquiry for unmatched content", () => {
    expect(inferIntent("Hello", "Just wanted to check on our account status")).toBe("general_inquiry");
  });
});

/* =============================================================
 *  inferUrgency
 * ============================================================= */
describe("inferUrgency", () => {
  it("returns high for production outage", () => {
    expect(inferUrgency("Our production system is down!")).toBe("high");
  });

  it("returns high for urgent keyword", () => {
    expect(inferUrgency("This needs to be fixed immediately")).toBe("high");
  });

  it("returns high for security keyword", () => {
    expect(inferUrgency("We found a security vulnerability")).toBe("high");
  });

  it("returns medium for asap keyword", () => {
    expect(inferUrgency("Please fix this asap")).toBe("medium");
  });

  it("returns medium for 'this week'", () => {
    expect(inferUrgency("Can you resolve this this week?")).toBe("medium");
  });

  it("returns low for neutral content", () => {
    expect(inferUrgency("Just wondering about the feature roadmap")).toBe("low");
  });
});

/* =============================================================
 *  inferEntities
 * ============================================================= */
describe("inferEntities", () => {
  it("extracts amount entity from dollar values", () => {
    expect(inferEntities("I was charged $500 twice")).toContain("amount");
  });

  it("extracts invoice entity", () => {
    expect(inferEntities("Invoice INV-12345 was incorrect")).toContain("invoice");
  });

  it("extracts api_endpoint entity", () => {
    expect(inferEntities("The /v2/users endpoint is broken")).toContain("api_endpoint");
  });

  it("extracts auth entity from SSO keyword", () => {
    expect(inferEntities("Our SSO integration stopped working")).toContain("auth");
  });

  it("extracts security entity", () => {
    expect(inferEntities("Someone got unauthorized access to our API key")).toEqual(
      expect.arrayContaining(["security"]),
    );
  });

  it("returns generic when no entities match", () => {
    expect(inferEntities("Hello world")).toEqual(["generic"]);
  });
});

/* =============================================================
 *  finalStateFor
 * ============================================================= */
describe("finalStateFor", () => {
  it("returns escalated when confidence below threshold", () => {
    expect(finalStateFor(45)).toBe("escalated");
    expect(finalStateFor(69)).toBe("escalated");
  });

  it("returns completed when confidence at threshold", () => {
    expect(finalStateFor(ESCALATION_THRESHOLD)).toBe("completed");
    expect(finalStateFor(70)).toBe("completed");
  });

  it("returns completed when confidence above threshold", () => {
    expect(finalStateFor(85)).toBe("completed");
    expect(finalStateFor(100)).toBe("completed");
  });
});

/* =============================================================
 *  buildFallbackResponsePack
 * ============================================================= */
describe("buildFallbackResponsePack", () => {
  const base = {
    run_id: "run_123",
    caseTitle: "Test case",
  };

  it("builds a non-escalated pack for high confidence", () => {
    const pack = buildFallbackResponsePack({
      ...base,
      confidence: 85,
      urgency: "low",
      customerName: "Jane Doe",
    });
    expect(pack.confidence).toBe(85);
    expect(pack.escalation_queue).toBeNull();
    expect(pack.draft_reply).toContain("Hi Jane");
    expect(pack.staged_actions[0].intent).toBe("email.send");
  });

  it("builds an escalated pack for low confidence", () => {
    const pack = buildFallbackResponsePack({
      ...base,
      confidence: 40,
      urgency: "high",
      customerName: "Bob Smith",
    });
    expect(pack.confidence).toBe(40);
    expect(pack.escalation_queue).toBe("Tier-2-General");
    expect(pack.draft_reply).toContain("senior teammate");
    expect(pack.staged_actions[0].intent).toBe("internal.flag_review");
  });

  it("uses generic greeting when no customer name", () => {
    const pack = buildFallbackResponsePack({
      ...base,
      confidence: 80,
      urgency: "medium",
      customerName: null,
    });
    expect(pack.draft_reply).toContain("Hi there");
  });

  it("always includes citations", () => {
    const pack = buildFallbackResponsePack({
      ...base,
      confidence: 75,
      urgency: "low",
      customerName: null,
    });
    expect(pack.citations.length).toBeGreaterThanOrEqual(2);
    expect(pack.citations[0].source).toBe("Customer message");
  });
});

/* =============================================================
 *  syntheticOutputFor
 * ============================================================= */
describe("syntheticOutputFor", () => {
  const ctx = { caseTitle: "Billing issue", caseBody: "I was charged $200 for invoice INV-999" };

  it("returns parsed format for ingest stage", () => {
    const out = syntheticOutputFor("ingest", ctx);
    expect(out.parsed).toBe("text");
    expect(typeof out.tokens).toBe("number");
  });

  it("extracts entities in normalize stage", () => {
    const out = syntheticOutputFor("normalize", ctx);
    expect(out.entities_extracted).toEqual(expect.arrayContaining(["amount", "invoice"]));
  });

  it("classifies intent in classify stage", () => {
    const out = syntheticOutputFor("classify", ctx);
    expect(out.intent).toBe("payments_issue");
  });

  it("returns empty object for unknown stage", () => {
    const out = syntheticOutputFor("unknown_stage", ctx);
    expect(Object.keys(out)).toHaveLength(0);
  });
});

/* =============================================================
 *  stagesForSample
 * ============================================================= */
describe("stagesForSample", () => {
  it("returns default stages when sample is null", () => {
    expect(stagesForSample(null)).toBe(DEFAULT_STAGE_DEFS);
  });

  it("returns default stages when sample has no expected_stages", () => {
    const sample = { expected_stages: [] } as never;
    expect(stagesForSample(sample)).toBe(DEFAULT_STAGE_DEFS);
  });

  it("returns sample stages when present", () => {
    const customStages = [{ key: "custom", label: "Custom", duration_ms: 100 }];
    const sample = { expected_stages: customStages } as never;
    expect(stagesForSample(sample)).toBe(customStages);
  });
});
