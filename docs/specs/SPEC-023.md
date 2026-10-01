# SPEC-023 — Dynamic actions and options: catalog, CRUD and per-profile permissions

- Status: **implemented** (2026-10-01; pending owner: apply migration 0007)
- Phase: 6 / EPIC 6.4
- Depends on: SPEC-021 (profiles), SPEC-022 (contacts)
- Blocks: SPEC-023B (limits/pagination), SPEC-027 (analytics), SPEC-010 audit closure

## Objective
Replace the four hardcoded Supabase option tables (`student_protagonists`,
`student_scenarios`, `student_missions`, `student_styles`) with a generic
catalog — **Acción → Opción → Ítem (nivel/tipo)** — owned by the backend, with
CRUD from the teacher panel and per-profile enablement. This is the last big
block of direct Supabase writes in the teacher flow.

## Current state
- Four per-profile tables with `label`, `icon`, `is_enabled`; rows are
  duplicated for every student (no catalog).
- `StudentEditor` reads/writes them directly with Supabase; `TeacherPanel`
  seeds four defaults per new student; `StudentApp` reads them through
  `GET /profiles/:id/options` (SPEC-021 adapter).
- `ProfileModules` (`create`/`library`/`design`) already models the action
  level per profile (`student_settings.modules`, SPEC-021).
- Wizard shows every enabled item in one scan grid; `StudentEditor` caps
  enabled items at 4 per category (client-side only).

## Decisions to confirm
- **D1 Model (recommended)**: generic catalog with teacher scope:
  - `actions`: `code` (`create|library|design`), `label`, `icon`, `sort_order`,
    `is_active`, `teacher_id`.
  - `action_options` (Opción): `action_id`, `code` (`protagonist|scenario|
    mission|style`), `label`, `icon`, `option_type` (Tipo: `list` today,
    future `image|text`), `max_enabled`, `sort_order`, `is_active`.
  - `action_option_items` (Ítem + Nivel): `option_id`, `label`, `icon`,
    `level` (int, default 1), `sort_order`, `is_active`.
  Alternative: add `level`/`type`/limits columns to the existing four tables
  (smaller, but keeps the model hardcoded and blocks custom actions).
- **D2 Permissions per profile (recommended)**: `profile_actions`
  (`profile_id`, `action_id`, `is_enabled`, unique pair) and
  `profile_option_items` (`profile_id`, `item_id`, `is_enabled`, `sort_order`
  override). Profiles without rows inherit the catalog defaults. Alternative:
  keep per-profile copies of items (current behavior) — no real catalog.
- **D3 Backfill (recommended)**: migration `0007` seeds `actions`/`action_options`
  and backfills items **deduped per teacher** (`label` + category) from the four
  legacy tables, then creates `profile_option_items` rows enabling each profile's
  items. Legacy tables stay read-only for rollback (dropped in a cleanup spec).
  Alternative: start empty and re-enter data by hand.
- **D4 API (recommended)**:
  - Catalog CRUD (teacher-scoped): `GET/POST /api/v1/actions`,
    `GET/PATCH/DELETE /api/v1/actions/:id`, `GET/POST /api/v1/actions/:id/options`,
    `PATCH/DELETE /api/v1/options/:id`, `POST /api/v1/options/:id/items`,
    `PATCH/DELETE /api/v1/items/:id`.
  - Per-profile: `GET/PUT /api/v1/profiles/:id/actions` (enable/disable),
    `GET/PUT /api/v1/profiles/:id/items` (enable/reorder).
  - `GET /api/v1/profiles/:id/options` keeps its **current response shape** as
    an adapter over the new model, so `StudentApp` changes minimally.
  - Profile creation seeds `profile_actions` from the catalog (removes
    `TeacherPanel.seedDefaultElements`).
- **D5 Modules compatibility (recommended)**: `student_settings.modules` keeps
  mirroring `profile_actions` during the transition (single source = backend);
  `ProfilesService` updates both. Dropping the column is a cleanup spec.
- **D6 Scope (recommended)**: this spec delivers model + CRUD + permissions.
  **Limits per screen/action/page** (`max_enabled` enforcement server-side and
  scan pagination in the wizard) move to **SPEC-023B**. Alternative: include
  them here (bigger, riskier PR).
- **D7 Supabase allowlist (recommended)**: `StudentEditor` and `TeacherPanel`
  drop their Supabase imports; `check:supabase` shrinks to Auth, legacy
  `stories`/`usage_sessions` reads.

## Contracts
```ts
interface ActionRepository {
  listActions(teacherId: string): Promise<Action[]>;
  createAction(teacherId: string, input: ActionInput): Promise<Action>;
  updateAction(actionId: string, teacherId: string, patch: ActionPatch): Promise<Action | undefined>;
  deleteAction(actionId: string, teacherId: string): Promise<boolean>; // soft: is_active=false
  listOptions(actionId: string, teacherId: string): Promise<ActionOption[]>;
  createOption(actionId: string, teacherId: string, input: OptionInput): Promise<ActionOption>;
  updateOption(optionId: string, teacherId: string, patch: OptionPatch): Promise<ActionOption | undefined>;
  deleteOption(optionId: string, teacherId: string): Promise<boolean>;
  createItem(optionId: string, teacherId: string, input: ItemInput): Promise<ActionOptionItem>;
  updateItem(itemId: string, teacherId: string, patch: ItemPatch): Promise<ActionOptionItem | undefined>;
  deleteItem(itemId: string, teacherId: string): Promise<boolean>;
  getProfileActions(profileId: string): Promise<ProfileAction[]>;
  saveProfileActions(profileId: string, actions: ProfileActionInput[]): Promise<ProfileAction[]>;
  getProfileItems(profileId: string): Promise<ProfileItem[]>;
  saveProfileItems(profileId: string, items: ProfileItemInput[]): Promise<ProfileItem[]>;
  getStudentOptions(profileId: string): Promise<ProfileOptions>; // adapter
}
```
- All endpoints require auth and scope by the JWT teacher; foreign rows 404.
- DTOs validate `code` (slug, 1..40), `label` (1..80), `icon` (1..40),
  `level` (1..5), `sortOrder` (0..999), `maxEnabled` (1..12), unknown keys
  rejected by the global pipe.
- `GET /profiles/:id/options` returns items with `level === 1` enabled for the
  profile (current behavior), preserving `{protagonists, scenarios, missions,
  styles}`.

## File impact
- Backend new: `supabase/migrations/0007_actions.sql` (schema + seed + backfill);
  `src/actions/{actions.module.ts, actions.controller.ts, actions.service.ts,
  action.repository.ts, in-memory-action.repository.ts,
  supabase-action.repository.ts, dto/*}` + specs.
- Backend update: `app.module.ts`, `profiles.module.ts` (inject actions for the
  options adapter + profile seeding), `profiles.service.ts` (create seeds
  `profile_actions`, `modules` mirror), `profiles.controller.ts` (adapter
  unchanged shape) + specs.
- Frontend new: `services/backendActions.ts` + test.
- Frontend update: `StudentEditor.tsx` (elements tab → catalog CRUD + per-profile
  enable/reorder), `TeacherPanel.tsx` (drop `seedDefaultElements`), `StudentApp.tsx`
  (unchanged endpoint, level-1 items), `utils/messages.ts`, `test/msw/handlers.ts`,
  `e2e/helpers/mockBackend.ts`, `scripts/check-supabase-imports.mjs` (allowlist
  shrinks to `StoryDetails`, `StoryReader`, `StudentLibrary`, `AuthContext`).
- Docs: SPEC-023 status, `plan.md` EPIC 6.4 (A/B), `MEMORY.md`.

## Acceptance criteria
1. Teacher can CRUD actions, options and items; soft delete hides them; foreign
   teachers get 404.
2. Per-profile enablement persists and `GET /profiles/:id/options` returns only
   enabled level-1 items in the current shape.
3. New profiles get default `profile_actions`/items from the catalog without
   client-side seeding; `modules` stays in sync.
4. Migration backfills every existing profile's items deduped per teacher,
   idempotently (re-running is safe).
5. `StudentEditor`/`TeacherPanel` no longer import Supabase; the allowlist is
   reduced accordingly.
6. All suites, coverage floor, E2E and CI green.

## Edge cases
Profile with no catalog items; legacy profile created after migration (seeded on
create); duplicate `code` per teacher (409); deleting an option with items;
deleting an item enabled for profiles (cascade of `profile_option_items`); level
> 1 items (hidden until SPEC-023B); teacher with several profiles sharing labels;
legacy rows with `is_enabled = false` (backfill as disabled).

## Out of scope
Limits/pagination enforcement (SPEC-023B), dropping legacy tables/columns,
custom per-profile item labels, image options, analytics (SPEC-027).

## Verification
Backend `build/lint/test/e2e`; frontend `test/test:coverage/test:e2e/typecheck/
build/check:supabase`; manual: create an action/option/item, enable it for one
profile, verify the wizard shows it and another profile does not.

## Phasing note
`max_enabled` server enforcement, `max_per_page` and wizard scan pagination are
planned as **SPEC-023B** right after this spec closes.

## Implementation notes (2026-10-01)
- Backend: migration `0007` creates `actions`/`action_options`/
  `action_option_items`/`profile_actions`/`profile_option_items`, seeds the three
  actions and four options per teacher and backfills deduped items + per-profile
  enablement idempotently; `ActionsModule` (in-memory + Supabase repos) with
  teacher-scoped catalog CRUD; `ProfilesModule` imports it for the
  `GET /profiles/:id/options` adapter, default seeding on create, `modules`
  mirror and the new `GET/PUT /profiles/:id/actions|items` endpoints. Legacy
  `student_*` tables are read-only. 234 tests / 47 suites.
- Frontend: `services/backendActions.ts`; `StudentEditor` elements tab now reads
  the catalog and saves per-profile item enablement; `TeacherPanel` no longer
  seeds defaults (backend does); `check:supabase` allowlist shrunk to
  `StoryDetails`, `StoryReader`, `StudentLibrary`, `AuthContext`. 106 tests /
  23 files; coverage 50.5/49.4/49.5/53.0; E2E 11 passed / 1 skip.
- Deviations: `max_enabled` stays client-side until SPEC-023B; catalog labels
  are shared per teacher (no per-profile overrides yet); items level > 1 are
  stored but hidden from the wizard until SPEC-023B.
