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
  379 tests green. `npm run test:e2e`: 9 suites / 58 tests green.
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
- d74bbed docs(spec): record SPEC-033B evidence and environment blocker
- 454d683 feat(ai): gate the model panel on OpenRouter enablement

## Open risks

- D6 **RESOLVED** (commit `454d683`): `GET /ai/models` now returns
  `openRouterEnabled` — the backend is the single source of truth (no
  browser env var) — and `AiModelPanel` renders a localized disabled state
  when off.
- Supabase adapter lacks a dedicated unit test (in-memory + E2E cover it).
- Strict RED-first was not captured for some new modules (authored alongside
  their tests); the backend catalog spec captured a real RED.
- Frontend `vitest`/`vite` cannot run in this environment (native rollup
  crash, exit -1073741819); panel behavior verified via an esbuild+jsdom
  harness. Confirm in CI.

## Next

After green: PR to `dev` (user decision). Then SPEC-033D on its own branch.
