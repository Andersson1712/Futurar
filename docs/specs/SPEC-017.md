# SPEC-017 — Frontend test infrastructure (coverage, MSW and E2E)

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 5 / EPIC 5.1
- Depends on: SPEC-011 (Vitest + RTL), SPEC-012 (Playwright), SPEC-016 (axe)
- Blocks: SPEC-018 (critical tests), SPEC-019 (CI)

## Implementation notes
- MSW **2.15** was chosen because MSW 3 requires TypeScript ≥5.9 while the
  frontend stays on 5.8 (revisit with the Vite/TS chore). Handlers live in
  `test/msw/handlers.ts` (generate, jobs, SSE stream, books) and
  `test/msw/server.ts` exports the node server used per test file.
- New API integration tests: `services/backendApi.test.ts` (Bearer, AiError,
  401 refresh + retry, NetworkError, 204), `services/bookGeneration.test.ts`
  (idempotency key + body, SSE parsing, polling fallback, abort, in-stream
  error) and `services/backendBooks.test.ts` (profileId filter, detail).
- Found and fixed a real abort bug: an already-aborted signal did not reject
  `followJob`/`delay`, so polling could run to completion after cancel.
- Coverage: `@vitest/coverage-v8` with `test:coverage`, lcov + text reporters
  and a non-decreasing floor locked below the measured baseline
  (statements 35, branches 34, functions 32, lines 36; measured 36.74/36.1/
  33.78/38.11). `coverage/` is gitignored.
- Frontend suite: **66 tests / 13 files**; E2E stays as in SPEC-012.

## Objective
Complete the frontend test infrastructure: API-level tests with MSW, a
coverage script with a non-decreasing floor, and a documented script set. Most
of EPIC 5.1 already landed early: Vitest 5 + RTL 16 + user-event + jsdom
(SPEC-011), axe-core (SPEC-016) and Playwright 1.63 (SPEC-012).

## Current state
- `npm test` / `test:watch` (Vitest, 54 tests), `test:e2e` (Playwright,
  desktop + Pixel 7), `typecheck`, `check:supabase`.
- `@testing-library/user-event` installed but tests use `fireEvent`.
- No `test:coverage`; no MSW; API services are tested only through module
  mocks.

## Decisions to confirm
- **D1 MSW scope (recommended)**: add `msw` and mock the Nest HTTP API
  (`/api/v1/ai/books/generate`, `/ai/jobs/:id`, `/ai/jobs/:id/events` SSE,
  `/books`, `/books/:id`) to integration-test `services/backendApi.ts`,
  `services/bookGeneration.ts` (streaming + polling fallback + error mapping)
  and `services/backendBooks.ts`. Supabase keeps being module-mocked (only Auth
  is really used from the browser).
- **D2 Coverage (recommended)**: add `@vitest/coverage-v8` with
  `test:coverage` and thresholds locked to the measured baseline so coverage
  cannot drop (SPEC-019 will enforce it in CI).
- **D3 E2E scope (recommended)**: keep the current Playwright suite; the
  wizard→generation→reader flow with route interception belongs to SPEC-018
  (critical tests) to keep this spec focused on infrastructure.
- **D4 Scripts (recommended)**: final set = `test`, `test:watch`,
  `test:coverage`, `test:e2e`, `typecheck`, `check:supabase`, `build`.

## Contract
```ts
// test/msw/handlers.ts
export const handlers = [
  http.post('/api/v1/ai/books/generate', ...),   // 202 { jobId, status }
  http.get('/api/v1/ai/jobs/:id', ...),          // JobStatusDto
  http.get('/api/v1/ai/jobs/:id/events', ...),   // SSE stream (ReadableStream)
  http.get('/api/v1/books', ...),                // summaries filtered by profileId
  http.get('/api/v1/books/:id', ...),
  http.delete('/api/v1/books/:id', ...),
];
```
- `test/msw/server.ts` exports `setupServer` used per test file
  (`beforeAll/afterEach/afterAll`).
- `vitest.config.ts`: coverage provider v8, reporter text/lcov, thresholds
  from the measured baseline.

## File impact
- New: `test/msw/{handlers.ts,server.ts}`, `services/backendApi.test.ts`,
  `services/bookGeneration.test.ts`, `services/backendBooks.test.ts`.
- Update: `package.json` (scripts + msw/@vitest/coverage-v8 dev deps),
  `vitest.config.ts` (coverage), `.gitignore` (coverage/), docs.
- No app code changes expected.

## Acceptance criteria
1. API client tests (MSW) cover: Bearer header, `AiError` parsing, 401 refresh
   + retry, SSE event parsing, polling fallback when the stream fails, abort,
   and `profileId` query handling.
2. `npm run test:coverage` emits text + lcov and fails when coverage drops
   below the locked thresholds.
3. `npm test`, `test:e2e`, `typecheck`, `build`, `check:supabase` keep passing;
   no app behavior changes.
4. Scripts documented in `AGENTS.md`/spec.

## Edge cases
MSW + Node fetch vs jsdom fetch; SSE mock without a real network; aborted
requests during tests; coverage noise from generated `dist/` excluded; MSW
server left running between files.

## Out of scope
Critical-flow tests and CI wiring (SPEC-018/019), visual regression, browser
matrix beyond Chromium, load tests.

## Verification
`npm run test` · `npm run test:coverage` · `npm run test:e2e` ·
`npm run typecheck` · `npm run build` · `npm run check:supabase`.
