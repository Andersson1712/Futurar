# Futurar

**Accessible, AI-assisted creation of digital products for people with severe
motor disabilities.** Books are the first vertical; designs and presentations
follow. Single-switch scanning is the core of the product, not an optional
feature.

[English](README.md) · [Español](README.es.md)

> Last reviewed: 2026-10-01 · Source of truth: [`AGENTS.md`](AGENTS.md) ·
> [`plan.md`](plan.md) · [`MEMORY.md`](MEMORY.md)

## Why

Futurar lets a person create, save, read and dedicate their own stories using a
single switch (scanning) or direct input. Everything is designed to work with
one actuator, meet **WCAG 2.2 AA**, and follow **ISO/IEC 17549-3** guidance for
single-switch operation.

## The rules that shape the code

- **AI never runs in the frontend.** No AI SDK, no key, no prompt in the browser.
  All AI goes through the NestJS backend, which owns keys, prompts, models,
  quotas, validation, persistence and audit.
- **The backend owns the data.** The frontend uses Supabase **Auth only**
  (login/refresh) and calls the backend for everything else.
- **Accessibility is non-negotiable.** A direct click always beats scan focus
  (`pointerdown`); input is never taken on release; targets are >= 44x44 px;
  scroll is never blocked.
- **UI is es-AR; code, comments, identifiers and commits are English**
  (Conventional Commits).

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 (dev server on `:3000`) |
| Backend | NestJS 12 + TypeScript 6 (API on `:3001`, Node >= 20.19) |
| Data / Auth | Supabase (Postgres + Auth); backend is the only data owner |
| AI | Gemini, reached **only** through the backend |
| Tests | Vitest + Testing Library + MSW + Playwright (frontend); Jest (backend) |

## Repository layout

```
.                 Frontend: components/ contexts/ hooks/ services/ utils/ types.ts
backend/          Nest API: src/ai (providers), src/{actions,profiles,books,admin,jobs}
backend/supabase/ SQL migrations (apply in order, 0001 -> 0008)
docs/             specs/ (SDD), accessibility/, security/, adr/, guides/, architecture/
scripts/          Repo tooling (Supabase import guard, GitHub governance)
e2e/              Playwright end-to-end specs and helpers
```

## Getting started

**Prerequisites:** Node.js >= 20.19.

```bash
# 1. Frontend (repo root)
npm install
cp .env.example .env            # frontend variables (Auth only)
npm run dev                     # http://localhost:3000

# 2. Backend
cd backend
npm install
cp .env.example .env            # backend variables (AI keys live here)
npm run start:dev               # http://localhost:3001
```

Apply the SQL migrations in `backend/supabase/migrations/` (in order) to your
Supabase project. AI endpoints stay off until `AI_ENDPOINTS_ENABLED=true` and the
required backend variables are set.

## Environment and secrets

- **Frontend** (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_URL`. Auth only — **never** put an AI key here.
- **Backend** (`backend/.env`): `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
  `GEMINI_API_KEY`, `AI_ENDPOINTS_ENABLED`, `QUEUE_DRIVER`, `LOG_LEVEL`, and the optional
  credential/queue/book variables. See `backend/.env.example` for the full,
  documented list.
- Never commit `.env*` or any secret. See [`SECURITY.md`](SECURITY.md).

## Observability

- Structured JSON logs with an end-to-end correlation id (`x-correlation-id`
  honored, UUID fallback, echoed on every response, redacted credentials).
- `GET /api/v1/health` is public (liveness, degraded instead of crash);
  `GET /api/v1/metrics` needs teacher auth (in-memory counters, reset on restart).
- `GET /api/v1/profiles/active` is public (student kiosk entry, no teacher notes).
- Suggested alert thresholds: [`docs/ops/alerts.md`](docs/ops/alerts.md).

## Commands

Frontend (repo root):

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Unit/component tests (Vitest) |
| `npm run test:coverage` | Tests with coverage floor |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run check:supabase` | Blocks new direct Supabase imports |

Backend (`backend/`):

| Command | Purpose |
|---|---|
| `npm run start:dev` | Nest dev server with watch |
| `npm run build` | Compile the API |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Jest e2e tests |

## Accessibility

Futurar targets **WCAG 2.2 AA**, **ISO/IEC 17549-3** (single-switch) and
**EN 301 549** where applicable. See the
[accessibility declaration](docs/accessibility/declaration.es.md) (Spanish) and
the [build/verify guide](docs/accessibility/guide.es.md). The technical audit is
in [`docs/accessibility/audit-wcag-2.2.md`](docs/accessibility/audit-wcag-2.2.md).

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [ADRs](docs/adr/README.md)
- [i18n guide](docs/i18n.md)
- [User guides (Spanish)](docs/guides/): [teacher](docs/guides/docente.es.md) ·
  [student](docs/guides/estudiante.es.md)
- [Specs (SDD)](docs/specs/) and the [execution plan](plan.md)

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) before
opening a PR. This project follows spec-driven development: no code without an
approved spec.

## Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

TBD (see SPEC-026). Until a license is added, all rights are reserved.
