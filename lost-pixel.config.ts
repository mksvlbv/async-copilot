import type { CustomProjectConfig } from "lost-pixel";

/**
 * Lost Pixel — visual regression baseline.
 *
 * Screenshots 4 public routes × 3 breakpoints (mobile 375, tablet 768,
 * desktop 1440). First run writes the baseline into `.lostpixel/baseline/`;
 * subsequent runs diff against that baseline and annotate PRs.
 */
export const config: CustomProjectConfig = {
  pageShots: {
    pages: [
      { path: "/", name: "landing" },
      { path: "/app", name: "app-intake" },
      { path: "/app/samples", name: "app-samples" },
      { path: "/app/runs", name: "app-runs" },
    ],
    breakpoints: [375, 768, 1440],
    baseUrl: "https://async-copilot.vercel.app",
  },
  lostPixelProjectId: "async-copilot-local",
  apiKey: process.env.LOST_PIXEL_API_KEY, // optional — only for Lost Pixel Cloud
  generateOnly: !process.env.LOST_PIXEL_API_KEY, // local-only mode
  failOnDifference: true,
  imagePathBaseline: ".lostpixel/baseline",
  imagePathCurrent: ".lostpixel/current",
  imagePathDifference: ".lostpixel/difference",
  threshold: 0.01, // 1% pixel-diff tolerance
  waitBeforeScreenshot: 1500, // let animations settle
};
