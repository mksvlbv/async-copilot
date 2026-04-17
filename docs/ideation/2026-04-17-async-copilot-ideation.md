---
date: 2026-04-17
topic: async-copilot
focus: premium support triage cockpit + landing page
mode: elsewhere-software
---

# Ideation: Async Copilot

## Grounding Context

### Topic Context
- Async Copilot is a premium support triage cockpit plus landing page.
- It is not a chatbot and not a generic AI dashboard.
- Core formula: support case in -> visible staged triage -> usable response pack out.
- Primary user: support or operations specialist under time pressure.
- They need to understand the case quickly, trust the analysis flow, see what the system is doing step by step, and leave with something practical they can use.
- Secondary audience: hiring managers, tech leads, and product-minded reviewers, so the artifact must show strong product taste in addition to believable operator value.
- First-view promise: this is support operations software; the center timeline is the hero; the system is trustworthy; the output is practical; the design has a real point of view.
- Differentiators: visible staged reasoning, usable handoff pack instead of chat output, workflow built around triage and handoff, and a premium case-console feel.

### Past Learnings
- No relevant learnings were found in this project workspace.

### External Context
- Support and service tooling in the market keeps emphasizing agent copilots, inbox productivity, and automation layers, which creates space for a narrower triage-specific product position.
- Trust in AI workflow products is strengthened when progress is visible, stages are explicit, outputs are inspectable, and claims are tied to evidence rather than theatrical conversation patterns.
- Premium B2B landing pages typically win by showing a single clear workflow, operational seriousness, and concrete outputs rather than feature sprawl.

## Ranked Ideas

### 1. Center-stage triage timeline
**Description:** Make the product revolve around a visible staged triage timeline in the middle column. The timeline becomes the hero interaction and the main trust-building surface, with left-side case context and right-side response pack.
**Rationale:** This best expresses the product's core promise: support case in -> visible staged triage -> usable response pack out. It also sharply separates Async Copilot from chat UIs and generic dashboards.
**Downsides:** Requires strong interaction design and state design to feel credible rather than decorative.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Explored

### 2. Evidence-linked reasoning at every stage
**Description:** Every stage in the timeline should expose why the system reached its conclusion by showing extracted facts, signals, and evidence snippets tied to that stage.
**Rationale:** Operators under pressure need trust and legibility. For portfolio reviewers, this shows product judgment around explainability without turning the UI into a research tool.
**Downsides:** Can get dense if too much evidence is shown at once; needs careful progressive disclosure.
**Confidence:** 92%
**Complexity:** Medium
**Status:** Explored

### 3. Response pack as the real payoff
**Description:** Treat the response pack as the product's output object, not a side panel afterthought. The pack should include a case summary, customer reply draft, internal note, next actions, and escalation recommendation.
**Rationale:** This makes the system practical and operator-first. It reinforces that the value is handoff quality and actionability, not “AI conversation.”
**Downsides:** The pack can become too broad if MVP boundaries are not enforced.
**Confidence:** 94%
**Complexity:** Medium
**Status:** Explored

### 4. Operator checkpoints and control points
**Description:** Give the operator moments to inspect, retry, pause, approve, or copy outputs during and after the triage run.
**Rationale:** Human control increases trust and makes the workflow feel like software for professionals rather than a passive AI demo.
**Downsides:** Too many controls can dilute the elegance of the flow.
**Confidence:** 88%
**Complexity:** Medium
**Status:** Explored

### 5. Premium case-console visual language
**Description:** Design the product like a premium operational console: structured, quiet, deliberate, and high-signal, with no chat bubbles, avatars, or generic analytics-card clutter.
**Rationale:** This is critical both for believable operator software and for the portfolio goal of showing strong taste quickly.
**Downsides:** Easy to undershoot into “clean but forgettable” if the signature screen is not distinctive enough.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Explored

### 6. Landing page mirrors the product workflow
**Description:** The landing page should tell the same 3-step story as the app: case in, staged triage, response pack out. Use the product flow itself as the narrative spine of the marketing page.
**Rationale:** This creates coherence between product and brand, and helps reviewers understand the product thesis instantly.
**Downsides:** Requires discipline to avoid turning the landing page into a generic feature list.
**Confidence:** 91%
**Complexity:** Low
**Status:** Explored

## Product Brief

### Primary user
Support specialist or operations specialist handling inbound cases under time pressure.

### Problem
Current support tooling makes people reconstruct the case manually, jump between fragmented context, distrust black-box AI output, and still do the handoff work themselves.

### Core value
Async Copilot turns messy case input into a visible staged triage flow and delivers a usable response pack quickly enough for real operators and clearly enough to trust.

### Product promise
On first view, the product should communicate:
- this is support operations software
- the timeline is the hero
- the system shows its work
- the result is practical, not theatrical
- the design has a real point of view

### Positioning
Not:
- chatbot
- generic AI dashboard
- ask-anything assistant

Is:
- premium triage cockpit
- case understanding + handoff generator
- operator-first workflow tool

## MVP Scope

### In scope
- paste case or choose sample case
- start triage run
- watch visible staged timeline progress
- inspect evidence and reasoning per stage
- receive response pack
- copy or export outputs

### MVP stages
1. Ingest case
2. Normalize facts
3. Classify issue and urgency
4. Build triage assessment
5. Generate response pack

### Response pack contents
- case summary
- likely issue / hypothesis
- customer-facing reply draft
- internal note
- recommended next actions
- escalation recommendation / confidence

### Out of scope
- live chat UI
- autonomous ticket sending
- deep third-party integrations
- multi-user collaboration
- roles/permissions
- analytics dashboards
- admin systems
- training loops
- complex queue management

## Information Architecture

### Top-level
1. Landing
2. App
   - New Case
   - Runs
   - Samples

### Navigation
#### Landing nav
- Product
- How it Works
- Output
- Demo / Open App

#### App nav
- New Case
- Runs
- Samples

### Recommended app layout
- Left rail: case input / evidence / metadata
- Center: staged triage timeline
- Right rail: response pack / actions

## Screen Inventory

### 1. Landing page
Goal: communicate the product in 10 seconds.

### 2. New Case
Goal: start a run with minimal friction.

### 3. Live Triage Run
Goal: make the process feel active, visible, and inspectable.

### 4. Completed Run / Response Pack
Goal: convert analysis into action.

### 5. Runs List
Goal: revisit previous outputs.

### 6. Samples / Demo Cases
Goal: portfolio-proof the product quickly.

## State Matrix

| Surface | Idle | Loading | Success | Error | Empty |
|---|---|---|---|---|---|
| New Case | paste prompt visible | n/a | case accepted | invalid input / parse failed | no case entered |
| Timeline | waiting to start | stage-by-stage progress | all stages complete | stage failed / timeout | no run yet |
| Evidence Panel | placeholder guidance | evidence streaming in | evidence attached to each stage | missing source / parse issue | no evidence yet |
| Response Pack | locked placeholder | generating pack | pack fully usable | pack generation failed | no pack yet |
| Runs List | list shell | fetching runs | runs visible | failed to load history | no prior runs |
| Samples | cards visible | loading samples | samples ready | failed to load | no samples configured |

## Action Map

| Action | Where | Result |
|---|---|---|
| Start triage | New Case | creates run and opens live timeline |
| Use sample case | New Case / Samples | preloads known example into flow |
| Expand stage | Live Run | reveals evidence + reasoning details |
| Retry stage | Live Run | reruns current stage |
| Continue after pause | Live Run | resumes workflow |
| View evidence | Live Run | opens supporting details for trust |
| Copy summary | Response Pack | copies concise case summary |
| Copy reply draft | Response Pack | copies customer-ready draft |
| Copy internal note | Response Pack | copies internal handoff text |
| Copy next actions | Response Pack | copies operational checklist |
| Export pack | Response Pack | exports full artifact |
| Open run | Runs | opens prior completed/in-progress run |
| Start new case | Global nav | resets flow and opens intake |

## Build Slices

### Slice 1 — Product shell
- app frame
- landing page shell
- navigation
- visual language
- empty states

### Slice 2 — Case intake
- paste case
- sample cases
- start run
- basic case object

### Slice 3 — Timeline hero
- staged progress UI
- stage states
- active/inactive/completed/error visuals
- mock stage progression first

### Slice 4 — Evidence panel
- per-stage evidence cards
- fact extraction display
- confidence / supporting signals

### Slice 5 — Response pack
- summary
- reply draft
- internal note
- next actions
- copy/export actions

### Slice 6 — Full golden path
- connect intake -> timeline -> final pack
- one believable end-to-end scenario
- polish state transitions

### Slice 7 — Runs + samples
- recent runs
- reopen flow
- curated demo cases

### Slice 8 — Landing page narrative polish
- hero mock
- flow section
- response pack proof
- trust / transparency section
- CTA

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Generic AI assistant pane | Too close to chatbot framing; weakens product differentiation. |
| 2 | Broad analytics dashboard homepage | Duplicates weaker enterprise patterns and competes with the timeline hero. |
| 3 | Full automation / autopilot mode | Too expensive for MVP and undermines the operator-trust thesis. |
| 4 | Heavy collaboration and admin tooling | Valid later, but out of scope for the portfolio MVP. |
| 5 | Multi-queue operational suite | Too broad relative to the product promise; dilutes the triage core. |
| 6 | Feature-heavy landing page | Weaker than a workflow-first narrative and less memorable for reviewers. |
