---
date: 2026-04-24
topic: async-copilot-v2
status: approved-spec
---

# Async Copilot v2 Spec

## Why v2 exists
Async Copilot v1 already proves a meaningful AI workflow slice: server-owned run progression, SSE streaming, approval-gated Slack dispatch, fallback handling, tests, CI, and reviewer-facing documentation.

It still reads as a strong portfolio demo rather than a product-grade AI business system because the current release has no auth, no workspace model, no roles, no real ingestion source, and only limited trust/evaluation surfaces.

v2 exists to move the repo from `strong AI demo builder` proof into `credible AI Product Engineer` proof.

## Hiring Goal
Async Copilot v2 must prove that its author can build AI-powered workflow software for messy business systems, not just polished UI around a model call.

Specifically, v2 should demonstrate:

- end-to-end product thinking for a real B2B workflow
- auth, workspaces, and role boundaries
- integration-heavy delivery with one real inbound source and one real outbound action
- human approval as a product trust boundary
- auditable execution with event history and action status
- a clear path to evaluation, telemetry, and reviewer evidence

## Primary User
- Support operations lead at a small B2B SaaS team
- Senior support reviewer handling ambiguous escalations from a shared inbox
- Operations-minded generalist who needs speed, visibility, and human control before any outbound action

## Primary Scenario
Async Copilot v2 is a support and ops triage workspace for B2B teams.

The narrow scenario is:

1. A new escalation arrives in a shared Gmail inbox.
2. The system ingests the email thread into the correct workspace.
3. Async Copilot creates a run and executes a visible staged triage flow.
4. The run produces a summary, draft reply, internal note, confidence signal, and recommended next actions.
5. A human reviewer inspects the run timeline and approves the outbound step.
6. The approved output is posted to Slack for team coordination and handoff.

This keeps the project focused on one messy but realistic workflow instead of trying to become a generic agent platform.

## Integration Choices

### Source of truth
- **Chosen source integration:** Gmail shared inbox ingestion
- Why this choice:
  - real business signal without turning the project into a ticketing clone
  - natural fit for messy inbound requests and escalations
  - strong bridge between product workflows and AI-assisted triage

### Controlled outbound action
- **Chosen action integration:** Slack workspace post after approval
- Why this choice:
  - Slack already exists as the clearest real action boundary in v1
  - it demonstrates human approval, dispatch status, and operational handoff
  - it is more believable than pretending the system autonomously replies to customers

### Deferred alternatives
- Zendesk
- Intercom
- Jira or Linear

These stay out of the first v2 build so the flagship gains depth before breadth.

## What Changes From v1

- from single-user intake demo to authenticated multi-workspace product
- from direct case creation in the UI to real inbound Gmail ingestion
- from coarse run state to durable run event history
- from one approval moment to approval history plus action status tracking
- from fallback-heavy final pack logic to more model-driven output with clearer telemetry hooks
- from portfolio demo framing to product-grade reviewer narrative

## V2 Scope

### Foundation
- auth
- workspace model
- role model (`admin`, `reviewer`, `operator`)
- server-owned event model
- run history and richer terminal states

### Workflow layer
- Gmail connection per workspace
- ingestion-to-case materialization
- async/background run execution
- Slack dispatch with dry-run and live status
- retries and basic idempotency for ingestion and dispatch

### Trust layer
- audit log per run
- approval history
- action log with timestamps and actor identity
- traceable event timeline exposed in the UI

### Evaluation and evidence layer
- golden-case dataset
- prompt/version registry
- latency, fallback, and cost tracking
- reviewer evidence docs and demo assets

### Python layer
- extract one meaningful subsystem into Python after the TS foundation is stable
- preferred candidates: eval worker or ingestion processor

## Trust Model

- AI can classify, summarize, draft, and recommend.
- AI cannot autonomously send customer-facing communication.
- Every outbound action remains approval-gated.
- Every material state transition should be represented as a persisted event.
- The UI must clearly distinguish real integration outcomes, dry runs, and fallback behavior.

## System Boundaries

### In scope
- one workflow
- one inbound source
- one outbound action
- one clear reviewer narrative

### Out of scope for v2 foundation
- generic chat assistant behavior
- multiple inbound systems at once
- autonomous replies to customers
- full ticket queue management suite
- broad analytics before event and audit foundations exist
- unrelated new flagship projects

## Architecture Outline

### 1. Identity and workspace layer
- user auth
- workspace membership
- role-aware access checks
- per-workspace integration credentials

### 2. Ingestion layer
- Gmail sync or webhook-triggered ingestion
- normalization into internal `case` objects
- idempotent case creation rules

### 3. Run engine
- creates a run from an ingested case
- persists staged events rather than only terminal summaries
- supports async execution and retry-safe state transitions

### 4. Review and action layer
- reviewer sees timeline, evidence, summary, and recommended actions
- approval creates an explicit approval event
- Slack dispatch writes action status back into the run record

### 5. Trust and evidence layer
- audit log and approval history
- latency/fallback telemetry
- prompt/version and eval artifacts for reviewer trust

## Success Criteria

- A reviewer can explain the product in one sentence: `an AI-assisted workspace that ingests shared inbox cases, runs staged triage, and posts approved handoff output to Slack`.
- The product no longer reads as a single-user demo.
- A run can start from a real Gmail message.
- A Slack handoff can happen only after explicit approval.
- Every run exposes a timeline of meaningful events.
- README and docs clearly state what is real, what is fallback, and what is deferred.
- The repo is ready for a later eval layer and one Python subsystem without re-framing the whole product.

## Milestone Order After This Spec

1. **Build Foundation**
   - auth
   - workspace model
   - roles
   - event model
   - run history

2. **Build Real Workflow Layer**
   - Gmail ingestion
   - async execution
   - retries and idempotency
   - Slack action status

3. **Build Trust, Evaluation, and Evidence**
   - audit log
   - approval history
   - prompt/version tracking
   - golden-case eval suite
   - telemetry and reviewer assets

4. **Add Python Layer**
   - extract one subsystem with a documented reason

## Immediate Next Step
Turn the foundation section into a concrete implementation backlog: schema changes, auth tasks, workspace tasks, role checks, and event-model tasks.
