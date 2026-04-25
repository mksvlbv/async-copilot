import { describe, expect, it } from "vitest";
import { TRIAGE_MODEL_ID, TRIAGE_PROVIDER } from "@/lib/ai/client";
import { getStagePrompt } from "@/lib/ai/prompts";
import { buildStageProvenance, stageProvenanceUsesAI } from "@/lib/runs/execute-step";

describe("buildStageProvenance", () => {
  it("records prompt and runtime metadata for AI executions", () => {
    const prompt = getStagePrompt("ingest");

    expect(
      buildStageProvenance({
        prompt,
        executionMode: "ai",
      }),
    ).toEqual({
      prompt_key: "triage.ingest",
      prompt_version: "v1",
      provider: TRIAGE_PROVIDER,
      model: TRIAGE_MODEL_ID,
      execution_mode: "ai",
      fallback_reason: null,
      parse_error: false,
    });
  });

  it("marks synthetic fallback when AI is unavailable", () => {
    const prompt = getStagePrompt("query");

    const provenance = buildStageProvenance({
      prompt,
      executionMode: "synthetic",
      fallbackReason: "ai_disabled",
    });

    expect(provenance).toEqual({
      prompt_key: "triage.query",
      prompt_version: "v1",
      provider: null,
      model: null,
      execution_mode: "synthetic",
      fallback_reason: "ai_disabled",
      parse_error: false,
    });
    expect(stageProvenanceUsesAI(provenance)).toBe(false);
  });

  it("keeps AI provenance when model output degrades into a parse warning", () => {
    const prompt = getStagePrompt("draft");

    const provenance = buildStageProvenance({
      prompt,
      executionMode: "ai",
      parseError: true,
    });

    expect(provenance).toEqual({
      prompt_key: "triage.draft",
      prompt_version: "v1",
      provider: TRIAGE_PROVIDER,
      model: TRIAGE_MODEL_ID,
      execution_mode: "ai",
      fallback_reason: null,
      parse_error: true,
    });
    expect(stageProvenanceUsesAI(provenance)).toBe(true);
  });
});
