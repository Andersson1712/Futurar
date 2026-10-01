# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP: accessible story creation for severe motor disabilities, switch or direct input.
- Frontend AI REMOVED (SPEC-001); generation gated by `AI_ENDPOINTS_ENABLED` until the key is rotated.
- SPEC-002→018 done: server-owned Nest 12 AI module, /api/v1 contracts,
  prompts/validation, BullMQ/Redis jobs, SSE, book persistence, frontend via
  backend, a11y (click-wins, scroll, dialogs, autosave, settings, WCAG) and the
  test infra (Vitest/MSW/axe/Playwright, coverage floor, critical E2E).
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
- Frontend `backendApi` (JWT refresh/retry) + `bookGeneration` (SSE + polling);
  library merges backend books with legacy `stories` read-only (no duplicate saves).
- Prompts versioned (`book/v1`, 5/10/15 pages, audience, dedication); output
  validated/moderated/limited.
- NestJS 12 + TS 6 (ESM/require(esm)); Jest needs
  NODE_OPTIONS=--experimental-vm-modules. UI es-AR; SDD; a11y WCAG 2.2 AA.
- Integration branch `dev`; feature branch from dev + PR to dev; main frozen
  until indicated (legacy dev backed up in `dev-legacy-backup`).

## Learnings / Edge Cases
- TS 6: explicit `rootDir`/`types`, no `baseUrl`, `import type` in decorated signatures (TS1272).
- Swagger before app.listen; BullMQ needs Redis ping + `maxRetriesPerRequest: null`; raw bullmq.
- Supabase JS is untyped here: cast responses; storage paths use the job id; signed URLs never persisted.
- Gemini TTS lacks es-AR (default es-419); models gemini-3.8-flash / gemini-3.1-flash-image / gemini-3.8-flash-tts.
- Input contract: pointerdown on `[data-option]` wins over scan focus; never act on release.
- Scroll: vertical scroll allowed (`overflow-x` only, `pan-y`, dvh, `safe-center`); never global `overflow: hidden`.
- Menus/modals: trapped dialog + backdrop (`isModalOpen` pauses grids); capture-phase keydown.
- Autosave: `futurar_progress_v1` per student (whitelisted steps, empty config valid); clears on profile switch/new story/logout.
- A11y per profile: `student_settings` (migration 0003) seeds ScanSettings; `<html>` gets font/line/uppercase/bold; voice es-AR→es-US; reduced-motion/contrast CSS.
- A11y audit: axe-core in Vitest (color-contrast off in jsdom) + `utils/contrast` ratios; `useDialogA11y` for dialogs; declaration in `docs/accessibility/`.
- Test infra: MSW 2.x (v3 needs TS >=5.9); `test:coverage` floor 36/35/33/37; critical E2E mocks Supabase REST + Nest API; i18n via typed `t()` in `utils/messages.ts`.

## Next Steps
- [ ] Owner: rotate Gemini key; apply migrations 0001/0002/0003; create `book-images` bucket.
- [ ] SPEC-019: CI (lint/typecheck/test/build/coverage); SPEC-021/023: profiles API; chore Vite/TS.

## Housekeeping
- Keep under ~50 lines: before finishing, compact and remove resolved items.
