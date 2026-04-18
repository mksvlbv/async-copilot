import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("ip1").success).toBe(true);
    expect(limiter.check("ip1").success).toBe(true);
    expect(limiter.check("ip1").success).toBe(true);
  });

  it("blocks requests exceeding the limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("ip2");
    limiter.check("ip2");
    const result = limiter.check("ip2");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip-a").success).toBe(true);
    expect(limiter.check("ip-b").success).toBe(true);
    expect(limiter.check("ip-a").success).toBe(false);
    expect(limiter.check("ip-b").success).toBe(false);
  });

  it("reports correct remaining count", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    expect(limiter.check("ip3").remaining).toBe(4);
    expect(limiter.check("ip3").remaining).toBe(3);
    expect(limiter.check("ip3").remaining).toBe(2);
  });
});
