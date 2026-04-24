import { describe, expect, it } from "vitest";
import {
  extractGmailCandidateId,
  normalizeGmailThread,
} from "@/lib/integrations/gmail";

describe("gmail integration helpers", () => {
  it("extracts a Gmail id from raw ids and Gmail URLs", () => {
    expect(extractGmailCandidateId("18f4c0ab1234def0")).toBe("18f4c0ab1234def0");
    expect(
      extractGmailCandidateId(
        "https://mail.google.com/mail/u/0/?th=thread-f:18f4c0ab1234def0",
      ),
    ).toBe("18f4c0ab1234def0");
    expect(
      extractGmailCandidateId(
        "https://mail.google.com/mail/u/0/#inbox/18f4c0ab1234def0",
      ),
    ).toBe("18f4c0ab1234def0");
  });

  it("normalizes a Gmail thread into a deterministic case transcript", () => {
    const thread = {
      id: "thread_12345",
      messages: [
        {
          id: "msg_1",
          threadId: "thread_12345",
          internalDate: "1711972800000",
          snippet: "Checkout returns 504",
          payload: {
            mimeType: "multipart/alternative",
            headers: [
              { name: "Subject", value: "Checkout outage" },
              { name: "From", value: "Jane Doe <jane@example.com>" },
              { name: "To", value: "ops@example.com" },
              { name: "Date", value: "Mon, 01 Apr 2026 10:00:00 +0000" },
            ],
            parts: [
              {
                mimeType: "text/plain",
                body: {
                  data: toBase64Url("Hi team,\n\nThe checkout flow is returning 504s for every payment attempt."),
                },
              },
            ],
          },
        },
        {
          id: "msg_2",
          threadId: "thread_12345",
          internalDate: "1711976400000",
          snippet: "We're looking into it",
          payload: {
            mimeType: "text/html",
            headers: [
              { name: "Subject", value: "Re: Checkout outage" },
              { name: "From", value: "Ops Team <ops@example.com>" },
              { name: "To", value: "jane@example.com" },
              { name: "Date", value: "Mon, 01 Apr 2026 11:00:00 +0000" },
            ],
            body: {
              data: toBase64Url("<div>We are looking into it now.</div>"),
            },
          },
        },
      ],
    };

    const normalized = normalizeGmailThread(thread, "ops@example.com");

    expect(normalized.anchorMessageId).toBe("msg_1");
    expect(normalized.customerEmail).toBe("jane@example.com");
    expect(normalized.customerName).toBe("Jane Doe");
    expect(normalized.subject).toBe("Checkout outage");
    expect(normalized.transcript).toContain("Subject: Checkout outage");
    expect(normalized.transcript).toContain("Imported from Gmail thread thread_12345");
    expect(normalized.transcript).toContain("The checkout flow is returning 504s");
    expect(normalized.transcript).toContain("We are looking into it now.");
  });
});

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
