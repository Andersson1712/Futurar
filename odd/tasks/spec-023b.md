# SPEC-023B — Per-screen limits and wizard scan pagination

## Objective
Enforce `max_enabled` server-side and turn `level` into real scan pages so the
wizard never faces an unbounded grid. Adopted design (branch): pages = `level`
(teacher-authored), `max_per_page` column (migration 0008), `422
LIMIT_EXCEEDED` on save, client-side pagination via `utils/optionPages.ts` +
synthetic "Más opciones" target. Rejected alternative: paginated
`GET /options?page=` endpoint (network latency inside scan rhythm, two nav
controls = extra scan stops, offset slices break positional memory).

## Why
Accessibility-first (saved decision): single-switch users pay per scan stop.
One forward control + wrap, deterministic client timing, stable semantic pages,
loud config-time errors. Plus visible + voice page indicator ("Página X de Y",
`aria-live="polite"`, announced on page change including wrap).

## Scope
- Backend: `actions/limits.ts` + service validation, `maxPerPage` DTOs,
  migration `0008_option_pages.sql`, additive `level`/`sortOrder` in
  `StudentOption`, in-memory ↔ Supabase parity.
- Frontend: `utils/optionPages.ts`, `StudentApp` page state + indicator,
  `StudentEditor` caps UI, `t(key, params)` interpolation for
  `wizard.pageIndicator`.
- Out: book/reader list pagination, analytics (SPEC-027).

## Tasks
- [x] 023B-1 Verify branch design vs. approved spec; adopt levels-as-pages
- [x] 023B-2 Verify: typecheck, check:supabase, backend build/lint, targeted tests
- [x] 023B-3 Add page indicator (visible + voice) with tests
- [x] 023B-4 Full suites green (frontend 113, backend 242 + 1 e2e)
- [ ] 023B-5 Owner: apply migration 0008; push + PR to `dev`

## Route
Delegated-direct unavailable in this runtime (subagent provider refused);
proceeded direct-inline with bounded batches. Writer trigger fired (3 files:
messages.ts, StudentApp.tsx, 2 tests) — disclosed, kept minimal.

## Verification evidence
- `npm run typecheck` clean; `npm run check:supabase` OK
- `npm test` frontend: 113 passed
- backend `npm test`: 48 suites / 242 passed; `test:e2e`: 1 passed
- `npm run build` + `npm run lint` clean

## Commits
- 8ca6b55 feat(actions): per-page limits and wizard scan pagination (SPEC-023B)
- 6595f89 feat(a11y): announce wizard scan pages with visible and voice indicator

## Next
Push + PR to `dev` (needs user approval — publishing). Then next SPEC.
