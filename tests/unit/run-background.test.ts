import { describe, expect, it } from "vitest";
import {
  hasActiveExecutionLease,
  retryDelayMsForAttempt,
  runEligibleForBackgroundPickup,
} from "@/lib/runs/background";

describe("run background helpers", () => {
  it("detects an active execution lease", () => {
    expect(
      hasActiveExecutionLease({
        execution_status: "running",
        execution_lease_expires_at: new Date(Date.now() + 30_000).toISOString(),
      }),
    ).toBe(true);

    expect(
      hasActiveExecutionLease({
        execution_status: "running",
        execution_lease_expires_at: new Date(Date.now() - 30_000).toISOString(),
      }),
    ).toBe(false);
  });

  it("picks up queued and due retrying runs, but skips active leases", () => {
    expect(
      runEligibleForBackgroundPickup({
        state: "pending",
        execution_status: "queued",
        execution_next_retry_at: null,
        execution_lease_expires_at: null,
      }),
    ).toBe(true);

    expect(
      runEligibleForBackgroundPickup({
        state: "running",
        execution_status: "retrying",
        execution_next_retry_at: new Date(Date.now() - 5_000).toISOString(),
        execution_lease_expires_at: null,
      }),
    ).toBe(true);

    expect(
      runEligibleForBackgroundPickup({
        state: "running",
        execution_status: "running",
        execution_next_retry_at: null,
        execution_lease_expires_at: new Date(Date.now() + 30_000).toISOString(),
      }),
    ).toBe(false);
  });

  it("backs off retry delay exponentially with a cap", () => {
    expect(retryDelayMsForAttempt(1)).toBe(5_000);
    expect(retryDelayMsForAttempt(2)).toBe(10_000);
    expect(retryDelayMsForAttempt(5)).toBe(60_000);
  });
});
