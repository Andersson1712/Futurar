# SPEC-009 — Frontend generation via backend only

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D5 as recommended)
- Phase: 3 / EPIC 3.1
- Depends on: SPEC-006/007/008 (jobs, SSE, books)
- Blocks: SPEC-010 (session/data cleanup), SPEC-017/018 (frontend tests)

## Implementation notes
- New frontend services: `backendApi.ts` (Bearer + AiError/NetworkError),
  `bookGeneration.ts` (POST with UUID idempotency key, SSE via fetch streaming,
  2 s polling fallback, abortable), `backendBooks.ts`, `bookMappers.ts`,
  `bookTypes.ts`.
- `StudentApp` generation is real again: reads `futurar_story_config`
  (`utils/storySettings.ts`), sends `profileId = currentStudent.id`, follows
  the job, maps the persisted book to the reader shape and shows es-AR errors
  per `AiError.code` with a retry button (`utils/messages.ts`).
- Library merges backend books (`GET /books?profileId=`) with legacy Supabase
  `stories` (read-only) and fetches the book detail when a backend book is
  opened. `StoryDetails`/`StoryReader` skip the legacy Supabase insert when the
  book is already persisted (`persisted` prop), so no duplicate rows.
- Backend additions: optional `profileId` (uuid) in `GenerateBookRequestDto`,
  `story_config` jsonb in `book_versions` (migration `0002_books.sql`),
  `GET /books?profileId=` with `ListBooksQueryDto`, and story config exposed in
  `BookDetailDto`.
- New scripts: `typecheck` (`tsc --noEmit`, two pre-existing errors fixed) and
  `check:supabase` (see SPEC-010).

## Objective
Replace the disabled generation stub in the frontend with the real backend
pipeline: request a job, follow it through SSE (fetch streaming, header auth)
with polling fallback, render the persisted book and stop writing new stories
to Supabase from the generation flow. `@google/generative-ai` and
`VITE_GEMINI_*` were already removed in SPEC-001 (confirmed clean).

## Decisions to confirm
- **D1 Library strategy (recommended)**: backend `books` become the source for
  new stories (`GET /books?profileId=`), while legacy Supabase `stories` remain
  **read-only** in the library until SPEC-010/021 migrates them. Alternative:
  full switch (old stories disappear) or generation-only (library untouched).
- **D2 Result shape (recommended)**: map the backend book to the existing
  `Story` shape for the current reader (`content` = pages joined, `image_url` =
  first page signed URL). A paginated reader is a future spec.
- **D3 Profile scope (recommended)**: add optional `profileId` to the
  generation request and `GET /books?profileId=` so a student's library stays
  scoped (books already store `profile_id`). No profiles module needed yet.
- **D4 Dedications/favorites (recommended)**: for backend books, dedication
  comes from the generation request (read-only in the UI); post-generation
  dedication/favorites CRUD stays on legacy stories until SPEC-022.
- **D5 API base**: `VITE_API_URL` (default `http://localhost:3001`), documented
  in the frontend `.env.example`.

## Contracts
```ts
// services/backendApi.ts
getAccessToken(): Promise<string | undefined>;          // Supabase session
apiFetch<T>(path, init?): Promise<T>;                   // Bearer + AiError parse

// services/bookGeneration.ts
requestBookGeneration(input): Promise<{ jobId, status }>;   // POST + UUID key
streamJob(jobId, { signal, onStatus, onError }): Promise<void>; // SSE
pollJob(jobId, { signal, onStatus }): Promise<void>;        // fallback
```
- Request built from the wizard config (`protagonist`, `scenery`, `mission`,
  `style`), `futurar_story_config` (`storySize`, `customStructure`),
  `profileId = currentStudent.id` and `audience = 'child'`.
- SSE uses `fetch` (Bearer header, no URL tokens); on non-2xx or missing
  streaming support it falls back to 2 s polling. Abort on unmount/cancel.
- Error copy by `AiError.code` lives in `utils/messages.ts` (es-AR), replacing
  the temporary `aiUnavailable` stub.
- Backend additions: `profileId?` in `GenerateBookRequestDto` (uuid),
  persisted through the job/book, and `GET /books?profileId=` filter.

## File impact
- Frontend new: `services/backendApi.ts`, `services/bookGeneration.ts`,
  `services/bookMappers.ts` (+ nothing else uses Supabase for new writes).
- Frontend update: `components/StudentApp.tsx` (real generation + progress via
  `onStatus`), `components/StudentLibrary.tsx` (merge backend books + legacy
  stories), `utils/messages.ts` (error map), `.env.example` (`VITE_API_URL`),
  `package.json` (`typecheck` script).
- Backend update: `src/ai/dto/generate-book-request.dto.ts`,
  `src/books/books.controller.ts`/`books.service.ts` (list filter) + tests.

## Acceptance criteria
1. Generating from the wizard reaches `completed` with a persisted book
   (mocked backend in tests is not available yet; verified by build + smoke).
2. Progress text/percentage follows SSE events and the fallback poller works
   when the stream cannot be opened.
3. Errors from the backend map to es-AR messages per `AiError.code`; the
   disabled stub copy is removed.
4. The generated book appears in the student's library (backend list filtered
   by `profileId`) alongside legacy stories without new Supabase writes.
5. `npm run build` and the new `npm run typecheck` pass; grep shows no new
   direct Supabase data writes in the generation flow.
6. Backend: `profileId` validated (uuid, optional), persisted and used for
   filtering; build/test/lint green.

## Edge cases
SSE disconnects mid-stream; job `failed`; token expired mid-stream (401 →
refresh + retry once, else fall back to polling); component unmount aborts the
request; backend unreachable (clear network message); legacy story without
`content`; books without images.

## Out of scope
Paginated reader, dedication/favorite CRUD for backend books (SPEC-022),
migrating legacy `stories` (SPEC-010/021), frontend test runner (SPEC-017),
teacher panel/options data (SPEC-021/023).

## Verification
Frontend `npm run build` + `npm run typecheck`; backend
`npm run build && npm test && npm run lint`; manual smoke with
`AI_ENDPOINTS_ENABLED=true` + inline driver.
