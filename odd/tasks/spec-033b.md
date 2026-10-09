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

- [x] 033B-1 Migration 0014 + `TeacherAiSettings` repository (+ Supabase
  adapter + in-memory fallback) + tests
- [x] 033B-2 `ModelSelectionService` (pref → env per vertical → default;
  allowlist validation at read; stale slug fallback) + tests
- [x] 033B-3 Port `vertical` + adapters use resolver + vertical + image
  `costUsd` + runner wiring + regression test proving `design.*` honored
- [x] 033B-4 DTOs + endpoints (`GET /ai/models`, `GET/PUT
  /ai/model-preferences`) + module wiring + E2E (mocked HTTP)
- [x] 033B-5 Frontend service + `AiModelPanel` + TeacherPanel wiring +
  i18n + MSW test
- [~] 033B-6 Verification + docs (MEMORY.md / plan.md / spec evidence) +
  work-unit commits — native review pending

## Route

Delegated direct: one bounded writer for the backend slice (033B-1..4),
one for the frontend slice (033B-5); parent verifies and commits.

## Acceptance criteria

See `docs/specs/SPEC-033B.md` → Acceptance criteria.

## Verification evidence

- Backend `npm run build` + `npm run lint`: clean. `npm test`: 71 suites /
  378 tests green. `npm run test:e2e`: 9 suites / 57 tests green.
  NOTE: the repo scripts `npm test` / `npm run test:e2e` fail at the shell
  on Windows (POSIX `NODE_OPTIONS=...` assignment under cmd.exe); re-run
  with `$env:NODE_OPTIONS='--experimental-vm-modules'` + `npx jest`.
- Backend RED→GREEN: design-vertical regression observed red (image adapter
  ignored `vertical` → got the default, expected `qwen/qwen-image-3-pro`),
  green after the fix.
- Frontend `npm run typecheck`: 25 errors = documented baseline, 0 new.
- Frontend `npm test` / `npm run build`: **UNAVAILABLE** — native Rollup
  binding (`@rollup/rollup-win32-x64-msvc` 4.57.1) crashes under Node
  24.19.0 (exit -1073741819), pre-existing. Scenarios verified via an
  esbuild + Node harness instead. Confirm in CI / another environment.

## Commits (feat/spec-033b-model-selection)

- efc12a7 docs(spec): reconcile roadmap and split SPEC-033B/033D
- ea4e40c feat(ai): per-teacher model selection from the curated allowlist
- 9c17fbf feat(ai): teacher model picker panel and service

## Open risks

- D6 "hidden unless OpenRouter enabled": no frontend flag source exists, so
  the panel is always visible and the preference is inert when the flag is
  off. Needs a product decision (add a flag endpoint or accept inert).
- Supabase adapter lacks a dedicated unit test (in-memory + E2E cover it).
- Strict RED-first was not captured for the storage/service/frontend new
  modules (authored alongside their tests).

## Next

After green: PR to `dev` (user decision). Then SPEC-033D on its own branch.
