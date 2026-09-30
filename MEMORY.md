# MEMORY.md

> Living memory for agents. Read first, update last. Prune obsolete content.

## Current State
- MVP in progress: accessible story creation for people with severe motor
  disabilities, operated by a single switch (scanning) or direct input.
- Frontend AI is REMOVED (SPEC-001): no SDK, keys or prompts in the browser.
  Story generation is temporarily disabled until SPEC-002/003/009 land.
- Wizard, library, reader, TTS, dedications and teacher panel still work;
  known gaps: backend generation pipeline, job queue/SSE, frontend test runner,
  backend Prettier debt (lint red), Git flow enforcement.

## Architecture Decisions
- Nest backend is the single source of truth for AI. Frontend never calls AI
  providers or holds keys. Providers are pluggable adapters (Gemini now;
  OpenAI/Claude later) behind Text/Image/Tts interfaces.
- Backend is the only owner of Supabase data. Frontend uses Supabase Auth
  only; JWT is validated server-side. Realtime and Storage go through backend.
- POST /ai/* is disabled by default (AiEndpointsEnabledGuard /
  AI_ENDPOINTS_ENABLED) until keys and DTOs are server-owned (SPEC-002/003).
- Hexagonal + SOLID inside Nest; versioned REST under /api/v1; queue (BullMQ)
  + SSE for long generations; idempotency keys; @nestjs/throttler.
- UI in es-AR with i18n; code and docs in English; Conventional Commits.
- Accessibility baseline: WCAG 2.2 AA, ISO/IEC 17549-3, EN 301 549.
- Workflow is Spec-Driven (SDD): spec + approval before code. Context7 MCP
  (remote, context7.com) validates LTS versions; key file outside repo.

## Learnings / Edge Cases
- Click-on-release bug: clicking B while scan focuses A selects A. Fix: read
  the real target on pointerdown, cancel the scan timer, act immediately.
- Scroll blocked on mobile/desktop: avoid global overflow:hidden and global
  preventDefault; use min-height:100dvh and passive listeners.
- es-AR voice is not available with current TTS: ship voice selector +
  es-US fallback, document the limitation, evaluate cloud TTS later.
- Scan speed is per profile (slow 3.0s / normal 1.5s / fast 0.8s / custom).
- .env was tracked in git (now ignored/untracked); no real Gemini key in
  history. Backend lint is red from pre-existing Prettier formatting debt.
- Disabled-generation UI copy lives in utils/messages.ts until SPEC-018 i18n.

## Next Steps
- [ ] Owner: rotate Gemini key, purge ai_config keys, store new key server-side.
- [ ] SPEC-002/003: AiModule, provider interfaces, DTOs, env validation.
- [ ] SPEC-004/005: prompts in backend + server-side output validation.
- [ ] SPEC-009: frontend generation via backend only.
- [ ] Add Vitest + RTL (3 critical tests: click wins, focus trap, autosave).

## Housekeeping
- Keep this file under ~50 lines. Before finishing a task, compact: move
  resolved items out and delete obsolete notes instead of appending.
