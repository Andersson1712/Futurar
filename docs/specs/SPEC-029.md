# SPEC-029 — New verticals: framework + Diseños (flyers)

- Status: **proposed** (SPEC-026 on hold, SPEC-028 PR #37 open)
- Depends on: SPEC-002 (AiModule/ports), SPEC-004/005 (prompts/validation),
  SPEC-006/007 (jobs/SSE), SPEC-008 (book persistence pattern),
  SPEC-023 (actions catalog), SPEC-027 (correlation/metrics)
- Follow-ups: SPEC-029B Presentaciones, SPEC-029C Comunicación
  (tableros: cómo me siento, pedir ayuda)

## Objective

Prove the platform is not book-only: extract the reusable generation
pipeline behind a vertical abstraction and ship the first new vertical,
**Diseños (flyers)** — a single-image, short-text visual (event/announcement)
created through the same accessible scan wizard. Presentaciones and
Comunicación stay explicitly out; they follow the same pattern as 029B/029C.

## Why

Books validated the pipeline (prompt → validate → queue → SSE → persist),
but every seam is book-shaped (`POST /ai/books/generate`,
`prompts/book/v1`, `books/book_versions`). Cloning that per vertical would
triple prompt drift, moderation gaps, and wizard forks. One vertical done
right establishes the pattern the other two reuse.

## Design

- New `backend/src/ai/prompts/design/v1/` (`design.prompt.ts`,
  `design.schema.ts`, `index.ts`, `DESIGN_PROMPT_VERSION = 'design/v1'`):
  flyer brief (occasion, message ≤140 chars, style, audience), image-first.
  es-AR output, same moderation whole-word lists as books.
- New `GenerateDesignRequestDto` (occasion, message, style, audience,
  profileId) + `design-generation.types`; new `DesignPromptBuilderService`
  mirroring `PromptBuilderService` (no shared-base refactor in this SPEC).
- New `DesignGenerationRunner` reusing ports (`TEXT_GENERATOR`,
  `IMAGE_GENERATOR`) + `design-output.parser/validator` (strict schema,
  `INVALID_OUTPUT` 502 / `CONTENT_BLOCKED` 422, same codes).
- Reuse untouched: jobs (`QUEUE_DRIVER=inline|bullmq`), `Idempotency-Key`,
  `JobStatusStream`/SSE (already generic over `JobRecord`), correlation id,
  metrics, `AI_ENDPOINTS_ENABLED` guard pattern via
  `DESIGN_ENDPOINTS_ENABLED` (default false, same boot rule).
- New endpoints: `POST /api/v1/ai/designs/generate` (202, throttle 5/min,
  idempotency required) + `GET /api/v1/designs` / `:id` (teacher-scoped,
  signed image URL on read, soft delete). Jobs/SSE endpoints shared.
- Persistence: migration `0009_designs.sql` (`designs` + `design_versions`,
  idempotent by `generation_job_id`, per-version audit) mirroring 0002.
  Images in the existing private `book-images` bucket (new prefix `designs/`)
  behind `DESIGN_IMAGES_ENABLED` (default false); never persist signed URLs.
- Frontend: new `services/backendDesigns.ts` (same JWT refresh/retry +
  SSE/polling shape as `bookGeneration`), wizard reuses `optionPages`,
  scan grid, page indicator (`Página X de Y` + aria-live), pointerdown-wins.
  New es-AR i18n keys via `t()` (no hardcoded strings). Library shows
  diseños alongside books (read-only merge, same as legacy `stories` rule).
- Out: presentaciones, comunicación, PDF/EPUB export (SPEC-031), new
  buckets, OTel spans per vertical.

## Acceptance criteria

- [ ] `POST /ai/designs/generate` → 202 + job → inline driver →
  `GET /ai/jobs/:id` terminal → `GET /designs/:id` returns validated flyer
  (text + image) with mocked Gemini (no network), `DESIGN_ENDPOINTS_ENABLED=true`
  in test only.
- [ ] Failure paths: invalid output → `INVALID_OUTPUT` (502); blocked terms →
  `CONTENT_BLOCKED` (422); idempotent replay returns the same job.
- [ ] Book flow untouched: existing book E2E (SPEC-028, 10 tests) still green.
- [ ] A11y: full flow operable with one switch (scan), pointerdown wins,
  targets ≥44px, `Página X de Y` announced, axe clean on new screens.
- [ ] `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint`
  (backend) + `typecheck`, `check:supabase`, `npm test` (frontend) green.
- [ ] No new runtime dependency unless approved; owner applies 0009.

## Edge cases

- Image adapter failure → design fails with `AiError`, job `failed`, no
  partial persist (same as book image best-effort but required here: a
  flyer without image is not a flyer).
- Message >140 chars → 400, not truncation (user decides, system never
  silently rewrites user text).
- `DESIGN_ENDPOINTS_ENABLED=false` → 501 `NOT_IMPLEMENTED` (same guard
  shape as books).
- Supabase down → in-memory fallback for jobs; designs require the
  repository port (both adapters, like books).
- SSE auth header-only: reuse polling fallback, no bare-EventSource headers.

## File impact

- New backend: `ai/prompts/design/v1/*`, `ai/dto/generate-design-request.dto.ts`,
  `ai/domain/design-generation.types.ts`, `ai/application/design-prompt-builder.service.ts`,
  `design-output.parser/validator.ts`, `design-generation.service/use-case/runner.ts`,
  `designs/` module (controller/service/repositories), migration
  `0009_designs.sql`, E2E `test/ai-design.e2e-spec.ts` (+ `test-app.ts` extension).
- Touched: `ai.module`/`app.module` wiring, `env.validation`
  (`DESIGN_ENDPOINTS_ENABLED`, `DESIGN_IMAGES_ENABLED`), OpenAPI tags.
- New frontend: `services/backendDesigns.ts`, wizard entry + library merge,
  i18n keys, 1 E2E spec extension.
- Out: books code paths (read-only reuse), presentaciones, comunicación.

## Contracts

- `POST /ai/designs/generate` → 202 `{ jobId, status }`; `Idempotency-Key`
  required; errors use the `AiError` envelope.
- `GET /designs?profileId=` list, `GET /designs/:id` get (teacher auth),
  `DELETE /designs/:id` soft delete. Signed image URL on read only.

## Verification

```bash
npm test
npm run test:e2e
npm run build
npm run lint
```

```bash
npm run typecheck
npm run check:supabase
npm test
```

## Versions

Same pins as SPEC-028 (`backend/package.json`): Nest 12.x, TS `^6.0.3`,
Jest `^30.0.0` (`NODE_OPTIONS=--experimental-vm-modules`), supertest
`^7.0.0`, Node `>=20.19.0`. Validate new APIs via Context7 before
implementation if the runner has network access.
