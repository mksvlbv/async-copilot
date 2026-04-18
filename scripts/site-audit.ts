/**
 * Stagehand exploratory site audit — an AI agent navigates the live site
 * like a real user and reports friction. Runs manually (npm run audit:ai)
 * because it costs Anthropic API credits.
 *
 * Usage:
 *   1. Set ANTHROPIC_API_KEY in .env.local
 *   2. npm run audit:ai
 *   3. Report is written to docs/audit/ai-<YYYY-MM-DD>.md
 *
 * The agent runs 5 tasks against the public production URL and emits
 * per-task pass/fail with reasoning.
 */
import { Stagehand } from "@browserbasehq/stagehand";
import fs from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const BASE_URL = process.env.AUDIT_BASE_URL ?? "https://async-copilot.vercel.app";

type AuditTask = {
  name: string;
  instruction: string;
};

const TASKS: AuditTask[] = [
  {
    name: "footer-links-reachable",
    instruction:
      "Go to the homepage. Look at the footer. For each link in the footer, click it and report whether it navigated to a real page (not the same URL or a dead anchor). Return a list of { linkText, navigatedTo, isBroken } entries.",
  },
  {
    name: "nav-pages-have-titles",
    instruction:
      "Visit every link in the main navigation at the top of the page. For each destination, report whether the page has a visible heading (h1) and whether the browser tab title is meaningful (not 'Untitled').",
  },
  {
    name: "start-triage-flow",
    instruction:
      "From the intake page, pick the 'payments-dispute-duplicate-charge' sample, then click 'Start Triage'. Wait until the run finishes (state becomes 'completed' or 'escalated'). Report how long it took and whether you saw a draft reply in the Response Pack panel.",
  },
  {
    name: "mobile-horizontal-scroll",
    instruction:
      "Resize the browser to 375px width. Visit the homepage and the intake page. Report whether any content overflows horizontally (causes a horizontal scrollbar) or whether any elements visually overlap each other.",
  },
  {
    name: "find-privacy-policy",
    instruction:
      "Starting from the homepage, try to find a privacy policy or terms of service. Follow any links that look relevant. Report whether you found a real privacy policy page and, if not, explain the failure (e.g. 'footer link Privacy goes to #, is not a real page').",
  },
];

type TaskResult = {
  task: string;
  ok: boolean;
  evidence: string;
  elapsedMs: number;
};

async function runTask(sh: Stagehand, task: AuditTask): Promise<TaskResult> {
  const started = Date.now();
  try {
    // Reset to base on each task
    await sh.page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const result = await sh.agent({
      provider: "anthropic",
      model: "claude-3-5-sonnet-latest",
      instructions:
        "You are a thorough QA engineer auditing a web application. Be concrete, quote exact URLs and element texts when reporting.",
    }).execute(task.instruction);
    return {
      task: task.name,
      ok: true,
      evidence: typeof result === "string" ? result : JSON.stringify(result),
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      task: task.name,
      ok: false,
      evidence: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in .env.local — aborting.");
    process.exit(1);
  }

  console.log(`Stagehand exploratory audit against ${BASE_URL}`);
  console.log(`Running ${TASKS.length} tasks…\n`);

  const sh = new Stagehand({
    env: "LOCAL", // local Playwright Chromium, no Browserbase account needed
    modelName: "claude-3-5-sonnet-latest",
    modelClientOptions: { apiKey: process.env.ANTHROPIC_API_KEY },
    verbose: 1,
  });

  await sh.init();

  const results: TaskResult[] = [];
  for (const task of TASKS) {
    console.log(`► ${task.name}`);
    const r = await runTask(sh, task);
    results.push(r);
    console.log(`  ${r.ok ? "✓" : "✗"} (${r.elapsedMs}ms)\n`);
  }

  await sh.close();

  // Emit markdown report
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join("docs", "audit");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `ai-${today}.md`);

  const md = [
    `# AI Exploratory Audit — ${today}`,
    ``,
    `Target: ${BASE_URL}`,
    `Tasks: ${TASKS.length}`,
    `Model: claude-3-5-sonnet-latest`,
    ``,
    `## Summary`,
    ``,
    `| Task | Status | Elapsed |`,
    `|---|---|---|`,
    ...results.map(
      (r) => `| \`${r.task}\` | ${r.ok ? "✓ pass" : "✗ fail"} | ${r.elapsedMs} ms |`,
    ),
    ``,
    `## Per-task evidence`,
    ``,
    ...results.flatMap((r) => [
      `### ${r.task}`,
      ``,
      "```",
      r.evidence,
      "```",
      ``,
    ]),
  ].join("\n");

  await fs.writeFile(outPath, md, "utf8");
  console.log(`Report written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
