# Async Copilot — Variant.com Design Brief

Use the following prompts directly in Variant.com. Keep the product framed as premium support operations software, not a chatbot and not a generic AI dashboard. The workflow is always: support case in -> visible staged triage -> usable response pack out. The center timeline is the hero.

---

## 1) Landing Page

**Variant prompt:**

Design a landing page for **Async Copilot**, a premium support triage product. This is not a chatbot and not a generic AI dashboard. The page should communicate in under 10 seconds: messy support case in, visible staged triage in the middle, ready-to-use response pack out.

1. **Screen name and purpose**
   - Landing Page — communicate the product thesis instantly and drive the user into the app demo.

2. **Layout structure**
   - Header with compact nav and primary CTA
   - Hero section with workflow-first headline and product mockup
   - How it Works section with 3-step flow
   - Trust / transparency section
   - Output / response-pack proof section
   - Closing CTA band
   - Minimal footer

3. **Key components**
   - Logo / wordmark: “Async Copilot”
   - Nav items: “Product”, “How it Works”, “Output”, “Open App”
   - Hero headline hint: “From support case to ready reply”
   - Hero subcopy hint: “Visible staged triage for support teams under pressure”
   - Primary CTA button: “Open App”
   - Secondary CTA button: “View Demo Case”
   - Product hero image hint: left case context, center timeline, right response pack
   - 3-step workflow cards: “Case In”, “Visible Triage”, “Response Pack Out”
   - Trust section items: inspectable evidence, low-confidence warnings, escalation guidance
   - Output proof block: summary, reply draft, internal note, next actions
   - Footer hint: minimal links, no marketing clutter

4. **Visual mood keywords**
   - premium, structured, quiet, high-signal, credible

5. **States to show**
   - Default hero / success marketing state
   - Optional lightweight hover/interaction states for CTA and workflow cards
   - No noisy loading states needed

6. **Reference style hints**
   - editorial command-center, premium B2B, restrained product-marketing, minimal SaaS without feature-grid cliché

Important design guidance:
- Avoid generic AI gradients, chatbot bubbles, avatars, and dashboard-card spam.
- Make the landing page feel like workflow software for specialists, not AI hype.
- The page should mirror the product flow and visually preview the signature left-center-right lockup.

---

## 2) New Case (Intake)

**Variant prompt:**

Design the **New Case** screen for Async Copilot. This screen starts a run with minimal friction. The operator is a support specialist under time pressure. The page should feel calm, fast, and operational.

1. **Screen name and purpose**
   - New Case — let the operator paste a support case or load a sample and immediately start triage.

2. **Layout structure**
   - Top app header with compact nav
   - Main content in a centered operational workspace
   - Primary intake panel on the left/main area
   - Secondary sample-case panel or rail on the right
   - Minimal footer or no footer inside app shell

3. **Key components**
   - App nav: “New Case”, “Runs”, “Samples”
   - Page title: “Start New Triage Run”
   - Support case textarea with realistic placeholder text
   - Metadata chips or small inputs: customer, channel, urgency, account status
   - Primary CTA button: “Start Triage”
   - Secondary button: “Use Sample Case”
   - Sample case cards, including a highlighted payments dispute case
   - Validation hint text for empty or malformed case input
   - Small note that the output will be a staged triage run and response pack

4. **Visual mood keywords**
   - focused, efficient, operational, polished, restrained

5. **States to show**
   - Empty state with inviting textarea and sample options
   - Input-filled ready state
   - Validation error state for bad / empty input
   - Loading state after clicking “Start Triage”

6. **Reference style hints**
   - operator workspace, enterprise editorial, structured console, minimal form-heavy app

Important design guidance:
- Do not make this look like a chat input.
- It should feel like structured case intake, not prompt entry.
- Samples should reinforce portfolio polish without overwhelming the page.

---

## 3) Live Triage Run

**Variant prompt:**

Design the **Live Triage Run** screen for Async Copilot. This is the signature screen and the most important design surface. It must use a memorable **left-center-right lockup**: case facts and source snippets on the left, visible staged triage timeline in the center, response pack building on the right. The center timeline is the hero.

1. **Screen name and purpose**
   - Live Triage Run — make the triage process feel active, visible, inspectable, and trustworthy.

2. **Layout structure**
   - Slim top app header with run status and nav
   - Three-column main layout
   - Left rail: case facts, source snippets, customer metadata
   - Center column: large staged timeline with active step emphasis
   - Right rail: response pack preview and operator actions
   - Optional sticky lower action bar or compact status footer

3. **Key components**
   - Run title hint: “Payments dispute — duplicate charge / delayed refund”
   - Status chip: “In Progress”
   - Left rail blocks: case summary, timeline of customer events, extracted facts, evidence snippets
   - Center staged timeline with 5 stages: “Ingest Case”, “Normalize Facts”, “Classify Issue & Urgency”, “Build Triage Assessment”, “Generate Response Pack”
   - Active stage card with progress pulse or subtle motion
   - Expandable stage detail drawer with evidence and reasoning notes
   - Low-confidence warning module when evidence conflicts
   - Right rail response pack sections progressively filling in
   - Action buttons: “Inspect Evidence”, “Retry Stage”, “Pause”, “Approve when ready”
   - Confidence / escalation block in response pack preview

4. **Visual mood keywords**
   - command-center, inspectable, premium, deliberate, high-trust

5. **States to show**
   - Active loading/progression state
   - Stage expanded state with evidence visible
   - Low-confidence warning state with escalation recommendation
   - Recoverable error state for failed stage or missing source

6. **Reference style hints**
   - command-center, air-traffic-control restraint, investigative editor, premium operational console

Important design guidance:
- This must not resemble chat, assistant conversation, or a generic analytics dashboard.
- The timeline should dominate the composition and visually connect to both evidence and output.
- The most memorable quality should be trust made visible at a glance.

---

## 4) Completed Run / Response Pack

**Variant prompt:**

Design the **Completed Run / Response Pack** screen for Async Copilot. The goal is to convert analysis into action. It should feel like the same signature screen, but now resolved into a stable, usable handoff artifact.

1. **Screen name and purpose**
   - Completed Run / Response Pack — deliver the final triage outcome as a practical operator-ready artifact.

2. **Layout structure**
   - Top app header with completed status
   - Left rail retained for case facts and run summary
   - Center column with completed stage timeline and visible history
   - Right rail expanded into a full response-pack panel
   - Compact action band for approval / copy / export

3. **Key components**
   - Status chip: “Completed” or “Ready for Approval”
   - Finalized stage timeline with all steps resolved
   - Right-side response pack sections:
     - case summary
     - likely issue / hypothesis
     - customer-facing reply draft
     - internal note
     - recommended next actions
     - escalation recommendation + confidence
   - Action buttons: “Approve Pack”, “Copy Summary”, “Copy Reply”, “Copy Internal Note”, “Export Pack”
   - Confidence badge and low-confidence notice if applicable
   - Small audit note hint: “Generated from staged triage run”

4. **Visual mood keywords**
   - resolved, practical, structured, trustworthy, polished

5. **States to show**
   - Success / completed state
   - Approval-pending state
   - Low-confidence completed state
   - Export error or action feedback state

6. **Reference style hints**
   - structured report workspace, premium document console, editorial artifact view, operational handoff surface

Important design guidance:
- Do not collapse this into a plain document page.
- Keep visible continuity with the live triage run so the operator sees process and output as one system.
- The response pack should feel immediately usable, not decorative.

---

## 5) Runs List

**Variant prompt:**

Design the **Runs List** screen for Async Copilot. This is a lightweight secondary surface for revisiting prior outputs. It should support credibility but remain visually subordinate to the main triage flow.

1. **Screen name and purpose**
   - Runs List — let the operator reopen previous triage runs and response packs.

2. **Layout structure**
   - Top app header with nav
   - Main content area with page title and compact filter/search row
   - Runs table or stacked list as the primary body
   - Minimal right-side summary panel optional, but keep subordinate

3. **Key components**
   - Page title: “Recent Runs”
   - Search field: “Search runs”
   - Filter chips: “In Progress”, “Completed”, “Low Confidence”, “Sample”
   - Runs list rows/cards with columns or metadata:
     - case title
     - issue type
     - urgency
     - confidence
     - status
     - last updated
   - Row action: “Open Run”
   - Empty state CTA: “Start New Case”

4. **Visual mood keywords**
   - quiet, structured, utility-first, credible, subordinate

5. **States to show**
   - Loading list state
   - Populated success state
   - Empty state with CTA back to intake
   - Error state for failed history load

6. **Reference style hints**
   - minimal operations table, structured case log, restrained enterprise list view

Important design guidance:
- This must not feel like a dashboard homepage.
- Keep the visual hierarchy clearly below the hero run screen.
- Prioritize clarity and quick reopening over density for its own sake.

---

## 6) Samples / Demo Cases

**Variant prompt:**

Design the **Samples / Demo Cases** screen for Async Copilot. This page helps the product demo quickly and should feel curated, intentional, and portfolio-ready rather than like a noisy template gallery.

1. **Screen name and purpose**
   - Samples / Demo Cases — offer curated cases that quickly prove the product’s workflow and trust model.

2. **Layout structure**
   - Top app header with nav
   - Intro section with short explanation of sample purpose
   - Main grid or stacked set of curated sample cards
   - Optional featured hero sample at top
   - Minimal footer / no footer in app shell

3. **Key components**
   - Page title: “Sample Cases”
   - Intro copy hint: “Explore realistic support cases and watch the triage flow”
   - Featured sample card: payments dispute / duplicate charge / delayed refund
   - Secondary sample cards with concise labels and scenario summaries
   - Metadata per card: urgency, issue type, confidence challenge, expected output
   - CTA button on each card: “Run Sample”
   - Optional tag styles: “Best Demo”, “Low Confidence Scenario”, “Escalation Path”

4. **Visual mood keywords**
   - curated, credible, polished, purposeful, demo-ready

5. **States to show**
   - Populated sample library state
   - Loading state
   - Empty / no samples configured state
   - Error state for failed sample load

6. **Reference style hints**
   - curated editorial gallery, premium case library, restrained scenario browser, product-demo catalog

Important design guidance:
- The cards should feel like operational case files, not marketing tiles.
- Make the featured payments dispute case obviously the golden-path demo.
- Keep the page clean and curated so it strengthens the product thesis rather than broadening it.

---

## Global Variant Direction

Use these constraints across all six screens:
- No chat bubbles
- No assistant avatars
- No generic AI dashboard cards
- No purple-gradient AI cliché
- No feature-grid SaaS feel unless heavily customized to the workflow
- Emphasize visible process, evidence, trust, and practical output
- Make the typography, spacing, and panel structure feel premium and deliberate
- Prioritize one coherent product world across landing and app surfaces
- The product should feel believable to support/ops specialists and memorable to hiring managers
