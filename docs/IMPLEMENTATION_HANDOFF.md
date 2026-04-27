# Implementation Handoff — Async Copilot

**Status**: v1 shipped, v2 spec approved
**Last updated**: 2026-04-24
**Prepared by**: planning phase (CE + Variant)

This document is the original MVP implementation handoff. For any new work, read the v2 spec first and treat this file as historical build context unless the v2 spec explicitly points back here.

---

## 1. Context stack (read in this order)

1. `docs/brainstorms/2026-04-24-async-copilot-v2-spec.md` — current source of truth for product direction and milestone order
2. `docs/ideation/2026-04-17-async-copilot-ideation.md` — original product concept, screen inventory, build slices
3. `docs/brainstorms/2026-04-18-async-copilot-requirements.md` — 22 requirements (R1–R22), success criteria, scope boundaries
4. `docs/plans/2026-04-18-001-feat-async-copilot-demo-plan.md` — MVP implementation plan with dependencies and test scenarios
5. `docs/design/2026-04-18-variant-brief.md` — Variant.com design brief (6 screen prompts)
6. `docs/design/variant-exports/README.md` — tech stack detected, fixes to apply, visual DNA summary
7. `docs/design/variant-exports/{01-06}/` — reference `index.html` + screenshot + source URL for each of 6 screens

### Important note
Sections below describe the shipped MVP build path. They remain useful for historical context and design intent, but they do not override the v2 spec.

---

## 2. Frozen tech stack

From the plan:

- **Framework**: Next.js 15 App Router (single codebase for marketing + app)
- **Database**: Supabase (persistence, seeds, migrations)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (already used by Variant exports — no migration needed)
- **Fonts**: Inter + JetBrains Mono via `next/font/google`
- **Icons**: `@phosphor-icons/react`
- **Testing**: Playwright (E2E) + Vitest or Jest (unit/component)

Package manager: npm (use `package-lock.json`).

Do **not** introduce additional UI libraries (shadcn, Radix, Headless UI) unless a plan unit specifically requires them. The Variant designs use raw Tailwind — keep that discipline.

---

## 3. Design system extraction — first task

The Variant exports remain useful as historical design references:
- Each `index.html` contains compiled Tailwind CSS inline (24-30 KB `<style>` block)
- No JavaScript — designs are static markup
- The public repo keeps the slim reference set only: `index.html`, `screenshot.png`, and `source-url.txt`
- Old offline duplicates and vendored font/icon dumps were removed during GitHub hiring-readiness cleanup

To inspect any screen during implementation, open `docs/design/variant-exports/01-landing/index.html` or review the paired screenshots in the same folders.

Before scaffolding, Cascade should:

1. Open `docs/design/variant-exports/01-landing/index.html`
2. Extract all design tokens into `docs/design/design-system.md`:
   - **Colors**: every unique hex/rgba used, mapped to semantic names (`--color-surface`, `--color-text-primary`, `--color-accent-warning`, etc.)
   - **Typography**: font families, sizes, weights, line heights, letter spacing used
   - **Spacing scale**: common `p-*`, `m-*`, `gap-*` values in use
   - **Radius**: `rounded-*` values used
   - **Shadows**: any `shadow-*` or custom shadow classes
   - **Transitions**: `transition-*` and `duration-*` patterns
   - **Component atoms**: button variants (primary, secondary, destructive), input, textarea, chip, badge, card, nav item — with Tailwind class recipes
3. Cross-check with the other 5 HTML files for consistency. If any screen drifts, note it but use the Landing as canonical truth.
4. Commit `docs/design/design-system.md` before starting Unit 1.

This becomes the reference for every component built afterward.

---

## 4. Plan-mandated content and scope fixes

Apply these while building — do **not** regenerate Variant designs:

### Landing page (`app/(marketing)/page.tsx`)

- Hero subhead: `Messy content in` → `Messy case in`
- Remove line `Integrates seamlessly with Zendesk, Intercom, and Jira` (violates R21 no-integrations)
- Closing CTA: `Start Workspace Trial` → `Open Demo`
- Closing CTA: `Talk to Sales` → `Contact`

### New Case screen (`app/(app)/app/page.tsx`)

- Remove `Knowledge Base` from app nav (not in R21 scope)

### Completed Run (`app/(app)/app/runs/[runId]/page.tsx` — completed state)

- Primary CTA: `Approve Pack & Execute Actions` → `Approve Pack & Queue Actions`
- Reason: R21 prohibits autonomous action. Queued actions with explicit user trigger is the correct boundary.
- Add a confirmation step before any `Issue Stripe Refund`-style staged action actually executes. In MVP these are demo-only — wire the button to a toast or modal that logs the intended action, do not perform a real external call.

### Runs List (`app/(app)/app/runs/page.tsx`)

- Remove the `Today's Digest` right rail entirely. Reason: R21 cuts analytics dashboards.
- If retention is desired, keep one minimal heartbeat line at top of page: `Avg confidence across completed runs: 87%` — no trends, no multi-metric panel.

### All screens

- Unify urgency color palette: choose red OR amber for `High`, apply everywhere
- Keep `System Idle / System Active` status chip in app-shell header (already consistent across designs)
- Strip all `vid="..."` debug attributes from Variant HTML during port

---

## 5. Unit execution order (from plan)

```
Unit 1  → Next.js scaffold (app router + styles + Phosphor + fonts + Tailwind)
Unit 2  → Supabase schema + seeds (payments-dispute golden case + 4 samples)
Unit 3  → Server routes: /api/cases, /api/runs, /api/runs/[id]/advance, approve, export
Unit 4  → Landing page port (use 01-landing/index.html as reference)
Unit 5  → App shell + case intake (use 02-new-case/index.html)
Unit 6  → Signature screen: live triage run + evidence (use 03-live-triage-run/index.html)
         ↳ add polling client for active runs (hit /api/runs/[id]/advance, stop on terminal state)
Unit 7  → Response pack panel + approve/copy/export actions (use 04-completed-run/index.html)
Unit 8  → Runs list + samples library (use 05-runs-list + 06-samples)
Unit 9  → Golden-path integration + E2E tests + polish
```

Dependencies between units are in the plan's Mermaid diagram. Critical path: **1 → 2 → 3 → 6 → 7 → 9**.

---

## 6. Model allocation strategy (for the user, not Cascade)

This is a cost/quality note. Cascade itself should just build whatever unit is assigned:

| Unit | Recommended environment | Reason |
|---|---|---|
| Unit 1–2 (scaffold + schema) | Windsurf/Cascade (Opus 4.6) | architectural, worth the quota |
| Unit 3 (run lifecycle APIs) | Windsurf/Cascade (Opus 4.6) | domain-critical logic |
| Unit 4 (landing) | Trae (GPT-5) or Claude Code CLI | mostly markup |
| Unit 5 (intake) | Trae (GPT-5) | form logic, straightforward |
| Unit 6 (signature screen) | Windsurf/Cascade (Opus 4.6) | portfolio hero, must be right |
| Unit 7 (response pack) | Windsurf/Cascade (Opus 4.6) | complex state |
| Unit 8 (secondary surfaces) | Trae (GPT-5) | tables and lists |
| Unit 9 (integration + polish) | Windsurf/Cascade, then Trae + impeccable skill | heavy reasoning then detail pass |

This only matters if Cascade quota becomes a constraint. If not, just build everything in one place.

---

## 7. Acceptance criteria for each unit

Every unit must meet its **Verification** bullet from the plan (see plan doc). In addition, the whole MVP ships only when:

- Every requirement R1–R22 from `brainstorms/...requirements.md` is demonstrably satisfied
- Golden path E2E test passes: landing → open app → paste payments dispute → run progresses → response pack approved → pack exported
- Low-confidence path E2E test passes: sample case with ambiguous evidence → run completes with `ESCALATION REQUIRED` → operator can still approve/escalate
- Refreshing any live or completed run page resumes from persisted server state (no client-only state loss)
- No `console.error` or hydration warnings in the browser during the golden flow
- Lighthouse score ≥ 90 on Landing, ≥ 85 on app routes (performance + accessibility)

---

## 8. Out of scope for MVP (confirm before adding anything)

From R21:
- No authentication, user accounts, or RBAC
- No real ticketing integrations (Zendesk, Intercom, Jira — do not wire)
- No email sending or outbound delivery
- No queue management beyond simple runs list
- No collaboration, comments, assignees, or permissions
- No analytics dashboards
- No admin surfaces
- No autonomous ticket handling — `Issue Stripe Refund` and similar are **staged, queued, manually triggered only**

If you find yourself implementing any of the above, stop and re-read R21.

---

## 9. First Cascade session prompt (copy-paste)

When opening Cascade in Windsurf for the first time, paste this:

```
I'm ready to implement Async Copilot. Context you need is already in the repo.

Step 1 — read these in order:
  docs/IMPLEMENTATION_HANDOFF.md
  docs/plans/2026-04-18-001-feat-async-copilot-demo-plan.md
  docs/brainstorms/2026-04-18-async-copilot-requirements.md
  docs/design/variant-exports/README.md
  docs/design/variant-exports/01-landing/index.html

Step 2 — extract design tokens from 01-landing/index.html into
docs/design/design-system.md following the spec in section 3 of the
handoff. Cross-check against the other 5 exports for consistency.

Step 3 — when design-system.md is committed, begin Unit 1 (Next.js
scaffold). Follow the plan's Unit 1 file list, approach, and
verification criteria exactly.

Constraints:
- Apply the fixes listed in section 4 of the handoff while porting.
- Do not introduce UI libraries beyond what section 2 specifies.
- Do not add features from section 8 (out of scope).
- Stop and ask before skipping any unit or deviating from the plan.
```
