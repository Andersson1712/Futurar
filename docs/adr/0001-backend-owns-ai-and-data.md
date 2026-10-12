# 0001 — Backend owns AI and data; the frontend is UI + Auth only

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-001/009/010)

## Context

An early version called Gemini directly from the browser with `VITE_GEMINI_*`
keys (incident-001). That exposed the API key, shipped prompts/models in the
bundle, and left validation, quotas and auditing outside our control.

## Decision

- All AI runs in the NestJS backend, which owns keys, prompts, models, quotas,
  validation, persistence and audit.
- The frontend never calls an AI provider and ships no AI SDK, key or prompt.
- The backend is the single owner of application data; the frontend uses Supabase
  **Auth only** for login/refresh.
- `scripts/check-supabase-imports.mjs` (`npm run check:supabase`) blocks new
  direct Supabase imports in the frontend, and CODEOWNERS flags AI-related paths.

## Consequences

- Positive: keys never reach the browser; AI output is validated server-side;
  cost/audit live in one place; the frontend is replaceable.
- Negative: every AI feature needs backend work; requires auth on each call.
