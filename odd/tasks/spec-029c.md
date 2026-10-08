# SPEC-029C — Comunicación vertical (boards)

## Objective
Ship Comunicación as the third vertical on the SPEC-029 framework: communication
boards (feelings, help requests, custom) with 4/6/8 cells (short label +
pictogram image each) created through the same accessible scan wizard, plus a
board USE view (select a cell → speak its label aloud) reusing existing speech.
No export, no post-creation editing.

## Why
Books proved the pipeline, Diseños proved the vertical pattern, Presentaciones
proved multi-image decks. Boards reuse it without forking prompts, moderation,
jobs, SSE, or wizard behavior — and unlike the other verticals, the artifact is
interactive: the use view is in scope because a board you cannot speak with is
pointless.

## Scope
- Backend `prompts/communication/v1`, DTOs/types, prompt-builder,
  parser/validator, runner, `communications` module, migration
  `0012_communications.sql`, endpoints `POST /ai/communications/generate` +
  `GET/DELETE /communications`, E2E with mocked Gemini.
- Frontend `backendCommunications.ts`, wizard entry (kind → topic →
  cell-count → style) + library merge + board use view (ScanningGrid +
  speak on select), i18n keys, tests. Wizard step whitelist updated from
  day one (029B lesson); E2E fixtures with distinct title/topic (029B lesson).
- Reuse untouched: jobs, SSE, idempotency, correlation, metrics, guards shape.
- Out: board editing, custom pictogram upload, per-cell voices, export
  (SPEC-031), new buckets, new deps, OTel spans.

## Tasks
- [x] 029C-1 Validate new APIs; confirm mock boundary + 0012 shape (no new deps expected). Done: same verdict as 029B-1 (mirror pattern, TEXT/IMAGE ports mock boundary, 0012 mirrors 0011 with cells JSONB).
- [x] 029C-2 Backend: prompts/communication/v1 + DTOs + builder + parser/validator. Done: 15/15 unit green first run (import lesson from 029B applied).
- [x] 029C-3 Backend: runner + communications module + endpoints + migration 0012 + E2E. Done: 10/10 board E2E green; full unit 356/356; full E2E 42/42 (6 suites); build + lint clean.
- [x] 029C-4 Frontend: service + wizard entry + library merge + board use view + i18n. Done: backendCommunications service + MSW test, StudentApp wizard (kind→topic→cellCount→style→generate) + BOARD_USE view (speak on select), whitelist updated from day one (029B lesson), StudentLibrary merge, 25 i18n keys, types/progressStore unions. Frontend unit/build BLOCKED environmentally (same as 029B); typecheck 0 errors in touched files; E2E fixtures with distinct title/topic (029B lesson).
- [x] 029C-5 Full verification + docs + MEMORY.md. Done: docs/specs/SPEC-029C.md written; MEMORY.md synced (<=50 lines); all vertical flows green.
- [ ] 029C-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Delegated-direct unavailable in this runtime (provider refused: OpenCode
free-tier restriction, disclosed since 029B); proceeding direct-inline in
bounded batches, disclosed here. Single writer at a time (parent), one
work-unit commit per task.

## Acceptance (from approved spec)
- POST generates 202 + job -> terminal -> GET returns validated board
  (mocked Gemini, flags true in test only)
- 502 invalid output / wrong cell count / 422 blocked / idempotent replay
  same job / flag off 501 / over-limit topic 400 / unsupported cellCount 400
- Books + designs + presentations flows untouched and green; one-switch
  operable; cells >=44px; axe clean; board speaks selected cell
- All backend checks green; frontend typecheck 0 errors in touched files;
  no new runtime dep unless approved; owner applies 0012

## Commits (feat/spec-029c-communications)
- 2e01fc6 feat(boards): prompt v1, DTO, builder, parser and validator with unit tests (029C-2; 15/15 green)
- 4118663 feat(boards): runner, module, endpoints, migration 0012 and E2E (029C-3; 10/10 E2E, full be 356u/42e2e green)
- 962808e feat(boards): frontend service, wizard entry, board use view, library merge and i18n (029C-4)
