# Security Policy

Async Copilot is a portfolio implementation, not a hosted support product or commercial service. Security issues are still treated seriously because the project demonstrates auth, database access, AI inference, and approval-gated integrations.

## Supported scope

Security review should focus on the current `main` branch and the live demo at:

- https://async-copilot.vercel.app

## How secrets are handled

The repository is designed to keep real credentials out of Git:

- local secrets belong in `.env.local`
- Vercel secrets belong in encrypted project environment variables
- `.env.example` contains placeholders only
- `.env.local`, `.env.*.local`, `.vercel/`, logs, build output, and generated audit artifacts are ignored

If you run this project locally, rotate any credentials you expose outside your machine.

## Reporting a vulnerability

If you find a vulnerability, please open a private GitHub security advisory if available, or contact the repository owner through the GitHub profile linked from the repository.

Please include:

- affected route or file
- reproduction steps
- expected impact
- whether credentials, user data, or outbound integrations are involved

## Non-goals

This repository does not claim production SLA, compliance certification, SOC 2 readiness, or enterprise security coverage. It demonstrates product engineering discipline for a scoped AI workflow system.
