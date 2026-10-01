# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP: accessible story creation for severe motor disabilities, single-switch
  (scanning) or direct input.
- Frontend AI REMOVED (SPEC-001); backend generation works end-to-end but stays gated until the Gemini key is rotated.
- SPEC-002→008 done: server-owned Nest 12 AI module, /api/v1 contracts,
  versioned prompts/validation, BullMQ/Redis jobs, SSE, book persistence with
  audit/soft delete and optional page images. Frontend React 19.3.
- Wizard, library, reader, TTS, dedications, teacher panel work; gaps:
  frontend reads Supabase `stories` directly (SPEC-009/010), test runner, Git flow.

## Architecture Decisions
- Nest backend is the single source of truth for AI and data; frontend holds
  no keys. Ports `src/ai/domain/ports`, adapters `src/ai/infrastructure/gemini`.
- Frontend uses Supabase Auth only; JWT validated server-side via
  SupabaseAuthGuard; Realtime/Storage go through backend.
- /api/v1 + Swagger (off in prod); AiError envelope; Idempotency-Key required;
  SSE `/ai/jobs/:id/events` (header auth, polling stream, heartbeat 15s).
- `QUEUE_DRIVER=inline|bullmq` (bullmq only with `REDIS_URL`); jobs in Supabase
  with in-memory fallback; retries 3× exponential + circuit breaker.
- Books live in `books`/`book_versions` (idempotent by job id, per-version
  audit, soft delete); images optional in a private bucket, signed URLs on read.
- Prompts versioned (`book/v1`, 5/10/15 pages, audience, dedication); output
  validated/moderated/limited.
- NestJS 12 + TS 6 (ESM via require(esm)); Jest uses
  NODE_OPTIONS=--experimental-vm-modules. UI es-AR + i18n; docs English; SDD;
  a11y WCAG 2.2 AA / ISO 17549-3 / EN 301 549.

## Learnings / Edge Cases
- TS 6: explicit `rootDir` (`.`, build `./src`), `types:["node","jest"]`, no
  `baseUrl`, `import type` in decorated signatures (TS1272), strictPropertyInit.
- Swagger setup must run before app.listen (Express 5 ignores later routes).
- BullMQ needs a Redis ping at init (5s) and `maxRetriesPerRequest: null`; the
  worker uses a duplicated connection; raw bullmq (no Nest wrapper).
- Supabase JS clients are untyped here: cast responses to local RowResponse<T>
  shapes; storage uploads happen before the book row exists (job id path).
- Gemini TTS lacks es-AR: default es-419; models gemini-3.8-flash, gemini-3.1-flash-image, gemini-3.8-flash-tts; @google/genai 2.x.
- Click-on-release: read target on pointerdown, cancel scan timer, act at once.

## Next Steps
- [ ] Owner: rotate Gemini key; apply migrations 0001/0002; create the `book-images` bucket.
- [ ] SPEC-009/010: frontend generates/reads only via backend (SSE + polling),
      dropping direct Supabase data access.
- [ ] Chore: Vite 6→8 + frontend TS 5.8→7; add frontend Vitest + RTL.

## Housekeeping
- Keep under ~50 lines: before finishing, compact and remove resolved items.
