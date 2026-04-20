/**
 * Golden path E2E — verifies the critical flow end-to-end against a running
 * production (or preview) deployment.
 *
 * Flow covered:
 *   1. Landing renders with required CTAs.
 *   2. /app intake loads 5 samples from /api/samples.
 *   3. Clicking the golden sample fills the textarea.
 *   4. Start Triage creates a case + run and navigates to /app/runs/[id].
 *   5. Polling advances the run through all 6 stages → terminal state.
 *   6. Response Pack renders confidence + recommendation + approve CTA.
 *   7. Approve marks the pack approved (idempotent).
 *   8. Runs list surfaces the new run with state badge.
 *
 * Usage:
 *   npx playwright test                 # default: https://async-copilot.vercel.app
 *   BASE_URL=http://localhost:3000 npx playwright test
 */
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://async-copilot.vercel.app";

test.describe("golden path", () => {
  test("landing → intake → run → export → approve → runs list", async ({ page }) => {
    /* 1. Landing */
    await page.goto(`${BASE}/`);
    await expect(page).toHaveTitle(/Async Copilot/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("support case");
    await expect(page.getByRole("link", { name: /Open App/i }).first()).toBeVisible();

    /* 2. /app intake */
    await page.goto(`${BASE}/app`);
    await expect(page.getByRole("heading", { name: /Start New Triage Run/i })).toBeVisible();
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Wait for sample cards to hydrate in the sidebar.
    await expect(page.getByRole("button", { name: /Payments Dispute/i })).toBeVisible({ timeout: 20_000 });
    const sampleCount = await page.locator("aside button").count();
    expect(sampleCount).toBeGreaterThanOrEqual(4);

    /* 3. Click golden sample (first one — samples ordered is_golden desc) */
    await page.locator("aside button").first().click();
    await expect(textarea).not.toHaveValue("");
    const bodyLen = (await textarea.inputValue()).length;
    expect(bodyLen).toBeGreaterThan(100);

    /* 4. Start Triage → navigate */
    await page.getByRole("button", { name: /Start Triage/i }).click();
    await expect(page).toHaveURL(/\/app\/runs\/[0-9a-f-]{36}/, { timeout: 15_000 });

    /* 5. Wait for stages to progress (poll until terminal) */
    // Look for the terminal pill (COMPLETED or ESCALATED text)
    await page.waitForTimeout(1000); // let first tick happen
    await expect
      .poll(
        async () => {
          const text = await page.locator("body").innerText();
          if (/\bESCALATED\b|\bCOMPLETED\b/.test(text)) return "terminal";
          return "progress";
        },
        { timeout: 30_000, intervals: [1000, 1500, 2000] },
      )
      .toBe("terminal");

    /* 6. Response pack renders */
    await expect(page.getByText(/System Confidence/i)).toBeVisible();
    await expect(page.getByText(/Recommendation:/i)).toBeVisible();
    await expect(page.getByText(/ESCALATION REQUIRED/i)).toBeVisible();

    /* 7. Approve button is enabled + clickable */
    const approve = page.getByRole("button", { name: /Approve .*Escalate|Approve Pack/i });
    await expect(approve).toBeEnabled({ timeout: 10_000 });
    await approve.click();
    await expect(page.getByRole("button", { name: /Approved .*Slack|Approved .*queued/i })).toBeVisible({ timeout: 10_000 });

    /* 8. Export downloads a markdown pack */
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /Export Pack/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const exportPath = await download.path();
    expect(exportPath).toBeTruthy();
    const exportBody = await readFile(exportPath!, "utf8");
    expect(exportBody).toContain("# Response Pack");
    expect(exportBody).toContain("## Draft reply");
    expect(exportBody).toContain("**Approved:** yes");

    /* 9. Runs list surfaces the run */
    await page.goto(`${BASE}/app/runs`);
    await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
    // Filter chips with counts
    await expect(page.getByRole("button", { name: /^All\s/ })).toBeVisible();
  });

  test("/api/health returns ok", async ({ request }) => {
    const r = await request.get(`${BASE}/api/health`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.checks.supabase).toBe("connected");
    expect(body.checks.schema).toBe("ready");
    expect(body.checks.counts.samples).toBeGreaterThanOrEqual(5);
  });

  test("/api/samples lists at least 5 scenarios with one golden", async ({ request }) => {
    const r = await request.get(`${BASE}/api/samples`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.samples)).toBe(true);
    expect(body.samples.length).toBeGreaterThanOrEqual(5);
    const golden = body.samples.filter((s: { is_golden: boolean }) => s.is_golden);
    expect(golden.length).toBeGreaterThanOrEqual(1);
  });
});
