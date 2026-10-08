# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content; keep under ~50 lines.

## Current State
- MVP: accessible story creation for severe motor disabilities, switch or direct input.
- Frontend AI REMOVED (SPEC-001); generation gated by `AI_ENDPOINTS_ENABLED` until the key is rotated.
- SPEC-002→025 done: Nest 12 AI backend, /api/v1, jobs/SSE, persistence,
  frontend via backend, a11y, test infra + CI/governance, encrypted keys, profiles API,
  contacts/dedications/favorites, actions/options catalog + limits, public docs. Legacy data pending SPEC-027.

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
- Integration branch `dev`; feature branch from dev + PR to dev; `main` frozen
  and protected (1 review, linear, squash-only); legacy backup `dev-legacy-backup`.

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
- CI (SPEC-019/024): `.github/workflows/ci.yml` (frontend/e2e/backend + `commitlint`, Node 24; actions v7); `dev`/`main` protected (4 checks, linear; main 1 review), squash-only + auto-delete; husky v9 + commitlint v21 (`prepare`, `.husky/commit-msg`, ESM config); `scripts/github-governance.sh` re-applies it via `gh api`; PR/issue templates; test infra: MSW 2.x (v3 needs TS ≥5.9), coverage floor 36/35/33/37, E2E mocks Supabase+Nest, i18n `t()`.
- Credentials: `ai_credentials` + AES-256-GCM (`AI_SECRETS_MASTER_KEY`, base64 32B); async tenant-aware SecretProvider (DB → env); clients cached by key hash; flag `AI_CREDENTIALS_ENABLED` default false; API returns metadata only.
- Profiles (SPEC-021): `ProfilesModule` CRUD scoped by JWT teacher, soft delete (`is_active=false`), `PUT /settings`, read-only `GET /options`; generation defaults from `book_story_size`/`book_audience` (fallback medium/child); frontend only via `services/backendProfiles.ts`.
- Contacts/dedications (SPEC-022): `profile_contacts` (1:N, cascade) via `ProfilesModule`; book-level `dedication_to/reason/position` + `is_favorite` with PUT/DELETE `/books/:id/dedication` and PUT `/books/:id/favorite`; reader modal uses contacts, PDF prefills; legacy `stories` stay read-only.
- Actions catalog (SPEC-023/023B): `actions → action_options → action_option_items` per teacher + `profile_actions`/`profile_option_items`; profile create seeds defaults and `modules` mirrors actions; `GET /profiles/:id/options` returns enabled items of every level (`level`/`sortOrder`); limits enforced on save (`max_enabled` per option, `action_options.max_per_page` per level, migration 0008) → 422 `LIMIT_EXCEEDED`; wizard pages by level via `utils/optionPages` + "Más opciones" + page indicator.
- Docs (SPEC-025): README EN + `README.es.md`, CONTRIBUTING/SECURITY/CODE_OF_CONDUCT, `docs/adr/` (6 ADRs), `docs/{guides,architecture,accessibility}` guides + `docs/i18n.md`; plain Markdown, no site generator.

## Next Steps
- [ ] Owner: rotate key; `book-images` bucket; `AI_SECRETS_MASTER_KEY`; `LOG_LEVEL=info` in `backend/.env.example`; chore Vite/TS; applies 0011.
- [x] SPEC-028/029/023C/033 merged (#37/#38/#40/#41). SPEC-029B done on feat/spec-029b (be 341u+32e2e green). Next: SPEC-029C. Pending: Git identity+commits, push/PR approval; fe tests blocked by env (vitest/vite silent, jest-dom v7 — proven on clean dev).
