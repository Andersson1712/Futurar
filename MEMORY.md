# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content; keep under ~50 lines.

## Current State
- MVP: accessible creation for severe motor disabilities, switch or direct input; frontend AI REMOVED (SPEC-001), generation gated by `AI_ENDPOINTS_ENABLED` until the key is rotated.
- SPEC-002→034 done: Nest 12 AI backend, /api/v1, jobs/SSE, persistence, frontend via backend, a11y, test infra + CI/governance, encrypted keys, profiles, contacts, actions catalog + limits, observability, 4 verticals, legacy backfill + retire, EPUB/PDF exports, OpenRouter multi-model, DB-owned teacher identity (SPEC-034); legacy `stories` read-only (SPEC-032).

## Architecture Decisions
- Nest backend is the single source of truth for AI and data; the frontend uses
  Supabase Auth only. Ports `src/ai/domain/ports`, adapters `…/gemini`.
- Teacher identity is DB-owned since SPEC-034: a `security definer` trigger on
  `auth.users` (migration 0015) creates the `teachers` row, and the frontend never
  touches that table. RLS stays OFF on `teachers`/`stories`/`usage_sessions` by owner
  decision (SPEC-034 D4) — every authenticated foundation may see every teacher.
- /api/v1 + Swagger (off in prod); AiError envelope; Idempotency-Key; SSE with header
  auth; `check:supabase` blocks imports AND `.from(`/`.rpc(` in scanned files.
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
- Integration branch `dev`; feature branch from dev + PR to dev; `main` frozen
  and protected (1 review, linear, squash-only); legacy backup `dev-legacy-backup`.

## Learnings / Edge Cases
- TS 6: explicit `rootDir`/`types`, no `baseUrl`, `import type` in decorated signatures (TS1272). Swagger must be set up before `app.listen`; raw bullmq needs a Redis ping + `maxRetriesPerRequest: null`.
- Supabase JS is untyped here: cast responses; storage paths use the job id; signed URLs never persisted.
- Gemini TTS lacks es-AR (default es-419); models gemini-3.8-flash / gemini-3.1-flash-image / gemini-3.8-flash-tts.
- Input contract: pointerdown on `[data-option]` wins over scan focus; never act on release. Rule: frontend/student decisions are accessibility-first (scan stops, deterministic timing, semantic pages, loud config errors); page changes always show + speak `Página X de Y` (aria-live).
- Scroll: vertical scroll allowed (`overflow-x` only, `pan-y`, dvh, `safe-center`); never global `overflow: hidden`.
- Menus/modals: trapped dialog + backdrop (`isModalOpen` pauses grids); capture-phase keydown.
- Autosave: `futurar_progress_v1` per student (whitelisted steps, empty config valid); clears on profile switch/new story/logout.
- A11y per profile: `student_settings` (migration 0003) seeds ScanSettings; `<html>` gets font/line/uppercase/bold; voice es-AR→es-US; reduced-motion/contrast CSS. Audit: axe-core in Vitest (color-contrast off in jsdom) + `utils/contrast` ratios; `useDialogA11y` for dialogs; declaration in `docs/accessibility/`.
- CI (SPEC-019 + rescue #35/#44): `.github/workflows/ci.yml` (frontend/e2e/backend + `commitlint`, Node 24); `dev`/`main` protected (4 checks, linear, squash-only, auto-delete, PR head must be up to date with base); NO husky — claimed in CONTRIBUTING/ADR 0006 but its branch never merged; `scripts/github-governance.sh` re-applies protection via `gh api`; test infra: MSW 2.x (v3 needs TS ≥5.9), coverage floor 36/35/33/37, E2E mocks Supabase+Nest, i18n `t()`.
- Backend e2e needs `AI_ENDPOINTS_ENABLED=true` + mock GEMINI/OPENROUTER keys + SUPABASE_URL/SERVICE_KEY exported in the shell BEFORE Node starts: `ConfigModule.forRoot` snapshots at import time, so `test-app.ts`'s late `process.env` assignment loses to the local `.env` → every AI request 503 `AI_ENDPOINTS_DISABLED`; run `npx jest --config ./test/jest-e2e.json --runInBand`.
- Credentials: `ai_credentials` + AES-256-GCM (`AI_SECRETS_MASTER_KEY`, base64 32B); async tenant-aware SecretProvider (DB → env); clients cached by key hash; flag `AI_CREDENTIALS_ENABLED` default false; API returns metadata only. SPEC-033D: resolution is provider-aware per secret name (`GEMINI_API_KEY`→gemini, `OPENROUTER_API_KEY`→openrouter); a stored-but-unreadable key fails loudly, only a missing/revoked row falls back to env; shared `CREDENTIAL_PROVIDERS` union drives the type, `AI_PROVIDERS`, service and Swagger enum.
- Profiles (SPEC-021): `ProfilesModule` CRUD scoped by JWT teacher, soft delete (`is_active=false`), `PUT /settings`, read-only `GET /options`; generation defaults from `book_story_size`/`book_audience` (fallback medium/child); frontend only via `services/backendProfiles.ts`.
- Contacts/dedications (SPEC-022): `profile_contacts` (1:N, cascade) via `ProfilesModule`; book-level `dedication_to/reason/position` + `is_favorite` with PUT/DELETE `/books/:id/dedication` and PUT `/books/:id/favorite`; reader modal uses contacts, PDF prefills; legacy `stories` stay read-only.
- Actions catalog (SPEC-023/023B): `actions → action_options → action_option_items` per teacher + `profile_actions`/`profile_option_items`; profile create seeds defaults and `modules` mirrors actions; `GET /profiles/:id/options` returns enabled items of every level (`level`/`sortOrder`); limits enforced on save (`max_enabled` per option, `action_options.max_per_page` per level, migration 0008) → 422 `LIMIT_EXCEEDED`; wizard pages by level via `utils/optionPages` + "Más opciones" + page indicator.
- Docs (SPEC-025): README EN + `README.es.md`, CONTRIBUTING/SECURITY/CODE_OF_CONDUCT, `docs/adr/` (6 ADRs), `docs/{guides,architecture,accessibility}` guides + `docs/i18n.md`; plain Markdown, no site generator.

## Next Steps
- [ ] Owner: rotate key; `book-images` bucket; `AI_SECRETS_MASTER_KEY`; `LOG_LEVEL=info` in `backend/.env.example`; apply migrations 0011+0012 and 0015; chore Vite/TS.
- [x] SPEC-029B/C (#45/#46). SPEC-032 (#47/#49). SPEC-031 (#50). SPEC-031B (#51). SPEC-033D (#52). SPEC-033B (#54). SPEC-034 (#57; migration 0015 not applied yet — new teachers get no row until it is). Next: SPEC-033C (budgets).
- Local env (Windows): the backend `npm test`/`test:e2e` scripts break at cmd.exe (POSIX `NODE_OPTIONS=` prefix) — use `$env:NODE_OPTIONS='--experimental-vm-modules'; npx jest`. `ms-playwright` is empty, so `npm run test:e2e` cannot run locally; `npx playwright install chromium` fixes it. The old rollup-binding crash is GONE (rollup 4.57.1 + win32-x64-msvc intact) — a half-installed `@testing-library/jest-dom` was the real cause, now repaired. `e2e/student-entry.spec.ts:33` asserts a transient spinner with the 5s default timeout and is flaky.
