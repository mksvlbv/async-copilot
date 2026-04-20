# Async Copilot Reviewer Walkthrough

This document is the recording script for a **60-90 second flagship demo**.

The goal is not to explain every implementation detail. The goal is to help a reviewer understand, quickly and visually, that the project has:

- a real operator use case
- a visible workflow
- honest fallback behavior
- a human approval boundary
- one real outbound integration signal

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
`Async Copilot is a support-triage implementation demo. It takes a messy support case, runs a visible staged workflow, and turns it into an operator-ready response pack.`

### Shot 2 — intake
**Route:** `/app`

**What to show:**
- `Pre-configured Scenarios`
- the golden sample
- the textarea filling after click

**Narration:**
`The operator can start from a seeded scenario or paste a real ticket. The point is to show the full support workflow, not just a prompt box.`

### Shot 3 — run progression
**Route:** `/app/runs/[runId]`

**What to show:**
- visible timeline
- case context panel
- response pack building state
- if available, the live SSE stream badge

**Narration:**
`The run progresses through six visible stages. When Groq is configured, the app streams live model output. Without it, the same flow falls back to deterministic synthetic output.`

### Shot 4 — terminal state
**Route:** same run detail

**What to show:**
- confidence card
- recommendation
- citations
- staged actions
- escalation state if present

**Narration:**
`At the end, the operator gets a structured response pack with confidence, recommendation, citations, and staged actions.`

### Shot 5 — approval and Slack boundary
**Route:** same run detail

**What to show:**
- click `Approve`
- resulting staged action status
- Slack `dry_run`, `executed`, or `failed` badge if visible

**Narration:**
`Nothing is sent automatically. A human has to approve the pack first. After approval, the project can cross one real outbound boundary: a Slack webhook in live or dry-run mode.`

### Shot 6 — export
**Route:** same run detail

**What to show:**
- click `Export Pack`
- downloaded markdown file

**Narration:**
`The pack can also be exported as markdown for handoff, review, or record-keeping.`

### Shot 7 — runs list
**Route:** `/app/runs`

**What to show:**
- finished run in the table
- state badge

**Narration:**
`Runs remain queryable in the workspace, so the system looks like an operational tool rather than a one-shot AI response screen.`

## 30 Second Short Version

If a recruiter or hiring manager only wants the shortest cut, show:

1. `/app`
2. load the golden scenario
3. jump to a finished run
4. show approval + Slack status
5. show export

Short narration:

`This is a support-triage workflow demo. It turns a case into a visible staged run, ends in a structured response pack, requires human approval, and can dispatch an outbound Slack notification in dry-run or live mode.`

## Recording Checklist

- Use one consistent scenario from start to finish.
- Do not show broken local dev overlays.
- If local runtime is unstable, record from the deployed environment.
- Keep the cursor calm; avoid excessive scrolling.
- Do not narrate implementation details that are not visible.
- Keep the wording practical: workflow, approval, fallback, export, integration.

## README Companion

The README already contains:

- `Reviewer Quick Read`
- `Operator Use Case`
- `End-to-End Flow`
- `Proof Map`

Use this walkthrough as the visual companion to those sections.
