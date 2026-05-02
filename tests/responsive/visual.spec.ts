import { expect, test } from "@playwright/test";
import {
  mockVisualApis,
  takeStableScreenshot,
  visualProjectNames,
} from "./helpers";

const snapshots = [
  {
    name: "landing",
    path: "/",
    file: "landing-full-page.png",
    needsMocks: false,
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("support case");
    },
  },
  {
    name: "login",
    path: "/login",
    file: "login-full-page.png",
    needsMocks: false,
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Sign in to the triage workspace/i })).toBeVisible();
    },
  },
  {
    name: "privacy",
    path: "/legal/privacy",
    file: "privacy-full-page.png",
    needsMocks: false,
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Privacy Notice/i })).toBeVisible();
    },
  },
  {
    name: "not-found",
    path: "/missing-responsive-route",
    file: "not-found-full-page.png",
    needsMocks: false,
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /This run doesn.*exist/i })).toBeVisible();
    },
  },
  {
    name: "intake",
    path: "/__visual/intake?sample=payments-dispute",
    file: "intake-full-page.png",
    needsMocks: true,
    ready: async (page: Page) => {
      await expect(page.getByText("Sample Loaded")).toBeVisible();
      await expect(page.getByRole("button", { name: /Start Triage/i })).toBeVisible();
    },
  },
  {
    name: "runs",
    path: "/__visual/runs",
    file: "runs-full-page.png",
    needsMocks: true,
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /^Runs$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Billing dispute resolved with finance timeline/i }).first()).toBeVisible();
    },
  },
  {
    name: "live-run-running",
    path: "/__visual/live-run-running",
    file: "live-run-running-full-page.png",
    needsMocks: true,
    screenshotOptions: { maxDiffPixels: 400 },
    ready: async (page: Page) => {
      await expect(page.getByRole("heading", { level: 1, name: /Payment dispute with duplicate charge/i })).toBeVisible();
      await expect(page.getByText(/Triage In Progress/i)).toBeVisible();
      await expect(page.getByText(/^Synthetic$/i)).toBeVisible();
    },
  },
  {
    name: "live-run-completed",
    path: "/__visual/live-run-completed",
    file: "live-run-completed-full-page.png",
    needsMocks: true,
    ready: async (page: Page) => {
      await expect(page.getByText(/Pack Provenance/i)).toBeVisible();
      await expect(page.getByText(/Draft Reply/i)).toBeVisible();
    },
  },
  {
    name: "live-run-escalated",
    path: "/__visual/live-run-escalated",
    file: "live-run-escalated-full-page.png",
    needsMocks: true,
    ready: async (page: Page) => {
      await expect(page.getByText(/Approval History/i)).toBeVisible();
      await expect(page.getByText(/Action Log/i)).toBeVisible();
    },
  },
];

test.describe("@visual responsive visual regression", () => {
  for (const snapshot of snapshots) {
    test(`${snapshot.name} matches the approved responsive baseline`, async ({ page }, testInfo) => {
      test.skip(!visualProjectNames.has(testInfo.project.name), "Visual baselines run on the focused viewport matrix.");

      if (snapshot.needsMocks) {
        await mockVisualApis(page);
      }

      await page.goto(snapshot.path, { waitUntil: "domcontentloaded" });
      await snapshot.ready(page);
      await takeStableScreenshot(page, snapshot.file, snapshot.screenshotOptions);
    });
  }
});
