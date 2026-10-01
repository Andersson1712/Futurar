# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP: accessible story creation for severe motor disabilities, single-switch
  (scanning) or direct input.
- Frontend AI REMOVED (SPEC-001); generation runs end-to-end via the backend but
  stays gated by `AI_ENDPOINTS_ENABLED` until the Gemini key is rotated.
- SPEC-002→010 done: server-owned Nest 12 AI module, /api/v1 contracts,
  prompts/validation, BullMQ/Redis jobs, SSE, book persistence with audit/soft
  delete/images, and the frontend generating and reading through the backend.
- Wizard, library, reader, TTS, dedications, teacher panel work; legacy Supabase data pending SPEC-021/023/027.

## Architecture Decisions
- Nest backend is the single source of truth for AI and data; the frontend uses
  Supabase Auth only. Ports `src/ai/domain/ports`, adapters `…/gemini`.
- /api/v1 + Swagger (off in prod); AiError envelope; Idempotency-Key; SSE with
  header auth; `check:supabase` blocks new direct Supabase imports.
- `QUEUE_DRIVER=inline|bullmq` (bullmq with `REDIS_URL`); jobs in Supabase with
  in-memory fallback; retries 3× exponential + circuit breaker.
- Books in `books`/`book_versions` (idempotent by job id, per-version audit,
  soft delete); images optional in a private bucket, signed URLs on read.
- Frontend `services/backendApi.ts` (fresh JWT, refresh + one retry on 401) and
  `bookGeneration.ts` (SSE via fetch + 2 s polling fallback); library merges
  backend books with legacy `stories` read-only (no duplicate saves).
- Prompts versioned (`book/v1`, 5/10/15 pages, audience, dedication); output
  validated/moderated/limited.
- NestJS 12 + TS 6 (ESM via require(esm)); Jest needs
  NODE_OPTIONS=--experimental-vm-modules. UI es-AR + i18n; SDD; a11y WCAG 2.2
  AA / ISO 17549-3.

## Learnings / Edge Cases
- TS 6: explicit `rootDir`/`types`, no `baseUrl`, `import type` in decorated signatures (TS1272).
- Swagger before app.listen; BullMQ needs Redis ping + `maxRetriesPerRequest: null`; raw bullmq.
- Supabase JS is untyped here: cast responses; storage paths use the job id; signed URLs never persisted.
- Gemini TTS lacks es-AR (default es-419); models gemini-3.8-flash / gemini-3.1-flash-image / gemini-3.8-flash-tts.
- Click-on-release: read target on pointerdown, cancel scan timer, act at once.

## Next Steps
- [ ] Owner: rotate Gemini key; apply migrations 0001/0002; create `book-images` bucket.
- [ ] SPEC-011→016: accessibility fixes/standards (click wins, scroll, focus
      trap, autosave, per-profile settings, WCAG).
- [ ] SPEC-017/018/019: frontend test runner, critical tests and CI.
- [ ] SPEC-021/023: profiles/options API; SPEC-027 analytics; then close the
      SPEC-010 audit.
- [ ] Chore: Vite 6→8 + frontend TS 5.8→7.

## Housekeeping
- Keep under ~50 lines: before finishing, compact and remove resolved items.
