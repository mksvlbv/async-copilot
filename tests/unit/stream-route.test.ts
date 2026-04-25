import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/workspace", () => ({
  getSessionUser: vi.fn(async () => ({ id: "user_123", email: "reviewer@example.com" })),
  getRunAccess: vi.fn(async () => ({
    run: { workspace_id: "ws_123" },
  })),
}));

vi.mock("@/lib/ai/client", () => ({
  isAIEnabled: () => false,
  triageModel: null,
}));

import { GET } from "@/app/api/runs/[runId]/stream/route";

describe("GET /api/runs/[runId]/stream", () => {
  it("returns 204 when AI streaming is unavailable", async () => {
    const request = new Request("https://async-copilot.vercel.app/api/runs/run_123/stream");
    const response = await GET(request, { params: Promise.resolve({ runId: "run_123" }) });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});
