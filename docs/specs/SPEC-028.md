# SPEC-028 — Backend integration and E2E hardening

- Status: **proposed** (SPEC-026 on hold per owner; next after SPEC-027)
- Depends on: SPEC-002 (AiModule), SPEC-004/005 (prompts/validation), SPEC-006/007 (jobs/SSE), SPEC-008 (persistence), SPEC-027 (observability)
- Follow-ups: Supabase testcontainer E2E, OpenTelemetry SDK, persistent metrics

## Objective

Close the real backend testing gap: unit coverage is strong (53 suites,
`prompt-builder`, `book-output.validator/parser`, Gemini adapters,
`generation-runner`, jobs, books, profiles, actions, observability all have
specs), but E2E is a single trivial test (`GET /api/v1` → `Hello World!`).
Add a mocked-provider integration path and a full-flow E2E so generation,
jobs, SSE, persistence, and observability are proven together. No contract
change; test-only plus minimal testability seams.

## Versions

| Component | Version (source: `backend/package.json`) |
|-----------|------------------------------------------|
| NestJS (`common/core/platform-express/config/swagger/testing`) | 12.x (`^12.1.2`, cli `^12.0.8`) |
| TypeScript | `^6.0.3`, Node `>=20.19.0` |
| Jest / ts-jest / @types/jest | `^30.0.0` (observed `30.5.2`), runner needs `NODE_OPTIONS=--experimental-vm-modules` |
| supertest / @types/supertest | `^7.0.0` / `^6.0.2` |
| Existing E2E config | `backend/test/jest-e2e.json`, entry `backend/test/app.e2e-spec.ts` |

Context7 validation was not run for this SPEC draft; versions above are
pinned from the repo. Validate `supertest` + `@nestjs/testing` APIs via
Context7 before implementation if the runner has network access.

## Acceptance criteria

- [ ] Integration: `POST /api/v1/ai/books/generate` → job → inline driver →
  `GET /api/v1/ai/jobs/:id` + `GET /api/v1/ai/jobs/:id/events` (SSE) →
  `GET /api/v1/books/:id` passes with Gemini adapters mocked at the
  provider boundary (no network), `AI_ENDPOINTS_ENABLED=true` in test only.
- [ ] Failure paths: invalid output → `INVALID_OUTPUT` (502); blocked content
  → `CONTENT_BLOCKED` (422); idempotent replay via `Idempotency-Key`
  returns the same job without duplicating work.
- [ ] Observability preserved: `x-correlation-id` honored and echoed through
  the full flow; `GET /api/v1/health` public; `GET /api/v1/metrics` stays
  behind teacher auth (401 without token).
- [ ] Suite stays green: `npm test` (unit), `npm run test:e2e`, `npm run
  build`, `npm run lint` clean on the feature branch.
- [ ] No production contract change: no new endpoints, no DTO change, no
  migration, no new runtime dependency unless approved.

## Edge cases

- SSE auth uses headers only (EventSource cannot send headers): test the
  polling fallback path, not a bare EventSource with custom headers.
- BullMQ/Redis must NOT be required: default the flow to
  `QUEUE_DRIVER=inline` in tests; a Redis-down run still passes.
- Supabase unavailability: repositories fall back to in-memory adapters;
  tests assert the fallback instead of hitting real Supabase.
- Timers/streams: SSE heartbeat (15s) and polling (1s) must be shortened or
  faked in tests; no test waits on real 15s timers.
- Secrets: mocked credentials only; never a real `GEMINI_API_KEY` or master
  key in tests or fixtures.

## File impact

- New: `backend/test/ai-generation.e2e-spec.ts` (full flow),
  `backend/test/test-app.ts` (bootstrap helper: test module, mocked Gemini
  provider, inline queue, correlation-aware assertions).
- Touched (test-only preferred): `backend/test/jest-e2e.json` (pattern/timeout),
  minimal testability seams in `src/` only if a seam is missing (documented in
  the SPEC approval diff).
- Out: `docs/specs/` contract docs unchanged; no migration; no frontend.

## Contracts

No HTTP contract change. Test asserts the existing contracts:
`POST /ai/books/generate` → 202 + job; `GET /ai/jobs/:id` status;
`GET /ai/jobs/:id/events` SSE with terminal close;
`GET /books/:id` persisted validated book; `AiError` envelope on failures;
`Idempotency-Key` replay semantics.

## Verification

```bash
npm test -- --listTests | wc -l
npm test
npm run test:e2e
npm run build
npm run lint
```
