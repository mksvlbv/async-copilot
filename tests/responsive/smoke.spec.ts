import { expect, test, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  mockVisualApis,
  stabilizePage,
} from "./helpers";

const publicRoutes = [
  {
    name: "landing",
    path: "/",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("support case");
      await expect(page.getByRole("link", { name: /Open App/i }).first()).toBeVisible();
    },
  },
  {
    name: "login",
    path: "/login",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Sign in to the triage workspace/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Send Magic Link/i })).toBeVisible();
    },
  },
  {
    name: "privacy",
    path: "/legal/privacy",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Privacy Notice/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Back to landing/i }).first()).toBeVisible();
    },
  },
  {
    name: "not-found",
    path: "/missing-responsive-route",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /This run doesn.*exist/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Open workspace/i })).toBeVisible();
    },
  },
];

const harnessRoutes = [
  {
    name: "intake",
    path: "/__visual/intake?sample=payments-dispute",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Start New Triage Run/i })).toBeVisible();
      await expect(page.getByText("Sample Loaded")).toBeVisible();
      await expect(page.getByRole("button", { name: /Start Triage/i })).toBeVisible();
    },
  },
  {
    name: "runs",
    path: "/__visual/runs",
    assert: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /^Runs$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Billing dispute resolved with finance timeline/i }).first()).toBeVisible();
    },
  },
  {
    name: "live-run-running",
    path: "/__visual/live-run-running",
    assert: async (page: Page) => {
      await expect(page.getByText(/Case Context/i).first()).toBeVisible();
      await expect(page.getByText(/Response Pack/i).first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: /Payment dispute with duplicate charge/i })).toBeVisible();
    },
  },
  {
    name: "live-run-completed",
    path: "/__visual/live-run-completed",
    assert: async (page: Page) => {
      await expect(page.getByText(/System Confidence/i)).toBeVisible();
      await expect(page.getByText(/Pack Provenance/i)).toBeVisible();
      await expect(page.getByText(/Draft Reply/i)).toBeVisible();
    },
  },
  {
    name: "live-run-escalated",
    path: "/__visual/live-run-escalated",
    assert: async (page: Page) => {
      await expect(page.getByText(/ESCALATION REQUIRED/i)).toBeVisible();
      await expect(page.getByText(/Approval History/i)).toBeVisible();
      await expect(page.getByText(/Action Log/i)).toBeVisible();
    },
  },
];

test.describe("@smoke public responsive coverage", () => {
  for (const route of publicRoutes) {
    test(`${route.name} stays usable across breakpoints`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await route.assert(page);
      await stabilizePage(page);
      await assertNoHorizontalOverflow(page);
    });
  }
});

test.describe("@smoke harness responsive coverage", () => {
  test.beforeEach(async ({ page }) => {
    await mockVisualApis(page);
  });

  for (const route of harnessRoutes) {
    test(`${route.name} stays readable across breakpoints`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await route.assert(page);
      await stabilizePage(page);
      await assertNoHorizontalOverflow(page);
    });
  }
});
