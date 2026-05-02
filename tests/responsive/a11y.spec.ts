import { expect, test } from "@playwright/test";
import {
  a11yProjectNames,
  mockVisualApis,
  runAxe,
  stabilizePage,
} from "./helpers";

const routes = [
  { name: "landing", path: "/", needsMocks: false },
  { name: "login", path: "/login", needsMocks: false },
  { name: "intake", path: "/__visual/intake?sample=payments-dispute", needsMocks: true },
  { name: "runs", path: "/__visual/runs", needsMocks: true },
  { name: "live-run-completed", path: "/__visual/live-run-completed", needsMocks: true },
];

test.describe("@a11y responsive browser accessibility", () => {
  for (const route of routes) {
    test(`${route.name} has no serious responsive accessibility violations`, async ({ page }, testInfo) => {
      test.skip(!a11yProjectNames.has(testInfo.project.name), "A11y checks run on a reduced viewport matrix.");

      if (route.needsMocks) {
        await mockVisualApis(page);
      }

      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await stabilizePage(page);

      const results = await runAxe(page);
      const seriousViolations = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        seriousViolations,
        seriousViolations
          .map((violation) => `${violation.impact}: ${violation.id} — ${violation.help}`)
          .join("\n"),
      ).toEqual([]);
    });
  }
});
