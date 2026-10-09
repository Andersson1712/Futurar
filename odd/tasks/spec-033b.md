# SPEC-033B — Per-teacher AI model selection (curated catalog)

- Branch: `feat/spec-033b-model-selection`
- Spec: `docs/specs/SPEC-033B.md` (approved 2026-10-09)
- Related: `docs/specs/SPEC-033D.md` (approved; split out — per-tenant keys)

## Objective

Each teacher picks text + image models from the curated OpenRouter
allowlist; the choice is persisted server-side and applied to their
generations, bounded by the allowlist. Fix the dead `design.*` config and
give the ports an explicit `vertical`.

## Scope

- Backend: migration 0014 `teacher_ai_settings`; `TeacherAiSettings`
  repository; `ModelSelectionService`; port `vertical`; adapters use the
  resolver + request vertical (+ image `costUsd`); catalog + preferences
  endpoints; module wiring; metrics model dimension.
- Frontend: `services/backendModels.ts`; `AiModelPanel`; TeacherPanel tab;
  i18n; MSW test.
- Out: per-tenant key resolution / provider-union widening (SPEC-033D),
  budgets (033C), Gemini model picking, per-vertical pairs.

## Tasks

- [ ] 033B-1 Migration 0014 + `TeacherAiSettings` repository (+ Supabase
  adapter + in-memory fallback) + tests
- [ ] 033B-2 `ModelSelectionService` (pref → env per vertical → default;
  allowlist validation at read; stale slug fallback) + tests (RED→GREEN)
- [ ] 033B-3 Port `vertical` + adapters use resolver + vertical + image
  `costUsd` + runner wiring + regression test proving `design.*` honored
- [ ] 033B-4 DTOs + endpoints (`GET /ai/models`, `GET/PUT
  /ai/model-preferences`) + module wiring + E2E (mocked HTTP)
- [ ] 033B-5 Frontend service + `AiModelPanel` + TeacherPanel wiring +
  i18n + MSW test
- [ ] 033B-6 Verification + docs (MEMORY.md / plan.md / spec evidence) +
  work-unit commits

## Route

Delegated direct: one bounded writer for the backend slice (033B-1..4),
one for the frontend slice (033B-5); parent verifies and commits.

## Acceptance criteria

See `docs/specs/SPEC-033B.md` → Acceptance criteria.

## Verification evidence (pending)

- Backend `npm test` / `npm run test:e2e` / `npm run build` /
  `npm run lint`: pending
- Frontend `npm run typecheck` (0 new) / `npm test`: pending

## Commits (pending)

## Next

After green: PR to `dev` (user decision). Then SPEC-033D on its own branch.
