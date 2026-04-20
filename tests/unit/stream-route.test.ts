import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({
  isAIEnabled: () => false,
  triageModel: null,
}));

import { GET } from "@/app/api/runs/[runId]/stream/route";

describe("GET /api/runs/[runId]/stream", () => {
  it("returns 501 when AI streaming is unavailable", async () => {
    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/stream");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: "AI streaming not available — GROQ_API_KEY not configured",
    });
  });
});
