# Security Policy

> Last reviewed: 2026-10-01

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue.

- Use GitHub's [private vulnerability reporting](https://github.com/Andersson1712/Futurar/security/advisories/new)
  ("Report a vulnerability"), or
- Contact the maintainer through their GitHub profile.

Include: affected component, steps to reproduce, impact, and any suggested fix.
We will acknowledge within a few days and keep you informed until it is resolved.

## Scope

Focus areas for this project:

- Leakage of AI provider keys or Supabase service credentials.
- Anything that lets the frontend call AI providers or Supabase data directly.
- Authentication/authorization flaws in the backend (per-teacher scoping).
- Injection or unvalidated AI output reaching persistence.
- Data exposure of students/profiles or their books.

## Secret handling rules

- **AI keys live only in the backend.** Never place an AI key in the frontend
  environment or code. A direct key in the browser was the subject of
  [`docs/security/incident-001.md`](docs/security/incident-001.md) (SPEC-001).
- Never commit `.env*` files or secrets. Use `backend/.env.example` /
  `.env.example` as templates with placeholder values only.
- Per-teacher credentials are encrypted with AES-256-GCM
  (`AI_SECRETS_MASTER_KEY`); the API returns metadata only, never the full key.
- The frontend stores no secrets and never calls Supabase for data; the backend
  is the only data owner.

## Supported versions

The project is pre-1.0 and only the latest `dev` (and the last phase close on
`main`) receives fixes.

## Disclosure

Please give us a reasonable window to fix the issue before any public
disclosure. We credit reporters in the advisory unless you prefer otherwise.
