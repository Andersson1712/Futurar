# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP in progress: accessible story creation for people with severe motor
  disabilities, operated by a single switch (scanning) or direct input.
- Frontend AI is REMOVED (SPEC-001). Generation is disabled until SPEC-003+
  re-enables backend endpoints with server-owned contracts.
- SPEC-002 done: Nest 12 hexagonal AiModule (Text/Image/Tts ports + Gemini
  adapters), server-owned key via SecretProvider, env validation at boot;
  legacy client-key controller/providers deleted. Frontend React 19.3 with
  React types added.
- Wizard, library, reader, TTS, dedications, teacher panel work; gaps: generation contracts, queue/SSE, frontend test runner, Prettier/Git flow.

## Architecture Decisions
- Nest backend is the single source of truth for AI; frontend holds no keys.
  Ports `src/ai/domain/ports`, adapters `src/ai/infrastructure/gemini`; prompts SPEC-004.
- Backend owns Supabase data; frontend uses Supabase Auth only; JWT validated
  server-side; Realtime/Storage go through backend.
- POST /ai/* disabled (AiEndpointsEnabledGuard / AI_ENDPOINTS_ENABLED) until
  SPEC-003 lands DTOs/OpenAPI/idempotency.
- NestJS 12 + TS 6: packages ESM-only, consumed from CJS via require(esm) on
  Node >= 20.19; Jest scripts use NODE_OPTIONS=--experimental-vm-modules.
- Versioned REST /api/v1; BullMQ + SSE for long jobs; throttler; hexagonal.
- UI es-AR with i18n; code/docs English; Conventional Commits; a11y WCAG 2.2
  AA / ISO-IEC 17549-3 / EN 301 549; SDD specs before code (Context7 versions).

## Learnings / Edge Cases
- TS 6: explicit `rootDir` (`.`, build `./src`), `types:["node","jest"]`, no
  `baseUrl`, `import type` in decorated signatures, strictPropertyInit on.
- @nestjs/config 12 uses Standard Schema; env validated with class-validator
  `validate()` (adding Zod needs approval).
- Gemini TTS lacks es-AR: default es-419 (preview), documented.
- Gemini models: text gemini-3.8-flash, image gemini-3.1-flash-image, TTS
  gemini-3.8-flash-tts; @google/genai 2.x (v2 breaks only Interactions API).
- Click-on-release: read target on pointerdown, cancel scan timer, act at once.
- es-AR voice fallback, scan speed per profile, copy in utils/messages.ts until SPEC-018.
- .env untracked; no real Gemini key in history. Backend lint still red (Prettier debt).

## Next Steps
- [ ] Owner: rotate Gemini key, purge ai_config keys, store new key server-side.
- [ ] SPEC-003: DTOs, OpenAPI /api/v1, idempotency; then re-enable endpoints.
- [ ] SPEC-004/005: prompts in backend + server-side output validation.
- [ ] SPEC-009: frontend generation via backend only.
- [ ] Chore: Vite 6→8 + frontend TS 5.8→7; backend global Prettier debt.
- [ ] Add Vitest + RTL (click wins, focus trap, autosave).

## Housekeeping
- Keep under ~50 lines: before finishing, compact and remove resolved items.
