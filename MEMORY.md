# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content; keep under ~50 lines.

## Current State
- MVP: accessible story creation for severe motor disabilities, switch or direct input.
- Frontend AI REMOVED (SPEC-001); generation gated by `AI_ENDPOINTS_ENABLED` until the key is rotated.
- SPEC-002→023 done: Nest 12 AI backend, /api/v1, jobs/SSE, persistence,
  frontend via backend, a11y, test infra + CI, encrypted keys, profiles API,
  contacts/dedications/favorites, actions/options catalog. Legacy Supabase data
  pending SPEC-023B/027. Wizard/library/reader/TTS/teacher work.

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
- Input contract: pointerdown on `[data-option]` wins over scan focus; never act on release. Rule: frontend/student decisions are accessibility-first (scan stops, deterministic timing, semantic pages, loud config errors); page changes always show + speak `Página X de Y` (aria-live).
- Scroll: vertical scroll allowed (`overflow-x` only, `pan-y`, dvh, `safe-center`); never global `overflow: hidden`.
- Menus/modals: trapped dialog + backdrop (`isModalOpen` pauses grids); capture-phase keydown.
- Autosave: `futurar_progress_v1` per student (whitelisted steps, empty config valid); clears on profile switch/new story/logout.
- A11y per profile: `student_settings` (migration 0003) seeds ScanSettings; `<html>` gets font/line/uppercase/bold; voice es-AR→es-US; reduced-motion/contrast CSS.
- A11y audit: axe-core in Vitest (color-contrast off in jsdom) + `utils/contrast` ratios; `useDialogA11y` for dialogs; declaration in `docs/accessibility/`.
- CI: `.github/workflows/ci.yml` (frontend/e2e/backend, Node 24; actions v7); `dev` protected (3 checks); test infra: MSW 2.x (v3 needs TS ≥5.9), coverage floor 36/35/33/37, E2E mocks Supabase+Nest, i18n `t()`.
- Credentials: `ai_credentials` + AES-256-GCM (`AI_SECRETS_MASTER_KEY`, base64 32B); async tenant-aware SecretProvider (DB → env); clients cached by key hash; flag `AI_CREDENTIALS_ENABLED` default false; API returns metadata only.
- Profiles (SPEC-021): `ProfilesModule` CRUD scoped by JWT teacher, soft delete (`is_active=false`), `PUT /settings`, read-only `GET /options`; generation defaults from `book_story_size`/`book_audience` (fallback medium/child); frontend only via `services/backendProfiles.ts`.
- Contacts/dedications (SPEC-022): `profile_contacts` (1:N, cascade) via `ProfilesModule`; book-level `dedication_to/reason/position` + `is_favorite` with PUT/DELETE `/books/:id/dedication` and PUT `/books/:id/favorite`; reader modal uses contacts, PDF prefills; legacy `stories` stay read-only.
- Actions catalog (SPEC-023); SPEC-023B verified on `feat/spec-023b-limits-pagination` (levels-as-pages, `max_per_page` migration 0008, 422 LIMIT_EXCEEDED, `optionPages` + Más opciones; commit fbb142a adds page indicator): full suites green, pending push + PR to dev.

## Next Steps
- [ ] Owner: rotate key; migrations 0001→0008; `book-images` bucket; `AI_SECRETS_MASTER_KEY`; SPEC-027 analytics; chore Vite/TS.
- [x] SPEC-024 verified (branch feat/spec-024-student-entry, commits b849ab0/1e630d6): public `GET /profiles/active` (notes stripped, 401 kept on scoped list); login-free entry (single fetch + abort); failure exits GENERATING; i18n errors; suites green (be 238+1, fe 108); pending push + PR to dev.
