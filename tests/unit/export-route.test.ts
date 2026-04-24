import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const query = {
  eq: vi.fn(() => query),
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

describe("GET /api/runs/[runId]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select });
    select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
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
});
