# SPEC-023B — Per-screen/action/page limits and wizard scan pagination

- Status: **implemented** (2026-10-01; pending owner: apply migration 0008)
- Phase: 6 / EPIC 6.4
- Depends on: SPEC-023 (actions/options catalog)
- Blocks: SPEC-027 (analytics), SPEC-010 audit closure

## Objective
Close the SPEC-023 deviation: enforce `max_enabled` **server-side** and turn the
`level` field into real scan pages so the student wizard never faces an
unbounded grid. Add a per-page cap (`max_per_page`) and navigate pages with a
synthetic "Más opciones" scan target, preserving one-switch interaction and
"click wins over scan focus" (SPEC-011).

## Current state
- `action_options.max_enabled` (default 4, DTO `1..12`) is stored but **never
  enforced**: `saveProfileItems` persists any number of enabled items and
  `getStudentOptions` ignores it.
- `action_option_items.level` (`1..5`) is stored but items with `level > 1` are
  filtered out (`supabase-action.repository.ts:545`), so levels are dead weight.
- `GET /profiles/:id/options` returns the full enabled level-1 set; there is no
  `max_per_page` column and no pagination. `ScanningGrid` auto-advances over
  every option in one screen (`components/ScanningGrid.tsx:62-69`).
- `StudentEditor` caps enabled items **client-side only** (alert at
  `components/StudentEditor.tsx:166-168`); a stale client can exceed the cap.
- Adapter divergence: in-memory `studentOptionsFor` does not require
  `action.code === 'create'` (`in-memory-action.repository.ts:445-475`) while
  Supabase does (`supabase-action.repository.ts:543`).

## Decisions to confirm
- **D1 Column (recommended)**: migration `0008_option_pages.sql` adds
  `action_options.max_per_page integer not null default 6` with a check
  `between 1 and 12`. Alternative: a global constant (simpler, not per-option).
- **D2 Pages = `level` (recommended)**: the sorted enabled items of an option are
  grouped by `level` (1..5); each level is one scan page. `max_enabled` caps the
  **total** enabled items per option; `max_per_page` caps the enabled items
  **per level**. Level 1 is the first page; higher levels are reached through a
  synthetic "More options" target. Alternative: ignore `level` and chunk a flat
  list by `max_per_page` (loses teacher-authored grouping).
- **D3 Enforcement (recommended)**: validate in `ActionsService`
  (`saveProfileItems`) before persisting — per option: `enabledTotal <=
  maxEnabled` and `enabledPerLevel <= maxPerPage`. On violation throw
  `AiErrorException(422, 'LIMIT_EXCEEDED', …)` with `details` = `{ optionCode,
  scope: 'option'|'page', level?, limit, actual }`. The repositories keep
  persistence only. Alternative: enforce in SQL constraints/triggers (harder to
  return structured errors).
- **D4 Read model (recommended)**: extend `StudentOption`/`ProfileOption`
  **additively** with `level: number` and `sortOrder: number`; return **all**
  enabled levels ordered by `level, sort_order` (drop the `level !== 1` filter).
  `id/label/icon/isEnabled` stay, so existing consumers keep working.
- **D5 Frontend pagination (recommended)**: a pure util (`utils/optionPages.ts`)
  groups options by level into pages (`buildOptionPages`, `nextPageIndex`,
  wrap last→first) with unit tests; `StudentApp` tracks the active page per step
  and passes the current page to `ScanningGrid`. When more than one page exists,
  append a synthetic "More options" target (i18n key, icon) that advances the
  page. Selection (`pointerdown`/`data-option`) still always beats scan focus.
  Alternative: paginate inside `ScanningGrid` (mixes concerns, harder to test).
- **D6 Editor (recommended)**: `StudentEditor` elements tab shows
  `enabled/maxEnabled` and per-level counts; disables toggling past the caps and
  renders server `LIMIT_EXCEEDED` errors via i18n. Server stays authoritative.
- **D7 Adapter parity (recommended)**: fix in-memory `studentOptionsFor` to
  require `action.code === 'create'` and to expose `level`/`sortOrder`, matching
  Supabase; add a parity test.
- **D8 Scope (recommended)**: this spec reveals level > 1 items, adds the page
  cap and server enforcement. Book/reader list pagination and analytics stay out
  (SPEC-027 / future).

## Contracts
- Migration `backend/supabase/migrations/0008_option_pages.sql`:
  `alter table action_options add column max_per_page integer not null default 6
  check (max_per_page between 1 and 12);`
- DTOs: `CreateOptionDto`/`UpdateOptionDto` add
  `maxPerPage?: number` (`@IsInt @Min(1) @Max(12)`); `ActionOption` and
  `OptionRow` gain `maxPerPage` (map default 6).
- Service validation surface:
  ```ts
  interface LimitViolation {
    optionCode: string;
    scope: 'option' | 'page';
    level?: number;
    limit: number;
    actual: number;
  }
  // AiErrorException(422, 'LIMIT_EXCEEDED', msg, { violations: LimitViolation[] })
  ```
- Read model (additive):
  ```ts
  interface StudentOption { id: string; label: string; icon: string;
    isEnabled: boolean; level: number; sortOrder: number; }
  ```
- Frontend:
  ```ts
  // utils/optionPages.ts
  interface OptionPage { level: number; options: ScanOption[]; }
  function buildOptionPages(options: ScanOption[]): OptionPage[];
  function nextPageIndex(current: number, total: number): number; // wraps
  ```

## File impact
- Backend new: `supabase/migrations/0008_option_pages.sql`; `actions/limits.ts`
  (validation helper) + spec.
- Backend update: `actions/action.repository.ts`, `in-memory-action.repository.ts`
  (+ spec), `supabase-action.repository.ts` (map `max_per_page`, level read,
  create filter), `actions/dto/action.dto.ts`, `actions/actions.service.ts`
  (`saveProfileItems` limit check) + spec, `profiles/profiles.service.ts` /
  `profiles.controller.ts` (unchanged endpoints; adapter richer), Swagger DTOs.
- Frontend new: `utils/optionPages.ts` + test.
- Frontend update: `components/StudentApp.tsx` (page state per wizard step,
  synthetic "More options" target), `components/ScanningGrid.tsx` (unchanged
  contract or accepts one page), `components/StudentEditor.tsx` (counts + server
  errors), `utils/messages.ts`, `test/msw/handlers.ts`, `e2e/helpers/mockBackend.ts`.
- Docs: SPEC-023B status, `plan.md` EPIC 6.4, `MEMORY.md`.

## Acceptance criteria
1. `PUT /profiles/:id/items` rejects (422 `LIMIT_EXCEEDED`) any save exceeding
   `max_enabled` per option or `max_per_page` per level, with structured details.
2. `GET /profiles/:id/options` returns enabled items of every level (not just
   level 1), ordered by `level, sort_order`, including `level`/`sortOrder`.
3. Wizard groups options into pages by level; with more than one page it shows a
   "More options" scan target that advances and wraps; the scan never leaves a
   page and `pointerdown` still wins over scan focus.
4. `StudentEditor` reflects server limits (counts, blocked toggles, i18n errors).
5. In-memory and Supabase adapters return identical student options (parity test).
6. All suites, coverage floor, E2E and CI green.

## Edge cases
Option with zero enabled items; a level with exactly `max_per_page` items (no
"More options" target); `max_enabled` reached across pages; item moved to a full
level; disabled catalog option/action hides its page; teacher lowers
`max_per_page`/`max_enabled` below the profile's current enabled count (read
still works, next save must resolve the violation); stale client double-submit;
legacy items at level > 1 with no level-1 items (page order still deterministic);
`prefers-reduced-motion` (no auto-advance animation changes).

## Out of scope
Book/reader/list pagination, analytics (SPEC-027), dropping legacy tables/columns,
per-profile item labels, image/text option types, multi-tenant limits.

## Verification
Backend `build/lint/test/e2e`; frontend `test/test:coverage/test:e2e/typecheck/
build/check:supabase`; manual: set `max_per_page = 2` on Protagonists, enable 5
items across levels 1–2, confirm the wizard pages correctly and a 6th enable
returns `LIMIT_EXCEEDED`.

## Implementation notes (2026-10-01)
- Backend: migration `0008_option_pages.sql` adds
  `action_options.max_per_page` (default 6, `1..12`); `ActionOption`,
  `Create/UpdateOptionInput` and the DTO gain `maxPerPage`, mapped in both
  repositories. `StudentOption`/`ProfileOption` gain `level`/`sortOrder` and
  `GET /profiles/:id/options` now returns enabled items of **every** level
  ordered by `level, sort_order` (the level-1 filter is gone). New pure helper
  `actions/limits.ts` (`toOptionLimitInfo`, `findProfileItemLimitViolations`,
  `formatLimitViolation`) and `ActionsService.saveProfileItems` enforce
  `max_enabled`/`max_per_page`, throwing `422 LIMIT_EXCEEDED`; `ProfilesService`
  delegates the save to it. In-memory `studentOptionsFor` now requires
  `action.code === 'create'` (Supabase parity). `LIMIT_EXCEEDED` added to the
  error-code union.
- Frontend: `utils/optionPages.ts` (`buildOptionPages`, `nextPageIndex`);
  `StudentApp` groups wizard options by level and appends a synthetic
  "Más opciones" scan target (`wizard.moreOptions`) that advances/wraps pages;
  `ScanOption` carries an optional `level`; `StudentEditor` shows
  `habilitados · por página`, blocks toggles past both caps and renders server
  `LIMIT_EXCEEDED` errors. `backendActions`/`backendProfiles` types and MSW/E2E
  mocks updated.
- Verification: backend build/lint/242 tests/e2e green; frontend
  test (110) + coverage (51.0/49.4/50.0/53.5) + typecheck + build +
  `check:supabase` + E2E (11 passed / 1 skip) green.
- Deviations: `AiErrorException.details` is `string[]`, so limit violations are
  formatted strings (`protagonist (nivel 1): máximo 1, actual 2`) instead of the
  structured object sketched in Contracts. `seedProfileDefaults` still enables
  the whole catalog (a profile may start above the caps if a teacher later
  lowers them); read stays valid and the next save must resolve the violation,
  as stated in Edge cases. `max_per_page` is not enforced when catalog items are
  created/edited, only on per-profile enablement.
