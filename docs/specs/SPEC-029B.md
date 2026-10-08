# SPEC-029B — Presentaciones vertical

- Status: **implemented** (approved 2026-10-07; branch `feat/spec-029b-presentations`)
- Depends on: SPEC-029 (verticals framework + Diseños pattern), SPEC-002
  (AiModule/ports), SPEC-004/005 (prompts/validation), SPEC-006/007
  (jobs/SSE), SPEC-008 (persistence pattern), SPEC-023 (actions catalog),
  SPEC-027 (correlation/metrics), SPEC-033 (multi-model + cost)
- Follow-up: SPEC-029C Comunicación

## Objective

Ship Presentaciones as the second vertical on the SPEC-029 framework: a
teacher-configured, student-navigable slide deck (title + 5/8/10 slides with
short text + one image per slide) created through the same accessible scan
wizard. No export.

## Why

Books validated the pipeline, Diseños proved the vertical pattern. Cloning
that per vertical without the framework would multiply prompt drift,
moderation gaps, and wizard forks. Presentaciones reuses the framework
without touching books or designs code paths.

## Design

- New `backend/src/ai/prompts/presentation/v1/` (`presentation.prompt.ts`,
  `presentation.schema.ts`, `index.ts`,
  `PRESENTATION_PROMPT_VERSION = 'presentation/v1'`): deck brief (topic
  ≤120 chars, style, slideCount 5|8|10, audience), es-AR output, same
  moderation whole-word lists as books/designs.
- New `GeneratePresentationRequestDto` (topic, style, slideCount,
  audience, profileId) + `presentation-generation.types`; new
  `PresentationPromptBuilderService` mirroring `DesignPromptBuilderService`
  (no shared-base refactor in this SPEC).
- New `PresentationGenerationRunner` reusing ports (`TEXT_GENERATOR`,
  `IMAGE_GENERATOR`) + `presentation-output.parser/validator` (strict
  schema incl. exact slide-count match, `INVALID_OUTPUT` 502 /
  `CONTENT_BLOCKED` 422, same codes). Every slide image is REQUIRED: any
  adapter or storage failure aborts before persisting, so there is never a
  partial deck. Images are 16:9 (`PRESENTATION_IMAGE_ASPECT_RATIO`).
- Reuse untouched: jobs (`QUEUE_DRIVER=inline|bullmq`), `Idempotency-Key`,
  `JobStatusStream`/SSE (generic `JobRecord` + book-shaped completion
  envelope with `totalPages = slideCount`), correlation id, metrics,
  `AI_ENDPOINTS_ENABLED` guard pattern via
  `PRESENTATION_ENDPOINTS_ENABLED` (default false, same boot rule) plus
  `PRESENTATION_IMAGES_ENABLED` (default false).
- New endpoints: `POST /api/v1/ai/presentations/generate` (202, throttle
  5/min, idempotency required) + `GET /api/v1/presentations` / `:id`
  (teacher-scoped, per-slide signed image URLs on read, soft delete).
  Jobs/SSE endpoints shared.
- Persistence: migration `0011_presentations.sql` (`presentations` +
  `presentation_versions` with slides as validated JSONB in the version
  row, idempotent by `generation_job_id`, per-version audit) mirroring
  0009. Images in the existing private `book-images` bucket (new prefix
  `presentations/`) behind `PRESENTATION_IMAGES_ENABLED` (default false);
  never persist signed URLs.
- Frontend: new `services/backendPresentations.ts` (same JWT refresh/retry +
  SSE/polling shape), wizard entry (topic → slide-count → style) reusing
  `optionPages`, scan grid, page indicator (`Página X de Y` + aria-live),
  pointerdown-wins. New es-AR i18n keys via `t()` (no hardcoded strings).
  Library shows presentaciones alongside books/designs (read-only merge).
  `StoryConfig`/`ProgressConfig` type unions widened to `'presentation'`.
- Out: comunicación (029C), PDF/PPTX export (SPEC-031), new buckets, OTel
  spans per vertical.

## Acceptance criteria

- [x] `POST /ai/presentations/generate` → 202 + job → inline driver →
  `GET /ai/jobs/:id` terminal → `GET /presentations/:id` returns validated
  deck (slides text + per-slide images) with mocked Gemini (no network),
  `PRESENTATION_*_ENABLED=true` in test only.
- [x] Failure paths: invalid output → `INVALID_OUTPUT` (502); wrong slide
  count → `INVALID_OUTPUT` (502); blocked terms → `CONTENT_BLOCKED`
  (422); idempotent replay returns the same job; over-limit topic → 400
  (never truncates); unsupported slideCount → 400.
- [x] Book + design flows untouched: existing unit (341) and E2E (32) green.
- [x] A11y: full flow operable with one switch (scan), pointerdown wins,
  targets ≥44px, `Página X de Y` announced, new i18n keys covered.
- [x] Backend `test`, `test:e2e`, `build`, `lint` green. Frontend:
  `typecheck` shows zero errors in touched files (25 pre-existing
  jest-dom-v7 matcher errors proven on clean `dev`); `vitest`/`vite`
  toolchain exits silently (exit 0, no output) on this machine for `dev`
  too — environmental, reported. `check:supabase` flags 4 pre-existing
  direct imports (incl. `StudentLibrary`, already present for legacy
  stories).
- [x] No new runtime dependency; owner applies 0011.

## Edge cases

- Any slide image fails → deck fails with `AiError`, job `failed`, no
  partial persist (same rule as flyers, extended per slide).
- Topic >120 chars → 400, not truncation (user decides, system never
  silently rewrites user text).
- `PRESENTATION_ENDPOINTS_ENABLED=false` → 501 `NOT_IMPLEMENTED` (same
  guard shape as designs); images flag off → 501 before any provider call.
- Supabase down → in-memory fallback for jobs; presentations require the
  repository port (both adapters, like designs).
- SSE auth header-only: reuse polling fallback, no bare-EventSource headers.

## File impact

- New backend: `ai/prompts/presentation/v1/*`,
  `ai/dto/generate-presentation-request.dto.ts`,
  `ai/domain/presentation-generation.types.ts`,
  `ai/application/presentation-prompt-builder.service(.spec).ts`,
  `presentation-output.parser(.spec).ts`/`validator(.spec).ts`,
  `presentation-generation.service/use-case/runner.ts`, `presentations/`
  module (controller/service/repositories), migration
  `0011_presentations.sql`, E2E `test/ai-presentation.e2e-spec.ts` (+
  `test-app.ts` fixtures/flags).
- Touched: `ai.module`/`ai.controller` wiring, `env.validation`
  (`PRESENTATION_ENDPOINTS_ENABLED`, `PRESENTATION_IMAGES_ENABLED`),
  OpenAPI tags, `ai-endpoints-enabled.guard.spec.ts` (lint autofix only).
- New frontend: `services/backendPresentations(.test).ts`,
  `components/StudentApp.tsx` wizard entry, `StudentLibrary.tsx` merge,
  i18n keys, `types.ts`/`progressStore.ts` unions,
  `e2e/presentation-entry.spec.ts` (3 tests, needs Playwright run where
  the toolchain works).
- Out: books/designs code paths (read-only reuse).

## Contracts

- `POST /ai/presentations/generate` → 202 `{ jobId, status }`;
  `Idempotency-Key` required; errors use the `AiError` envelope.
- `GET /presentations?profileId=` list, `GET /presentations/:id` get
  (teacher auth, per-slide signed image URLs on read only),
  `DELETE /presentations/:id` soft delete.

## Verification

```bash
# backend (all green 2026-10-07)
npm test # 64 suites / 341 tests
npm run test:e2e # 5 suites / 32 tests
npm run build # clean
npm run lint # clean (one autofix in guard spec)
```

```bash
# frontend (environmental blocks, reported)
npm run typecheck # 25 pre-existing errors, 0 in touched files (proven on clean dev)
npm run check:supabase # 4 pre-existing direct imports
npm test # BLOCKED: vitest exits 0 silently (dev too)
npm run build # BLOCKED: vite exits 0 silently, no dist (dev too)
npx playwright test e2e/presentation-entry.spec.ts # PENDING: same toolchain
```

## Versions

Same pins as SPEC-029 (`backend/package.json`): Nest 12.x, TS `^6.0.3`,
Jest `^30.0.0` (`NODE_OPTIONS=--experimental-vm-modules`), supertest
`^7.0.0`, Node `>=20.19.0`. No new APIs, no Context7 lookup needed. No
new runtime dependency.
