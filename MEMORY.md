# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP: accessible story creation for people with severe motor disabilities,
  single-switch (scanning) or direct input.
- Frontend AI is REMOVED (SPEC-001). Backend generation is functional when
  `AI_ENDPOINTS_ENABLED=true` (synchronous in-memory jobs); async queue/SSE
  arrive in SPEC-006/007.
- SPEC-002→005 done: Nest 12 hexagonal AiModule (Text/Image/Tts ports + Gemini
  adapters), server-owned keys, env validation, HTTP contracts under /api/v1,
  versioned `book/v1` prompts, output validation/moderation/limits.
  Frontend React 19.3 with React types added.
- Wizard, library, reader, TTS, dedications, teacher panel work; gaps: queue/SSE, persistence, frontend test runner, Git flow.

## Architecture Decisions
- Nest backend is the single source of truth for AI; frontend holds no keys.
  Ports `src/ai/domain/ports`, adapters `src/ai/infrastructure/gemini`; prompts SPEC-004.
- Backend owns Supabase data; frontend uses Supabase Auth only; JWT validated
  server-side via SupabaseAuthGuard; Realtime/Storage go through backend.
- /api/v1 + Swagger (off in prod); throttler active; AiError envelope;
  Idempotency-Key required on POST /ai/books/generate; in-memory stores
  replaced by Redis/Postgres in SPEC-006.
- Prompts are versioned (`book/v1`, 5/10/15 pages, audience, dedication);
  adapters stay prompt-agnostic; output is validated, moderated and limited.
- NestJS 12 + TS 6: packages ESM-only, consumed from CJS via require(esm) on
  Node >= 20.19; Jest uses NODE_OPTIONS=--experimental-vm-modules.
- UI es-AR with i18n; code/docs English; Conventional Commits; a11y WCAG 2.2
  AA / ISO-IEC 17549-3 / EN 301 549; SDD specs before code (Context7 versions).

## Learnings / Edge Cases
- TS 6: explicit `rootDir` (`.`, build `./src`), `types:["node","jest"]`, no
  `baseUrl`, `import type` in decorated signatures (TS1272), strictPropertyInit.
- Swagger setup must run before app.listen (Express 5 ignores later routes).
- Gemini TTS lacks es-AR: default es-419. Models: text gemini-3.8-flash, image
  gemini-3.1-flash-image, TTS gemini-3.8-flash-tts; @google/genai 2.x.
- Click-on-release: read target on pointerdown, cancel scan timer, act at once.
- .env untracked; backend `npm run lint` green.

## Next Steps
- [ ] Owner: rotate Gemini key, purge ai_config keys, store new key server-side.
- [ ] SPEC-006/007: BullMQ jobs + SSE; move idempotency/job stores to
      Redis/Supabase; then enable AI_ENDPOINTS_ENABLED in real environments.
- [ ] SPEC-008: persistence, audit and signed image URLs.
- [ ] SPEC-009: frontend generation via backend only.
- [ ] Chore: Vite 6→8 + frontend TS 5.8→7; add frontend Vitest + RTL.

## Housekeeping
- Keep under ~50 lines: before finishing, compact and remove resolved items.
