import { describe, expect, it } from "vitest";
import { extractGmailCandidateId } from "@/lib/integrations/gmail";

describe("extractGmailCandidateId", () => {
  it("accepts supported Gmail ids and perm links", () => {
    expect(extractGmailCandidateId("19dc04581d3d5e33")).toBe("19dc04581d3d5e33");
    expect(
      extractGmailCandidateId(
        "https://mail.google.com/mail/u/0/?permmsgid=msg-f:19dc04581d3d5e33",
      ),
    ).toBe("19dc04581d3d5e33");
  });

  it("rejects Gmail browser URLs that only contain FMfc UI tokens", () => {
    expect(() =>
      extractGmailCandidateId(
        "https://mail.google.com/mail/u/0/#inbox/FMfcgzQgLXpfdxJrbXbswmzcBzMHPjfp",
      ),
    ).toThrow("raw Gmail message/thread id");
  });
});
