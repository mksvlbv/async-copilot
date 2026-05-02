import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import {
  getVisualRunFixture,
  getVisualSamplesFixture,
  getVisualSimilarCasesFixture,
} from "../../src/lib/testing/visual-fixtures";

export const visualProjectNames = new Set([
  "mobile-375",
  "tablet-768",
  "laptop-1280",
  "desktop-1440",
]);

export const a11yProjectNames = new Set([
  "mobile-375",
  "tablet-768",
  "desktop-1440",
]);

export async function mockVisualApis(page: Page) {
  await page.route("**/api/samples", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ samples: getVisualSamplesFixture() }),
    });
  });

  await page.route("**/api/cases/*/similar*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ similar: getVisualSimilarCasesFixture() }),
    });
  });

  await page.route("**/api/runs/*/stream", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });

  await page.route("**/api/runs/*/advance", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/runs/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const runId = pathname.split("/").at(-1);

    if (runId === "run_visual_running") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run: getVisualRunFixture("running") }),
      });
      return;
    }

    if (runId === "run_visual_completed") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run: getVisualRunFixture("completed") }),
      });
      return;
    }

    if (runId === "run_visual_escalated") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run: getVisualRunFixture("escalated") }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unknown visual harness run" }),
    });
  });
}

export async function stabilizePage(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `,
  });

  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });
}

export async function assertNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    sizes.scrollWidth,
    `Expected no horizontal overflow, got scrollWidth=${sizes.scrollWidth} and clientWidth=${sizes.clientWidth}`,
  ).toBeLessThanOrEqual(sizes.clientWidth + 1);
}

export async function runAxe(page: Page) {
  return new AxeBuilder({ page }).analyze();
}

export async function takeStableScreenshot(
  page: Page,
  name: string,
  options?: {
    maxDiffPixels?: number;
  },
) {
  await stabilizePage(page);
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    ...options,
  });
}
