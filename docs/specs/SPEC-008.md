# SPEC-008 — Book persistence, image storage, audit, soft delete and versioning

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D6 as recommended)
- Phase: 2 / EPIC 2.3
- Depends on: SPEC-005 (validated book), SPEC-006 (jobs + Supabase)
- Blocks: SPEC-009/010 (frontend consumes backend data)

## Implementation notes
- `books` + `book_versions` (migration `0002_books.sql`) with title/page_count
  denormalized on the book row for cheap listing; versions keep the full
  snapshot plus per-version audit.
- `save` is idempotent by `generation_job_id` (lookup + unique constraint), so
  BullMQ retries cannot duplicate books.
- Image objects live at `users/{userId}/jobs/{jobId}/page-{n}.png` (job id
  instead of book id because uploads happen before the book row exists);
  upsert makes retries safe. Image generation is best-effort and reflected in
  `image_count`.
- Signed URLs are minted on the generation response and on `GET /books/:id`;
  `GET /books` returns summaries only (no signing). Storage failures surface
  as 503.
- `/api/v1/books` does not depend on `AI_ENDPOINTS_ENABLED` (reads still work
  when generation is disabled) but requires Supabase auth.
- Owner manual actions remain: apply `0002_books.sql`, create the private
  `book-images` bucket, and opt into `BOOK_IMAGES_ENABLED` when wanted.

## Objective
Persist every validated book server-side (backend remains the only data owner),
store page images in private Supabase Storage with expiring signed URLs, record
an audit trail (who/when/model/prompt version/tokens/images) and support soft
delete plus immutable versions. The current frontend `stories` table is left
untouched; SPEC-010 decides migration/backfill.

## Decisions to confirm
- **D1 Canonical schema (recommended)**: new `books` + `book_versions` tables
  owned by the backend. Alternative: extend the frontend `stories` table
  (couples backend to legacy frontend schema).
- **D2 Images (recommended)**: `BOOK_IMAGES_ENABLED` (default `false`) generates
  one image per page through `ImageGeneratorPort`, best-effort (a failed image
  never fails the job; `image_count` records successes), stored in the private
  `book-images` bucket; DB stores object paths, NEVER URLs. Reads mint signed
  URLs (TTL via `BOOK_IMAGE_SIGNED_URL_TTL_SECONDS`, default 3600).
  Alternative: text-only for now (no Storage).
- **D3 API (recommended)**: add `/api/v1/books` — `GET /books` (owned, not
  deleted), `GET /books/:id` (fresh signed URLs), `DELETE /books/:id` (soft
  delete). Alternative: persist internally only.
- **D4 Versioning (recommended)**: `books` holds the current pointer and
  `book_versions` keeps immutable snapshots (title, pages, dedication, audit,
  `version` unique per book). Alternative: a single row with a version column.
- **D5 Audit (recommended)**: per-version columns: `prompt_version`, `model`,
  `input_tokens`, `output_tokens`, `image_count`, `generation_job_id`,
  `created_by`. Monetary cost stays out (SPEC-027 metrics/pricing).
- **D6 Legacy data (recommended)**: existing `stories` rows are not migrated
  here; SPEC-010 handles migration/backfill.

## Contracts
```ts
interface BookRepository {
  save(input: SaveBookInput): Promise<StoredBook>;   // idempotent by jobId
  findById(bookId, userId): Promise<StoredBook | undefined>;
  listByUser(userId): Promise<StoredBook[]>;
  softDelete(bookId, userId): Promise<boolean>;
}

interface BookStorage {
  upload(path: string, data: Buffer, mimeType: string): Promise<void>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}
```
- `save` is idempotent by `generation_job_id`: worker retries must not create
  duplicate versions (unique constraint + lookup).
- `StoredBook` = book row + current version + image paths; API responses replace
  paths with signed URLs and add `id`/`version` to `GeneratedBookDto`
  (`pages[].imageUrl` optional).
- Storage paths: `users/{userId}/books/{bookId}/page-{n}.png`.
- Images use `ImageGeneratorPort` with the page `imagePrompt`, `aspectRatio`
  1:1 and `imageSize` 1K; generation runs only for successful text pages.
- Endpoints keep the same auth chain (throttler → AI flag → Supabase JWT) and
  the `AiError` envelope; 404 for missing/foreign/deleted books.

## File impact (backend)
- New: `src/books/{book.repository.ts, supabase-book.repository.ts,
  in-memory-book.repository.ts, book-storage.port.ts, supabase-book.storage.ts,
  noop-book.storage.ts, books.service.ts, books.controller.ts, dto/*}` + specs,
  `src/ai/application/book-persistence.service.ts` (persist + images + audit),
  `supabase/migrations/0002_books.sql` (books, book_versions, indexes, RLS on).
- Update: `src/ai/application/generation-runner.ts` (persist before completing),
  `src/ai/ai.module.ts` / `src/app.module.ts` wiring, `src/jobs/job.repository.ts`
  (`bookId` on the job), `GeneratedBookDto` (id/version/imageUrl),
  `JobStatusDto` (bookId), `src/config/env.validation.ts`, `.env.example`.
- Tests mock Supabase/Storage: no external services required.

## Acceptance criteria
1. A completed generation persists `books` + one `book_versions` row with
   audit fields; retries by the same `generation_job_id` do not duplicate.
2. `GET /books` returns owned, non-deleted books; `GET /books/:id` returns fresh
   signed URLs (never stored); `DELETE /books/:id` sets `deleted_at` and hides
   it from reads while keeping versions.
3. With images disabled, no Storage calls happen and `image_count` is 0; with
   images enabled, a page image failure is logged and does not fail the job.
4. Unknown/foreign/deleted book ids → 404 `NOT_FOUND`; unauthenticated → 401;
   AI disabled → 503.
5. Signed URL TTL comes from env and is applied to every page image.
6. `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint` green with
   no Supabase/Storage running.

## Edge cases
Job retry after successful save; storage upload failure; signed URL for a
deleted book; version limits (keep all versions for now); missing `imagePrompt`
on a page; `BOOK_IMAGES_ENABLED=true` without Storage configured (fail fast at
read/save with a clear error); very long books (pagination of `GET /books` is
out of scope, cap 100).

## Out of scope
Migrating existing `stories` data and the frontend (SPEC-010), favorites,
PDF/EPUB export (SPEC-031), monetary cost/pricing (SPEC-027), image moderation
beyond audience rules already in SPEC-005, bucket lifecycle policies.

## Owner manual actions
- Apply `0002_books.sql` in Supabase.
- Create the private Storage bucket `book-images`.
- Set `BOOK_IMAGES_ENABLED=true` (and the bucket/TTL envs) when images are
  wanted; keep it `false` while the provider key rotation is pending.

## Verification
`cd backend && npm run build && npm test && npm run test:e2e && npm run lint`;
with Supabase configured: generate (inline driver), then `GET /api/v1/books`
and `GET /api/v1/books/:id` check signed URLs and versions.
