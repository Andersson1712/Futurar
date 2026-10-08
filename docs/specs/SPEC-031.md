# SPEC-031 — Server-side export, first slice: EPUB books

- Status: **implemented** (approved 2026-10-08; branch `feat/spec-031-export`)
- Depends on: SPEC-008 (books persistence + images), SPEC-006/007
  (jobs/SSE), SPEC-027 (correlation/metrics), SPEC-033 (cost)
- Follow-ups: flyer PDF, deck PPTX, board PDF, retention janitor,
  publish/sell (owner-side)

## Objective

Async server-side book export through the existing jobs/SSE pipeline.
First slice: EPUB 3 of books (text + images). The client-side book PDF
(jsPDF) stays untouched.

## Why

New verticals keep images in the private bucket: browsers would need
bucket CORS for canvas export (silent-breakage risk). The server fetches
with the service key. Jobs/SSE/idempotency/metrics already exist, output
is unit/E2E testable, and heavy libs stay out of student devices.

## Design

- New `EpubBuilderService` (pure builder, no I/O): EPUB 3 package
  (mimetype first + uncompressed, container, OPF, nav, one XHTML per
  page, images), es-AR metadata, dedication page when present, XML
  escaping throughout. Deterministic output (fixed timestamps).
- New `ExportGenerationService`/`ExportGenerationRunner`/
  `ExportBullMqJobQueue` wired in `ai.module.ts` exactly like the
  verticals (`EXPORT_GENERATION_USE_CASE`, `EXPORT_JOB_QUEUE`,
  `export-generation` queue, same retry/backoff).
- New `ExportsController` (`src/exports/`): `POST
  /api/v1/exports/books/:id` (202, throttle 5/min, idempotency, teacher
  guard) + `GET /api/v1/exports/:jobId/download` (short-lived signed
  URL, 1h TTL). Formats enum with `epub` only; anything else → 501.
- Artifact path is deterministic
  (`exports/users/{userId}/jobs/{jobId}/book.epub`) so no new table and
  no changes to the jobs module: the download endpoint re-derives the
  path from the completed job. Jobs complete with the standard
  book-shaped envelope.
- Book images are optional enrichments (SPEC-008): a missing image is
  skipped per page with a warning log, never sinks the export.
- `BookStorage.download()` added to the port (+ Supabase/disabled
  adapters + E2E fake); artifacts reuse the existing private
  `book-images` bucket under `exports/` behind `EXPORTS_ENABLED`
  (default false, same boot rule: Supabase URL + service key).
- Closed `AiErrorCode` envelope extended with `JOB_NOT_READY` (409 from
  the download endpoint for incomplete jobs).
- Frontend: `services/backendExports.ts` (+ MSW test), EPUB button in
  `StoryDetails` next to PDF (books only, `bookId` prop), request →
  poll → anchor download, full i18n via `t()`, aria-live status. Playwright
  E2E asserts the download event + `.epub` filename and the localized
  failure path.
- New dependency: `jszip@^3.10.2` (+ `@types/jszip` dev), API validated
  via Context7. No other new dep.
- Out: other formats, client PDF removal, publish/sell, new buckets,
  retention janitor.

## Acceptance criteria

- [x] Export request → 202 + job → terminal → download URL serves a
  valid EPUB (unzip + OPF/nav/pages/images asserted in unit tests;
  plumbing in E2E with mocked adapters, flags true in test only).
- [x] Unknown book → 404; bad format → 400; flag off → 501; unknown
  job download → 404.
- [x] Other verticals untouched: unit (359) and E2E (48) green.
- [x] A11y: EPUB button ≥44px, localized voice + status, aria-live.
- [x] Backend `test`, `test:e2e`, `build`, `lint` green. Frontend:
  `typecheck` 0 errors in touched files (25 pre-existing proven on
  clean `dev`); `vitest`/`vite` environmentally silent (dev too);
  Playwright E2E runs in CI.
- [x] No new runtime dep beyond approved `jszip`; owner enables flags.

## Edge cases

- Book deleted between request and run → 404, job failed, no artifact.
- Page image missing in storage → page kept without image + warning log.
- Replayed Idempotency-Key → same job, no duplicate EPUB.
- `EXPORTS_ENABLED=false` → 501 before touching the book.
- Supabase down → in-memory jobs; storage calls fail loudly (503).

## File impact

- New backend: `ai/application/epub-builder.service(.spec).ts`,
  `export-generation.service/use-case/runner.ts`,
  `ai/dto/request-export.dto.ts`, `ai/domain/export-generation.types.ts`,
  `exports/exports.controller.ts`, E2E `test/ai-export.e2e-spec.ts`.
- Touched: `ai.module` wiring, `env.validation` (`EXPORTS_ENABLED`),
  `common/ai/ai-error-code.ts` (`JOB_NOT_READY`), `books/book-storage.*`
  (`download`), `test/test-app.ts` (fake + flag), `package.json` (+lock).
- New frontend: `services/backendExports(.test).ts`,
  `components/StoryDetails.tsx` EPUB button, `StudentApp.tsx` bookId
  wiring, i18n keys, `e2e/book-export.spec.ts`.
- Out: client PDF, other formats/verticals.

## Contracts

- `POST /exports/books/:id` → 202 `{ jobId, status }`;
  `Idempotency-Key` required; errors use the `AiError` envelope.
- `GET /exports/:jobId/download` → 200 `{ downloadUrl }` (1h signed
  URL); 404 unknown job; 409 job not completed.

## Verification

```bash
# backend (all green)
npm test # 68 suites / 359 tests
npm run test:e2e # 7 suites / 48 tests
npm run build # clean
npm run lint # clean (fixed 3 self-inflicted: unused import + never-template x2)
```

```bash
# frontend (environmental blocks, reported since 029B)
npm run typecheck # 25 pre-existing errors, 0 in touched files
npm run check:supabase # pre-existing only (AuthContext after 032)
npm test # BLOCKED: vitest exits 0 silently (dev too)
npx playwright test e2e/book-export.spec.ts # runs in CI
```

## Versions

`jszip@^3.10.2` (+ `@types/jszip`), API validated via Context7
(`/stuk/jszip`: `generateAsync({type:'nodebuffer'})`, `file`, `folder`).
Same pins otherwise: Nest 12.x, TS `^6.0.3`, Jest `^30.0.0`, Node
`>=20.19.0`.
