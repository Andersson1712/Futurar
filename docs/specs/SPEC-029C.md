# SPEC-029C — Comunicación vertical (boards)

- Status: **implemented** (approved 2026-10-08; branch `feat/spec-029c-communications`)
- Depends on: SPEC-029 (verticals framework), SPEC-029B (multi-image decks,
  wizard-whitelist lesson, distinct-title fixtures lesson), SPEC-002
  (AiModule/ports), SPEC-004/005 (prompts/validation), SPEC-006/007
  (jobs/SSE), SPEC-008 (persistence pattern), SPEC-023 (actions catalog),
  SPEC-027 (correlation/metrics), SPEC-033 (multi-model + cost)
- Follow-up: none — verticals complete (books, diseños, presentaciones,
  comunicación)

## Objective

Ship Comunicación as the third vertical on the SPEC-029 framework:
communication boards (feelings, help requests, custom) with 4/6/8 cells
(short label + pictogram image each) created through the same accessible
scan wizard, plus a board USE view (select a cell → speak its label aloud)
reusing existing speech. No export, no post-creation editing.

## Why

Books validated the pipeline, Diseños proved the vertical pattern,
Presentaciones proved multi-image decks. Boards reuse the framework without
touching other verticals — and unlike them, the artifact is interactive, so
the use view ships in v1 (a board you cannot speak with is pointless).

## Design

- New `backend/src/ai/prompts/communication/v1/`
  (`communication.prompt.ts`, `communication.schema.ts`, `index.ts`,
  `COMMUNICATION_PROMPT_VERSION = 'communication/v1'`): board brief (kind
  feelings|help|custom, topic ≤120 chars, style, cellCount 4|6|8,
  audience), es-AR output, same moderation whole-word lists.
- New `GenerateCommunicationRequestDto` (kind, topic, style, cellCount,
  audience, profileId) + `communication-generation.types`; new
  `CommunicationPromptBuilderService` mirroring the presentation builder
  (no shared-base refactor in this SPEC).
- New `CommunicationGenerationRunner` reusing ports (`TEXT_GENERATOR`,
  `IMAGE_GENERATOR`) + `communication-output.parser/validator` (strict
  schema incl. exact cell-count match and ≤40-char labels,
  `INVALID_OUTPUT` 502 / `CONTENT_BLOCKED` 422, same codes). Every cell
  image is REQUIRED (1:1 pictograms): any adapter or storage failure aborts
  before persisting, so there is never a partial board.
- Reuse untouched: jobs (`QUEUE_DRIVER=inline|bullmq`), `Idempotency-Key`,
  `JobStatusStream`/SSE (cells ride as pages in the book-shaped completion
  envelope, `totalPages = cellCount`), correlation id, metrics,
  `AI_ENDPOINTS_ENABLED` guard pattern via
  `COMMUNICATION_ENDPOINTS_ENABLED` (default false, same boot rule) plus
  `COMMUNICATION_IMAGES_ENABLED` (default false).
- New endpoints: `POST /api/v1/ai/communications/generate` (202, throttle
  5/min, idempotency required) + `GET /api/v1/communications` / `:id`
  (teacher-scoped, per-cell signed image URLs on read, soft delete).
  Jobs/SSE endpoints shared.
- Persistence: migration `0012_communications.sql` (`communications` +
  `communication_versions` with cells as validated JSONB in the version
  row, idempotent by `generation_job_id`, per-version audit) mirroring
  0011. Images in the existing private `book-images` bucket (new prefix
  `communications/`) behind `COMMUNICATION_IMAGES_ENABLED` (default
  false); never persist signed URLs.
- Frontend: new `services/backendCommunications.ts` (same JWT refresh/retry
  + SSE/polling shape), wizard entry (kind → topic → cell-count → style)
  reusing `optionPages`, scan grid, page indicator, pointerdown-wins, with
  the new steps in the wizard panel whitelist from day one (029B lesson).
  New `BOARD_USE` view: cell grid via `ScanningGrid` (≥44px targets),
  select speaks the label (`speakWithState`) + aria-live confirmation, back
  to library. Library merges boards read-only. New es-AR i18n keys via
  `t()`. `StoryConfig`/`ProgressConfig` unions widened to `'communication'`.
- Out: board editing, custom pictogram upload, per-cell voices, export
  (SPEC-031), new buckets, OTel spans.

## Acceptance criteria

- [x] `POST /ai/communications/generate` → 202 + job → inline driver →
  `GET /ai/jobs/:id` terminal → `GET /communications/:id` returns
  validated board (cells text + per-cell images) with mocked Gemini (no
  network), `COMMUNICATION_*_ENABLED=true` in test only.
- [x] Failure paths: invalid output → `INVALID_OUTPUT` (502); wrong cell
  count → `INVALID_OUTPUT` (502); blocked terms → `CONTENT_BLOCKED`
  (422); idempotent replay returns the same job; over-limit topic → 400
  (never truncates); unsupported cellCount → 400.
- [x] Book + design + presentation flows untouched: unit (356) and E2E
  (42) green.
- [x] A11y: full flow operable with one switch (scan), pointerdown wins,
  targets ≥44px, `Página X de Y` announced, board speaks on select, new
  i18n keys covered.
- [x] Backend `test`, `test:e2e`, `build`, `lint` green. Frontend:
  `typecheck` shows zero errors in touched files (25 pre-existing
  jest-dom-v7 matcher errors proven on clean `dev`); `vitest`/`vite`
  toolchain exits silently (exit 0, no output) on this machine for `dev`
  too — environmental, reported. `check:supabase` flags 4 pre-existing
  direct imports.
- [x] No new runtime dependency; owner applies 0012.

## Edge cases

- Any cell image fails → board fails with `AiError`, job `failed`, no
  partial persist (same rule as decks, extended per cell).
- Topic >120 chars → 400, not truncation (user decides, system never
  silently rewrites user text).
- `COMMUNICATION_ENDPOINTS_ENABLED=false` → 501 `NOT_IMPLEMENTED` (same
  guard shape); images flag off → 501 before any provider call.
- Supabase down → in-memory fallback for jobs; boards require the
  repository port (both adapters, like decks).
- SSE auth header-only: reuse polling fallback, no bare-EventSource headers.

## File impact

- New backend: `ai/prompts/communication/v1/*`,
  `ai/dto/generate-communication-request.dto.ts`,
  `ai/domain/communication-generation.types.ts`,
  `ai/application/communication-prompt-builder.service(.spec).ts`,
  `communication-output.parser(.spec).ts`/`validator(.spec).ts`,
  `communication-generation.service/use-case/runner.ts`,
  `communications/` module (controller/service/repositories), migration
  `0012_communications.sql`, E2E `test/ai-communication.e2e-spec.ts` (+
  `test-app.ts` fixtures/flags).
- Touched: `ai.module`/`ai.controller` wiring, `env.validation`
  (`COMMUNICATION_ENDPOINTS_ENABLED`, `COMMUNICATION_IMAGES_ENABLED`),
  OpenAPI tags.
- New frontend: `services/backendCommunications(.test).ts`,
  `components/StudentApp.tsx` wizard entry + `BOARD_USE` view,
  `StudentLibrary.tsx` merge, i18n keys, `types.ts`/`progressStore.ts`
  unions, `e2e/communication-entry.spec.ts` (3 tests with distinct
  title/topic fixtures; needs Playwright run where the toolchain works).
- Out: books/designs/presentations paths (read-only reuse).

## Contracts

- `POST /ai/communications/generate` → 202 `{ jobId, status }`;
  `Idempotency-Key` required; errors use the `AiError` envelope.
- `GET /communications?profileId=` list, `GET /communications/:id` get
  (teacher auth, per-cell signed image URLs on read only),
  `DELETE /communications/:id` soft delete.

## Verification

```bash
# backend (all green)
npm test # 67 suites / 356 tests
npm run test:e2e # 6 suites / 42 tests
npm run build # clean
npm run lint # clean
```

```bash
# frontend (environmental blocks, reported since 029B)
npm run typecheck # 25 pre-existing errors, 0 in touched files
npm run check:supabase # 4 pre-existing direct imports
npm test # BLOCKED: vitest exits 0 silently (dev too)
npm run build # BLOCKED: vite exits 0 silently, no dist (dev too)
npx playwright test e2e/communication-entry.spec.ts # PENDING: same toolchain
```

## Versions

Same pins as SPEC-029B (`backend/package.json`): Nest 12.x, TS `^6.0.3`,
Jest `^30.0.0` (`NODE_OPTIONS=--experimental-vm-modules`), supertest
`^7.0.0`, Node `>=20.19.0`. No new APIs, no Context7 lookup needed. No
new runtime dependency.
