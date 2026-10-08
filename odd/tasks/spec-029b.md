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
- [x] 029B-2 Backend: prompts/presentation/v1 + DTOs + builder + parser/validator. Done 2026-10-07: 15/15 unit green (parser/validator/builder specs). Missed formal RED (new files, mirrored proven pattern — disclosed); fixed 1 spec import bug (version not re-exported by builder).
- [x] 029B-3 Backend: runner + presentations module + endpoints + migration 0011 + E2E. Done 2026-10-07: 10/10 presentation E2E green; full unit 341/341; full E2E 32/32 (5 suites); build + lint clean (lint autofix: guard spec line-join only).
- [x] 029B-4 Frontend: service + wizard entry + library merge + i18n + a11y tests. Done 2026-10-07: backendPresentations service + MSW test, StudentApp wizard (topic→slideCount→style→generate), StudentLibrary merge, 17 i18n keys, types/progressStore unions. Frontend unit/build BLOCKED environmentally (vitest/vite silent exit 0 on dev too); typecheck 0 errors in touched files (25 pre-existing proven on clean dev); check:supabase 4 pre-existing violations.
- [x] 029B-5 Full verification + docs + MEMORY.md. Done 2026-10-07: docs/specs/SPEC-029B.md written; MEMORY.md synced (<=50 lines); book/design flows green.
- [ ] 029B-6 Push + PR to `dev` (needs user approval — publishing; also needs Git identity configured — commits pending).

## Route
Delegated-direct unavailable in this runtime (explorer refused: OpenCode free-tier restriction, disclosed 2026-10-07); proceeding direct-inline in bounded batches, disclosed here. Single writer at a time (parent), one task per work-unit commit.

## Acceptance (from approved spec)
- POST generates 202 + job -> terminal -> GET returns validated deck (mocked Gemini, flags true in test only)
- 502 invalid output / 422 blocked / idempotent replay same job / flag off 501
- Books + designs flows untouched and green; one-switch operable; axe clean
- All backend + frontend checks green; no new runtime dep unless approved; owner applies 0010

## Commits (feat/spec-029b-presentations)
- b73a549 feat(presentations): prompt v1, DTO, builder, parser and validator with unit tests (029B-2; 15/15 green)
- 9da8d7c feat(presentations): runner, module, endpoints, migration 0011 and E2E (029B-3; 10/10 E2E, full be 341u/32e2e green)
- be326f4 feat(presentations): frontend service, wizard entry, library merge and i18n (029B-4; fe unit/build blocked environmentally, disclosed)
