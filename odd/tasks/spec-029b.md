# SPEC-029B — Presentaciones vertical

## Objective
Ship Presentaciones as the second vertical on the SPEC-029 framework, mirroring Diseños: topic + 5/8/10 slides with short text + image per slide, through the same accessible scan wizard. No export.

## Why
Books validated the pipeline, Diseños proved the vertical pattern. Presentaciones reuses it without forking prompts, moderation, jobs, SSE, or wizard behavior.

## Scope
- Backend `prompts/presentation/v1`, DTOs/types, prompt-builder, parser/validator, runner, `presentations` module, migration `0010_presentations.sql`, endpoints `POST /ai/presentations/generate` + `GET/DELETE /presentations`, E2E with mocked Gemini.
- Frontend `backendPresentations.ts`, wizard entry + library merge, i18n keys, tests.
- Reuse untouched: jobs, SSE, idempotency, correlation, metrics, guards shape.
- Out: comunicacion (029C), export (SPEC-031), new buckets, new deps, OTel spans.

## Tasks
- [x] 029B-1 Validate new APIs; confirm mock boundary + 0010 shape (no new deps expected). Done 2026-10-07: mirrored design builder/DTO/0009 + controller; mock boundary = TEXT/IMAGE ports; 0010 mirrors 0009 with slides JSON in version row.
- [ ] 029B-2 Backend: prompts/presentation/v1 + DTOs + builder + parser/validator (RED->GREEN + unit tests)
- [ ] 029B-3 Backend: runner + presentations module + endpoints + migration 0010 + E2E (mocked Gemini; books + designs E2E still green)
- [ ] 029B-4 Frontend: service + wizard entry + library merge + i18n + a11y tests (scan, pointerdown-wins, Pagina X de Y, axe)
- [ ] 029B-5 Full verification (be: test/e2e/build/lint; fe: typecheck/check/test) + docs + MEMORY.md (<=50 lines)
- [ ] 029B-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Delegated-direct unavailable in this runtime (explorer refused: OpenCode free-tier restriction, disclosed 2026-10-07); proceeding direct-inline in bounded batches, disclosed here. Single writer at a time (parent), one task per work-unit commit.

## Acceptance (from approved spec)
- POST generates 202 + job -> terminal -> GET returns validated deck (mocked Gemini, flags true in test only)
- 502 invalid output / 422 blocked / idempotent replay same job / flag off 501
- Books + designs flows untouched and green; one-switch operable; axe clean
- All backend + frontend checks green; no new runtime dep unless approved; owner applies 0010

## Commits (feat/spec-029b-presentations)
- (pending) docs: SPEC-029B task doc + branch bootstrap
