# SPEC-028 — Backend integration and E2E hardening

## Objective
Prove the generation pipeline end-to-end with mocked Gemini: generate →
job → SSE → persisted book, plus failure paths, idempotency, and
observability. Test-only; no contract change.

## Why
53 unit suites are green but E2E is one trivial assertion. The pipeline
(generate, queue, SSE, persistence, correlation) has never been exercised
together. This is the cheapest high-value check before release work.

## Scope
- New `backend/test/ai-generation.e2e-spec.ts` + `backend/test/test-app.ts`
  helper (mocked provider boundary, `QUEUE_DRIVER=inline`, shortened timers).
- `backend/test/jest-e2e.json` pattern/timeout if needed.
- Minimal `src/` seams only if missing (documented, no contract change).
- Out: new endpoints, DTOs, migrations, runtime deps, frontend, Supabase
  testcontainers (follow-up).

## Tasks
- [x] 028-1 Validate `supertest` + `@nestjs/testing` APIs; confirm mock
  boundary (Gemini provider) and inline-queue test bootstrap. Done 2026-10-03:
  no Context7 tool in worker — validated against repo patterns instead
  (`src/ai/ai.controller.spec.ts`, `src/observability/http-observability.spec.ts`).
  Boundary: TEXT/IMAGE/TTS generator tokens mocked, QUEUE_DRIVER=inline,
  REDIS_CLIENT=null, SupabaseService→null + header-token auth double.
- [x] 028-2 Happy-path E2E: generate → job → SSE → book (RED, then GREEN).
  Done 2026-10-03: RED (`Cannot find module './test-app'`, then SSE hang) →
  GREEN for generate (202) → poll job (completed) → persisted book + SSE
  terminal-close passing after the stream fix (see gap, now fixed).
- [x] 028-3 Failure paths: INVALID_OUTPUT (502), CONTENT_BLOCKED (422),
  Idempotency-Key replay without duplication. Done 2026-10-03, incl.
  409 on key-reuse-with-different-payload + 400/404/401 triangulation.
- [x] 028-4 Observability assertions: correlation echo, public health,
  metrics 401 without token, Redis-down still passes. Done 2026-10-03
  (health asserts `redis: disabled` + `queueDriver: inline`; metrics 200 with
  token, 401 without; whole suite runs with REDIS_CLIENT=null).
- [x] 028-5 Full verification: `npm test`, `test:e2e`, `build`, `lint` green +
  `docs/specs/SPEC-028.md` + MEMORY.md (<=50 lines) — done 2026-10-03 by parent:
  unit `279 passed` (second run; first run flaked 2 in profiles, green on retry),
  e2e `10 passed`, build clean, lint clean.
- [ ] 028-6 Push + PR to `dev` (needs user approval — publishing) — parent-owned.

## Route
Direct-inline proposed (test-only, bounded scope). Delegation per ODD
triggers if the writer threshold fires at implementation time.

## Verification evidence (worker run, 2026-10-03, branch `feat/spec-028-backend-e2e`)
- `npm run test:e2e` (backend/): 2 suites passed, 9 passed + 1 skipped (blocked SSE), ~3s
- `npm test -- --listTests 2>&1 | wc -l` (backend/): 58
- `npm run build` (backend/): clean
- `npm run lint` (backend/): clean (after typing fixes in the two new test files)
- Full `npm test` unit run: not run by worker — parent-owned (028-5); no `src/`
  changes were made, so unit scope is untouched by construction.

## SSE src gap (returned to parent — no `src/` edits authorized)
- File: `backend/src/ai/application/job-status.stream.ts`
  (`createJobStatusStream`) + `backend/src/jobs/in-memory-job.repository.ts`.
- Reason: `open()` passes the repository's LIVE record as `initial`, and the
  in-memory `find` returns the mutable stored object. Transitions mutate
  `initial` too, so `distinctUntilChanged` (`status:updatedAt` fingerprint)
  always matches and swallows poll results; `takeWhile(..., inclusive)` never
  sees terminal. Verified: stream emits only the subscribe-time snapshot +
  heartbeats, never closes (supertest hangs); already-terminal subscribe ends
  the HTTP stream immediately with zero bytes. Unit specs miss it (fresh
  objects per state). Suggested seam (parent-owned): snapshot/clone `initial`
  (and/or poll results) before fingerprinting. Placeholder `it.skip` lives in
  `backend/test/ai-generation.e2e-spec.ts` (`028-2 closes the SSE stream…`).

## Commits (feat/spec-028-backend-e2e)
- 6ccdaaf test(e2e): mocked-provider bootstrap with inline queue
- b7a05bd test(e2e): generate-poll-book, failures, idempotency, observability
- ebdcda8 fix(sse): snapshot emissions + replay stop signal (terminal close)

## SSE fix (worker run, 2026-10-04, branch `feat/spec-028-backend-e2e`)
Two compounding defects kept the SSE stream from closing; both fixed in
`backend/src/ai/application/job-status.stream.ts` (no DTO/endpoint/timer
contract change; `InMemoryJobRepository` semantics untouched):
1. Aliasing: `open()` passes the repo's live record as `initial` and polls
   return the same mutated object, so `distinctUntilChanged` compared two
   aliases and swallowed every transition. Fix: `snapshotJob()` freezes each
   emission (own `updatedAt`/`createdAt` instances) before fingerprinting.
2. Stop-signal race: with an already-terminal `initial` (inline queue
   completes before subscribe), `statusEvents$` completes synchronously
   during `merge` subscription, before `heartbeats$` subscribes to `stop$`;
   a plain `Subject` drops the signal and the 15s heartbeat keeps the HTTP
   stream open forever. Fix: `stop$` is now `ReplaySubject<void>(1)`.
- RED→GREEN: aliasing regression test failed with `['queued']` only (8th
  test), sync-terminal test timed out at 5s; after fix unit 9/9. Re-enabled
  E2E `028-2 closes the SSE stream…` hung 30s pre-fix; post-fix full
  `npm run test:e2e` is 2 suites / 10 passed in ~2s.
- Verification: `npx jest src/ai/application/job-status.stream.spec.ts`
  (NODE_OPTIONS=--experimental-vm-modules) 9 passed; `npm run test:e2e`
  10 passed; `npm run build` clean; `npm run lint` clean.

## Next
PR #37 open to `dev` (https://github.com/Andersson1712/Futurar/pull/37) — CI red on backend E2E (fix below, pushed for re-run).

## CI incident: kill-switch 503 without local `.env` (fixed)
- CI ran 9 failed / 1 passed: every `POST /ai/books/generate` → 503
  `AI_ENDPOINTS_DISABLED`, while local runs were 10/10 green.
- Root cause: `ConfigModule.forRoot()` executes at module-import time, before
  the E2E `beforeAll` sets `process.env`. Locally the `backend/.env` file
  masked it (validated store held boolean `true`); in CI (no `.env` file) the
  store held `undefined` and `ConfigService.get` fell back to the raw
  `'true'` string at request time, which the strict `!== true` guard rejected.
- Fix: tolerant flag read in `AiEndpointsEnabledGuard` (`true`/`'true'`/`'1'`),
  same pattern as 029's `isDesignFlagEnabled`. Guard spec extended (6 tests).
  Proven by running the E2E suite with `backend/.env` temporarily moved away
  (CI condition): 2 suites / 10 passed; `.env` restored byte-identical.
