# Async Copilot Reviewer Walkthrough

This document is the recording script for a **60-90 second flagship demo**.

The goal is not to explain every implementation detail. The goal is to help a reviewer understand, quickly and visually, that the project has:

- an authenticated workspace use case
- a visible staged workflow
- honest live-vs-fallback behavior
- a role-aware human approval boundary
- one real outbound integration signal
- portable review evidence in export

## Recording Goal

Show this sequence clearly:

1. intake
2. live or staged run progression
3. terminal response pack
4. approval
5. Slack dispatch status
6. export

If the whole recording takes longer than 90 seconds, cut detail instead of adding explanation.

## Recommended Recording Setup

- Use the deployed demo or a stable local production build.
- Use a logged-in workspace session so the app opens on a real workspace, not onboarding.
- Use the workspace-scoped routes in the recording; treat legacy `/app/runs` and `/app/samples` pages as redirects, not the canonical demo surface.
- Browser width: desktop.
- Keep the recording focused on the app, not browser chrome.
- Disable noisy notifications and dev overlays.
- Use one clean seeded scenario rather than freeform typing for the main cut.

## 60-90 Second Shot List

### Shot 1 — landing
**Route:** `/`

**What to show:**
- headline
- workspace mockup
- `Open App`

**Narration:**
`Async Copilot is an AI-assisted support and ops triage workspace. It takes a messy case, runs a visible staged workflow, and turns it into a reviewer-ready response pack.`

### Shot 2 — intake
**Route:** `/app/w/[workspaceSlug]`

**What to show:**
- `Pre-configured Scenarios`
- the golden sample
- the textarea filling after click

**Narration:**
`Inside a workspace, the operator can start from a seeded scenario or paste a real ticket. The point is to show a full review workflow, not just a prompt box.`

### Shot 3 — run progression
**Route:** `/app/w/[workspaceSlug]/runs/[runId]`

**What to show:**
- visible timeline
- case context panel
- response pack building state
- if available, the live SSE stream badge

**Narration:**
`The run progresses through six visible stages. When Groq is configured, the app streams live model output. Without it, the same workflow stays visible and falls back to deterministic synthetic output instead of pretending the model ran.`

### Shot 4 — terminal state
**Route:** same run detail

**What to show:**
- confidence card
- recommendation
- citations
- staged actions
- escalation state if present

**Narration:**
`At the end, the operator gets a structured response pack with confidence, recommendation, citations, and staged actions that are still waiting behind the approval boundary.`

### Shot 5 — approval and Slack boundary
**Route:** same run detail

**What to show:**
- click `Approve`
- approval history card
- resulting staged action status
- Slack `dry_run`, `executed`, or `failed` badge if visible

**Narration:**
`Nothing is sent automatically. Operators can inspect the run, but only reviewers and admins can cross the outbound approval boundary. That approval is persisted in history, and only then can the project cross one real outbound boundary: a Slack webhook in live or dry-run mode.`

### Shot 6 — export
**Route:** same run detail

**What to show:**
- click `Export Pack`
- downloaded markdown file

**Narration:**
`The pack can also be exported for handoff or review. The export carries the response pack plus compact trust evidence, including stage lineage, approval history, and the action log.`

### Shot 7 — runs list
**Route:** `/app/w/[workspaceSlug]/runs`

**What to show:**
- finished run in the table
- state badge

**Narration:**
`Runs remain queryable inside the workspace, so the system reads like an operational tool with history rather than a one-shot AI response screen.`

## 30 Second Short Version

If a recruiter or hiring manager only wants the shortest cut, show:

1. `/app/w/[workspaceSlug]`
2. load the golden scenario
3. jump to a finished run
4. show approval history + Slack status
5. show export

Short narration:

`This is an AI-assisted support triage workspace. It turns a case into a visible staged run, ends in a structured response pack, requires reviewer approval before Slack, and exports portable trust evidence for handoff.`

## Recording Checklist

- Use one consistent scenario from start to finish.
- Do not show broken local dev overlays.
- If local runtime is unstable, record from the deployed environment.
- Keep the cursor calm; avoid excessive scrolling.
- Do not narrate implementation details that are not visible.
- Keep the wording practical: workspace, workflow, approval, fallback, export, integration.
- Keep the cut on the workspace-scoped flow; do not switch back to legacy redirect routes during the demo.

## README Companion

The README already contains:

- `Reviewer Quick Read`
- `Operator Use Case`
- `End-to-End Flow`
- `Proof Map`
- `Trust Evidence Snapshot`

Use this walkthrough as the visual companion to those sections.
