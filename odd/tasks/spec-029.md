# SPEC-029 — New verticals: framework + Diseños (flyers)

## Objective
Extract the reusable generation pipeline and ship Diseños (flyers) through
the same accessible wizard. Presentaciones (029B) and Comunicación (029C)
follow the same pattern later.

## Why
Every pipeline seam is book-shaped today. Cloning it per vertical triples
prompt drift, moderation gaps, and wizard forks. One vertical done right
sets the pattern.

## Scope
- Backend `prompts/design/v1`, DTOs/types, prompt-builder, parser/validator,
  runner, `designs` module, migration `0009_designs.sql`, endpoints
  `POST /ai/designs/generate` + `GET/DELETE /designs`, E2E with mocked Gemini.
- Frontend `backendDesigns.ts`, wizard entry + library merge, i18n keys, tests.
- Reuse untouched: jobs, SSE, idempotency, correlation, metrics, guards shape.
- Out: presentaciones, comunicación, export (SPEC-031), new buckets, new deps.

## Tasks
- [x] 029-1 Validate new APIs; confirm mock boundary + 0009 shape. Done via
  repo-pattern validation (no Context7 tool in workers; mirrored against the
  book pipeline + SPEC-028 precedent).
- [x] 029-2 Backend: prompts/design/v1 + DTOs + builder + parser/validator (RED→GREEN, 16 unit tests green)
- [x] 029-3 Backend: runner + designs module + endpoints + migration 0009 + E2E (8 E2E green; book E2E 10/10 still green)
- [x] 029-4 Frontend: service + wizard entry + library merge + i18n + a11y tests
  (service/backendDesigns 8 unit green; StudentLibrary merge 3 RTL incl. axe
  green; design-entry E2E 3 tests green; typecheck + check:supabase green)
- [x] 029-5 Full verification (be: test/e2e/build/lint; fe: typecheck/check/test) +
  docs + MEMORY.md (<=50 lines); book E2E still green. Done 2026-10-03:
  be 295 unit + 18 e2e green, build/lint clean; fe typecheck/check clean,
  127 tests green, build green; parent spot-checked typecheck + backend e2e.
- [ ] 029-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Two bounded workers (backend 029-2/029-3, frontend 029-4) + parent spot checks
(typecheck, backend e2e) and parent-owned commits. Provider cooperated this
time; single writer at a time.

## Verification evidence
- `npm test` (backend/): 57 suites, 295 tests, all green (incl. 16 new design unit tests; book suites untouched and green)
- `npm run test:e2e` (backend/): 3 suites, 18 tests, all green (10 SPEC-028 book + 8 new SPEC-029 design)
- `npm run build` (backend/): clean
- `npm run lint` (backend/): clean after typed E2E assertions (no `any`)
- Frontend: `npm test` 27 files / 127 tests green; `npm run build` green
  (chunk-size warning pre-existing); design-entry E2E 6/6 (2 browsers).

## Commits (feat/spec-029-designs, rebased onto dev @ c2e0d3b)
- 23fe347 feat(designs): prompt v1 + DTO + builder + unit tests
- 2a15b16 feat(designs): output parser + validator + unit tests
- 31ad842 feat(designs): generation service + runner + dedicated queue
- af0208c feat(designs): designs module + repositories + 0009 migration
- c25864a feat(designs): POST ai/designs/generate + design flags
- a4d2424 test(designs): flyer flow + failures + idempotency + kill-switches
- 2e7f7c8 feat(designs): frontend service + MSW tests
- 9c050eb feat(designs): library merge + design i18n keys
- 241e8de feat(designs): accessible wizard entry + design E2E

## Next
Push + PR to `dev` (029-6, needs user approval — publishing). Note: stacked on
 028 branch; rebase onto `dev` after PR #37 merges, then open the 029 PR.
