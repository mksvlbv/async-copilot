# GitHub Hiring Readiness Audit — 2026-04-26

This audit records the strict hiring-ready cleanup pass for the public Async Copilot repository.

## Scope

Audited surfaces:

- root repository files
- README and reviewer docs
- Git-tracked file inventory
- ignored local files
- GitHub Actions configuration
- environment templates
- public demo assets
- history search for current local secret values

Runtime product behavior, schema, integrations, and export logic were intentionally left out of scope.

## Baseline

- Branch: `main`
- Starting commit: `9bc3a5e docs: package demo reviewer assets`
- Remote: `https://github.com/mksvlbv/async-copilot.git`
- Worktree state before cleanup: clean for tracked files

## Findings

### 1. Public repo clutter

Tracked clutter was found in files that do not help a hiring reviewer:

- `scratch/Interview_Cheat_Sheet.html`
- `scratch/chronosync`
- root-level `AI_ARCHITECTURE.md`
- duplicate full-page screenshots under `docs/design/screen full page/`
- offline Variant HTML copies
- vendored design fonts/icons under `docs/design/variant-exports/_vendor/`

Resolution: removed from the public repository. Runtime code does not depend on these files.

### 2. Secret exposure check

Local real credentials were present in ignored files:

- `.env.local`
- `.vercel/*.local`

These files are ignored and were not tracked. Exact Git history search for the current local Supabase and Groq values did not find matching commits.

Resolution: no history rewrite required based on this audit. Keep GitHub secret scanning and push protection enabled.

### 3. README presentation drift

The README had strong content but was too broad and contained stale or generic claims:

- old `5-table data model` language
- generic skill bullets that read like a checklist
- repository map drift from the current workspace routes
- design-export wording that implied vendored assets were part of the current public package

Resolution: rewrite toward a compact AI Product Engineer case-study narrative with evidence-backed claims.

### 4. CI / lint hygiene

`next lint` was deprecated in Next.js 15 and scheduled for removal in Next.js 16.

Resolution: migrate `lint` to the ESLint CLI and keep the lint scope focused on runtime/config surfaces (`src`, `scripts`, `eslint.config.mjs`) so the replacement matches the previous practical intent without expanding into unrelated legacy test noise.

## Repository hygiene after cleanup

Expected clean public shape:

- no tracked scratch directory
- no tracked local env files
- no tracked `.next`, logs, or tsbuildinfo
- no vendored design-font dump
- demo assets remain in `public/demo/`
- useful design references remain as screenshots/source HTML plus `docs/design/design-system.md`

## Recommended GitHub settings

Enable these repository security settings in GitHub:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection
- Private vulnerability reporting if available

A `SECURITY.md` file is now present so GitHub can surface vulnerability-reporting expectations.

## Validation checklist

Run before push:

- `npm test`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm audit --omit=dev --audit-level=high`
- `git ls-files -ci --exclude-standard`
- targeted secret grep over tracked files

## Result

The repository is being shaped as a polished flagship project for the positioning: AI Product Engineer / Applied AI Engineer building workflow software with trust boundaries, integrations, and evidence.
