/**
 * Lighthouse CI — perf / a11y / SEO / best-practices gate.
 * Runs against production URLs. PR-blocking budgets below.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        "https://async-copilot.vercel.app/",
        "https://async-copilot.vercel.app/app",
        "https://async-copilot.vercel.app/app/samples",
        "https://async-copilot.vercel.app/app/runs",
      ],
      numberOfRuns: 2, // median of 2 — balances noise vs cost
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage", // free 7-day retention
    },
  },
};
