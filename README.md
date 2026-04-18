# Async Copilot

**Visible staged triage for support teams under pressure. Messy case in, structured response pack out.**

Live demo: **https://async-copilot.vercel.app**

A full-stack portfolio demo that shows a support-triage pipeline end-to-end: landing page → case intake → live-run signature screen → completed response pack. Built with Next.js 15 App Router, Supabase (Postgres), and Tailwind.

---

## Try it

1. Open the landing — https://async-copilot.vercel.app
2. Click **Open App** → intake form
3. Click the **Payments Dispute — Duplicate Charge** scenario card (golden path)
4. Hit **Start Triage** → watch the 6-stage timeline progress in real time
5. When it reaches terminal state (~5 sec), inspect the Response Pack, **Approve Pack & Queue Actions**, or **Export Pack** (markdown download)
6. Navigate to **Runs** or **Samples** in the header to browse

Try **Paste** instead: type or paste your own case body in the textarea → it still creates a real case + run with a generic fallback response pack.

---

## Surfaces

| Route | Purpose |
|---|---|
| `/` | Marketing landing — 7 sections (header, hero + workspace mockup, how-it-works, system trust, response pack showcase, closing CTA, footer) |
| `/app` | **New Case** intake form + live sample picker |
| `/app/runs/[runId]` | **Live Triage Run** signature screen: Case Context / Visible Triage / Response Pack (polling → terminal → approve / export) |
| `/app/runs` | Runs list with live search, state chip filters, progress + confidence columns |
| `/app/samples` | Scenario library — Golden Path + Alternatives, with body preview |
| `/api/health` | Machine-readable env + schema + row-count snapshot |
| `/api/samples` · `/api/cases` · `/api/runs` · `/api/runs/[id]` | REST endpoints |
| `/api/runs/[id]/advance` · `/approve` · `/export` | Run lifecycle mutations + export |

---

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript, typedRoutes, `next/font/google`)
- **Styling**: Tailwind CSS 3.4 with design tokens extracted from Variant exports
- **Icons**: `@phosphor-icons/react` (server-side rendered SVG)
- **Database**: Supabase Postgres 17 (`eu-west-1` / Ireland)
- **Auth client**: `@supabase/ssr` (browser + server), `@supabase/supabase-js` (admin)
- **Hosting**: Vercel (Stockholm edge, auto-deploy on every push to `main`)
- **E2E**: Playwright (`tests/golden-path.spec.ts`)

---

## Data model

5 tables, 4 enums, permissive RLS (writes gated through server routes using the secret key):

- `samples` — curated scenario library (read-only in UI)
- `cases` — support-case instances, from intake or materialized from a sample
- `runs` — triage lifecycle (`pending` → `running` → `completed`/`escalated`)
- `run_stages` — 6 stages per run with `output` JSON blobs + `duration_ms`
- `response_packs` — final artifact (confidence, recommendation, summary, draft reply, citations, staged actions)

Schema: `supabase/migrations/001_initial_schema.sql`
Seeds: `supabase/seeds/001_samples.sql` + `002_golden_run.sql`

---

## Run locally

```bash
# 1. Install
npm install

# 2. Fill .env.local (copy .env.example)
#    Three Supabase env vars required:
#      NEXT_PUBLIC_SUPABASE_URL
#      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#      SUPABASE_SECRET_KEY
#      SUPABASE_DB_URL   (for migrations only — server-side)

# 3. One-shot migrate + seed
npm run db:init

# 4. Start dev
npm run dev
# → http://localhost:3000

# 5. Run E2E against prod (or BASE_URL=... for preview/local)
npm run test:e2e
```

Useful scripts:

- `npm run typecheck` — strict TypeScript
- `npm run build` — production build (all 14 routes)
- `npm run lint`
- `npm run db:migrate` · `npm run db:seed` — split init

---

## Key design decisions

- **Server-owned run progression** — every `/advance` call is authoritative on the server. Client polls, client never mutates state directly.
- **Polling over realtime** — `800ms` cadence; stops on terminal state. Simpler than websockets, good enough for a demo.
- **R21 scope boundary** — no auth, no real integrations, no autonomous action. Staged actions stay `queued` until a human clicks Approve.
- **Idempotent schema + seeds** — `npm run db:init` is safe to re-run. Demo environment can be reset cheaply.
- **One source of design truth** — `docs/design/design-system.md` holds all tokens; every screen pulls from there.

---

## Repository map

```
src/
  app/
    layout.tsx, icon.svg, error.tsx, not-found.tsx
    (marketing)/
      page.tsx                         # landing — 7 sections
      _sections/hero-mockup.tsx        # 3-column workspace mockup
    (app)/
      layout.tsx                        # app-shell
      _components/app-header.tsx        # sticky nav with active highlight
      app/
        page.tsx                        # new-case intake (client)
        runs/
          page.tsx                      # server wrapper
          _components/runs-table.tsx    # client filter + table
          [runId]/
            page.tsx                    # server detail loader
            _components/live-run-view.tsx  # signature screen (polling)
        samples/page.tsx                # library with golden + alternatives
    api/
      cases/route.ts                   # GET list, POST create
      samples/route.ts                 # GET list
      runs/route.ts                    # GET list, POST create
      runs/[runId]/route.ts            # GET detail
      runs/[runId]/advance/route.ts    # POST — one stage forward
      runs/[runId]/approve/route.ts    # POST — approve response pack
      runs/[runId]/export/route.ts     # GET — markdown/text/json
      health/route.ts                  # GET — env + schema + counts
  lib/
    supabase/{client,server,admin,types}.ts
    triage/run-model.ts                # stage defs + fallback pack builder
supabase/
  migrations/001_initial_schema.sql
  seeds/{001_samples,002_golden_run}.sql
scripts/db-init.mjs                    # pg-based migrator (no Supabase CLI)
tests/golden-path.spec.ts              # Playwright E2E
docs/
  ideation/        brainstorms/        plans/
  design/
    design-system.md                   # canonical tokens
    variant-exports/                   # downloaded Variant HTML + vendored fonts/icons
```

---

## Deployment

- Every push to `main` → Vercel build → production deploy (~45 sec).
- Env vars are stored in Vercel encrypted storage (Development / Preview / Production).
- Supabase URL/keys are pulled at runtime via `process.env.*`.

---

## Audit tooling

Five tools are wired up for continuous quality checks. All are **opt-in**
— they do not run on every PR by default (kept advisory to avoid merge
friction). Run locally or via GitHub Actions `workflow_dispatch`.

| Script | What it does |
|---|---|
| `npm run audit:links` | **linkinator** — scans the live site for broken links, `href="#"` dead anchors, 404s. |
| `npm run audit:a11y` | **pa11y-ci + axe-core** — WCAG 2 AA scan across public routes. |
| `npm run audit:perf` | **Lighthouse CI** — perf / a11y / SEO / best-practices with enforced budgets (`lighthouserc.cjs`). |
| `npm run audit:visual` | **Lost Pixel** — screenshots 4 routes × 3 breakpoints, diffs against `.lostpixel/baseline/`. |
| `npm run audit:ai` | **Stagehand + Claude** — AI agent navigates the site and reports friction points. Requires `ANTHROPIC_API_KEY`. Costs API credits. |
| `npm run audit` | Chains links → a11y → perf → visual (skips AI). Full non-AI pass. |

GitHub Actions:

- `.github/workflows/audit-lighthouse.yml` — weekly Monday cron + manual trigger
- `.github/workflows/audit-a11y.yml` — weekly Monday cron + manual trigger
- `.github/workflows/audit-linkcheck.yml` — **lychee** on push to `main` + weekly cron
- `.github/workflows/audit-visual.yml` — manual trigger only (baselines are committed)

Each workflow uploads its output as an artifact (14-day retention) so
reports stay accessible without polluting the repo.

### Running a full audit locally

```bash
npm run audit         # links + a11y + perf + visual (no AI)
npm run audit:ai      # AI exploratory pass (opt-in, uses API credits)
```

Artifacts are written to `.lighthouseci/`, `.lostpixel/`, and
`docs/audit/ai-<date>.md` respectively. Baselines for Lost Pixel live in
`.lostpixel/baseline/` and **should be committed** after a visual change
is approved.

### Last audit report

See `docs/audit/2026-04-18.md` for the current baseline scorecard and
fixed findings.

---

## Documents for reviewers

- `docs/ideation/2026-04-17-async-copilot-ideation.md` — product concept
- `docs/brainstorms/2026-04-18-async-copilot-requirements.md` — 22 MVP requirements (R1–R22)
- `docs/plans/2026-04-18-001-feat-async-copilot-demo-plan.md` — 9-unit build plan (what was delivered, unit-by-unit)
- `docs/design/design-system.md` — canonical tokens
- `docs/IMPLEMENTATION_HANDOFF.md` — original entry-point doc for the implementing agent
