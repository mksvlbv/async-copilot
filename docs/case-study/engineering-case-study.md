# Async Copilot Engineering Case Study

Async Copilot is a portfolio case study for an AI Product Engineer role: a scoped workflow product that combines full-stack delivery, LLM integration, human approval boundaries, and reviewer-facing trust evidence.

## Problem

Support and operations teams often receive messy, urgent customer cases. A generic chatbot is not enough: operators need a visible workflow, confidence signals, escalation boundaries, and a portable handoff artifact.

## Product shape

The product turns a support case into a structured response pack through a visible 6-stage triage workflow:

1. ingest case
2. classify urgency and intent
3. inspect policy/context
4. draft response strategy
5. prepare staged actions
6. produce an exportable response pack

The interface is designed around operator trust rather than autonomous execution.

## What is real

- Workspace/auth foundation with Supabase Auth and tenant-aware access checks
- Server-owned run lifecycle with persisted stages and event history
- Groq/Llama inference when `GROQ_API_KEY` is configured
- Deterministic synthetic fallback when AI is unavailable
- Narrow Gmail manual import path
- Approval-gated Slack dispatch boundary with dry-run support
- Durable action-attempt and approval-history records
- Markdown/text/JSON exports with compact trust evidence
- Unit tests and E2E coverage for critical trust boundaries

## Trust boundary

The system does not pretend to be an autonomous support agent. Slack is the only real outbound integration boundary, and it is gated by human approval. Other staged actions remain queued as recommendations.

## Engineering choices

- **Next.js App Router:** one codebase for marketing, app surfaces, and API routes.
- **Supabase/Postgres:** durable run state, workspace data, approval history, and audit events.
- **Server-owned state machine:** the client can request progress, but the server owns transitions.
- **Graceful AI fallback:** the demo remains usable without a model key.
- **Evidence-first exports:** reviewer handoffs include provenance, timing/fallback summaries, approval history, action attempts, and golden assertions.

## Why this matters for hiring

This project is meant to demonstrate the ability to ship AI-powered workflow software end to end: product framing, UX, backend state, integrations, trust boundaries, tests, CI, docs, and a live demo.

It is intentionally scoped. The value is not breadth of integrations; the value is a coherent workflow with honest boundaries and evidence that can be reviewed quickly.
