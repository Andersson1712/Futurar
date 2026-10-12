# SPEC-031 — Server-side export, first slice: EPUB books

## Objective
Async server-side export through the existing jobs/SSE pipeline. First
slice: EPUB 3 of books (text + cover/first image). Flyer PDF, deck PPTX
and board PDF stay as numbered follow-ups. Client-side book PDF (jsPDF)
stays untouched.

## Why
New verticals keep images in the private bucket: browsers would need
bucket CORS for canvas export (silent-breakage risk). The server fetches
with the service key. Jobs/SSE/idempotency/metrics already exist, and the
output is unit/E2E testable. Heavy libs stay out of student devices.

## Scope
- New `exports/` module: `POST /api/v1/books/:id/export` (202, throttle,
  teacher-scoped) → export job → shared SSE/polling → `GET
  /api/v1/exports/:id/download` (short-lived signed URL). Formats enum
  with `epub` only in v1 (other values → 501).
- EPUB 3 builder: container + OPF + nav + one XHTML per page + images,
  es-AR metadata, dedication page when present. Artifacts in the existing
  private `book-images` bucket under `exports/` behind `EXPORTS_ENABLED`
  (default false) + `EXPORTS_IMAGES_ENABLED`; retention documented
  (signed URLs only, cleanup follow-up).
- BLOCKED ON: ZIP library decision (jszip proposed — needs owner
  approval; no new dep without it).
- Out: flyer/deck/board formats, client PDF removal, publish/sell
  (owner-side), new buckets, retention janitor (follow-up).

## Tasks
- [x] 031-0 ZIP dependency decision (owner approval). Done: jszip approved, API validated via Context7, installed ^3.10.2 + @types/jszip dev.
- [x] 031-1 Export module skeleton. Done: folded into wiring (ai.module pattern like verticals, no new module file needed); download endpoint with deterministic artifact path (no jobs-module changes).
- [x] 031-2 EPUB builder. Done: 3/3 unit green (valid package incl. images, XML escaping, dedication handling).
- [x] 031-3 Runner + E2E. Done: 6/6 E2E green first run; full be 359u/48e2e green; build+lint clean (fixed 3 self-inflicted lint errors). Added BookStorage.download to port + adapters + E2E fake; JOB_NOT_READY code to closed envelope.
- [x] 031-4 Frontend: service + StoryDetails EPUB button + i18n + tests. Done: backendExports + MSW test, bookId wiring, aria-live status, Playwright download spec. Typecheck 0 errors in touched files.
- [x] 031-5 Full verification + docs/specs/SPEC-031.md + MEMORY.md + plan.md. Done.
- [ ] 031-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline in bounded batches (delegation unavailable, disclosed since
029B). Test-first where a runnable RED exists. One work-unit commit per task.

## Acceptance (from approved spec)
- POST export → 202 + job → terminal → download URL returns a valid EPUB
  (unzip + OPF/nav/pages present, mocked adapters, flags true in test only)
- Unsupported format → 501; unknown book → 404; flag off → 501
- Books/designs/presentations/boards flows untouched and green
- All backend checks green; frontend typecheck 0 new errors

## Commits (feat/spec-031-export, merged #50)
- b1270e5 feat(export): EPUB builder, generation service and runner (3/3 unit)
- cc9583f feat(export): wiring, storage download, endpoints, flags and E2E (6/6 E2E)
- d94339e feat(export): frontend service, details EPUB button, i18n and E2E
- 344f8b2 docs(export) + 51e4c2e/67beb63/9a07ddb fix(e2e)

## Commits (feat/spec-031-flyer-pdf)
- c04a76d feat(export): flyer PDF builder with unit tests (2/2)
- 1a44201 feat(export): flyer PDF service, runner, endpoint and E2E (4/4)
- 36ab266 feat(export): design PDF button fork, service, i18n and E2E
- 344f8b2 docs(export): SPEC-031 spec, task evidence, memory and plan sync
- 51e4c2e / 67beb63 / 9a07ddb fix(e2e): book-export spec corrections (CI green)

## 031B — Flyer PDF (diseños) — branch feat/spec-031-flyer-pdf

- Scope: server PDF for designs only (other format×vertical combos → 501).
  Same pipeline: `POST /exports/designs/:id` → job → download.
  `pdfkit` (+ `@types/pdfkit` dev), API validated via Context7.
- Frontend: existing "Descargar PDF" button uses server export for
  designs (new `designId` prop), stays client-side jsPDF for books.
- Tasks:
- [x] 031B-1 pdfkit install + PDF builder + unit tests. Done: 2/2 green (real 1x1 PNG fixture — pdfkit rejects fake bytes, correctly).
- [x] 031B-2 Service/runner branch (design load, strict image) + controller endpoint + E2E. Done: 4/4 E2E green; artifact path per format (book.epub kept, flyer.pdf new); download derives format from job.
- [x] 031B-3 Frontend fork + E2E download spec. Done: designId prop, server flow for designs, client jsPDF untouched for books; caught missing frontend ExportFormat widening via typecheck.
- [x] 031B-4 Verification + docs + MEMORY + commits + PR. Done: full be 361u/52e2e green, lint clean, typecheck 0 new errors.
