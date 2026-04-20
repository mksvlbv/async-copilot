# AI Architecture & Development Log

## Overview
This document outlines the AI orchestration methodology, prompt engineering strategies, and agentic workflows used to build and power **Async Copilot**.

## Development Methodology: Agentic Scaffolding
Async Copilot was developed using a modern "AI-First" engineering approach, primarily orchestrated via **Claude 3.5 Sonnet** and **Llama 3.3 (Groq)**.
Instead of relying on AI for naive autocomplete, I utilized a "Domain-Driven Scaffolding" methodology:
1. **Schema First:** The PostgreSQL/Supabase schema was strictly defined and passed to the LLM to establish rigid data boundaries.
2. **Type Definitions:** TypeScript interfaces were generated and manually validated to ensure type safety across the stack.
3. **Feature-Sliced Generation:** UI components and Server Actions were generated feature-by-feature (e.g., the `runs` domain), strictly collocated and then extracted into a scalable architecture.

## Core System Prompts

The system relies on structured LLM inference to parse messy support cases into deterministic JSON objects.

### 1. The Intake & Normalization Prompt
Used to extract intent and facts from unstructured customer emails:

```text
You are an expert technical support engineer. Your task is to analyze the following customer message and extract the core intent, urgency, and technical facts.

Rules:
1. You must respond in pure JSON. No markdown formatting or explanations.
2. Match the urgency to one of: 'low', 'medium', 'high', 'critical'.
3. Extract any mentioned IDs, error codes, or URLs into a 'facts' array.

Input Case:
Title: {case_title}
Body: {case_body}
```

### 2. The Resolution Strategy Prompt
Used to query internal documentation and formulate a response pack:

```text
Based on the extracted facts and intent, formulate a resolution strategy.
If you are less than 90% confident in the solution based on the provided context, you MUST flag 'requires_escalation': true.
Generate a polite, professional draft reply for the customer.
```

## Challenges & Architectural Solutions

### Challenge 1: LLM Hallucinations in State Transitions
**Problem:** Initially, the LLM was tasked with deciding the next state of the triage workflow, which led to unpredictable state jumps and hallucinations.
**Solution:** I stripped the LLM of routing authority. I implemented a **Server-Owned State Machine** in `src/app/api/runs/[runId]/advance/route.ts`. The LLM is now only responsible for data transformation within a specific stage, while the Node.js server strictly enforces the sequence (`ingest` -> `normalize` -> `query` -> `policy`).

### Challenge 2: JSON Parsing Failures
**Problem:** Models occasionally wrap JSON outputs in markdown blocks (e.g. ```json ... ```), breaking standard `JSON.parse()`.
**Solution:** Implemented a robust parsing wrapper with regex stripping and fallback mechanisms. If parsing completely fails, the system safely falls back to a synthetic (regex-based) deterministic output, ensuring the workflow never completely crashes in production.

## Testing & Quality Assurance
AI generation is probabilistic, but enterprise software must be deterministic. To bridge this gap, I implemented comprehensive E2E tests using **Playwright** (`tests/e2e`) to validate the critical path:
- Approving a generated response pack.
- Ensuring human-in-the-loop gates function correctly.
- Verifying that escalation paths correctly trigger webhooks.
