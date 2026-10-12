# SPEC-021 — Profiles API: CRUD, modules, technical config and book complexity

- Status: **implemented** (2026-10-01; migration 0005 applied, verified 2026-10-03)
- Phase: 6 / EPIC 6.2
- Depends on: SPEC-015 (settings), SPEC-020 (credentials), SPEC-010 (audit)
- Blocks: SPEC-023 (options CRUD), SPEC-027 (analytics), SPEC-010 audit closure

## Objective
Make the backend the owner of student profiles: CRUD, per-profile modules,
technical/accessibility settings and book complexity, with the frontend reading
and writing them only through the backend. This removes most of the remaining
direct Supabase data access from the student flow and the teacher panel.

## Current state
- Frontend touches `students` (9), `student_settings` (5), `student_*` options
  (12), `stories` (8), `usage_sessions` (3) and `teachers` (4) directly.
- `StudentContext`/`StudentProvider` is dead code (no consumers).
- `student_settings` already holds the accessibility columns (0003);
  `books.profile_id` and the generation request already carry `profileId`.

## Decisions to confirm
- **D1 Tables (recommended)**: extend the existing `students`/`student_settings`
  via migration `0005_profiles.sql` — `birthdate date`, `modules jsonb`
  (`{create, library, design}`), `book_story_size`, `book_audience` — instead of
  new tables plus backfill. Alternative: create `profiles`/`profile_settings`
  and migrate data now.
- **D2 Backend module (recommended)**: `ProfilesModule` with Supabase + in-memory
  repositories and endpoints:
  - `GET /api/v1/profiles?active=true|false`
  - `GET /api/v1/profiles/:id`
  - `POST /api/v1/profiles`
  - `PATCH /api/v1/profiles/:id`
  - `DELETE /api/v1/profiles/:id` (soft delete: `is_active=false`)
  - `PUT /api/v1/profiles/:id/settings`
  - `GET /api/v1/profiles/:id/options` (read-only: protagonists/scenarios/
    missions/styles)
  Options **writes** stay in SPEC-023.
- **D3 Frontend migration (recommended)**: `StudentApp`, `TeacherPanel`,
  `StudentEditor` and `SettingsPanel` move to `services/backendProfiles.ts`;
  `check:supabase` shrinks to Auth, legacy `stories` reads and
  `usage_sessions`; `StudentContext` is deleted. Alternative: keep mixed access.
- **D4 Book complexity (recommended)**: `storySize` and `audience` become
  optional in the generation request; the runner fills missing values from the
  profile's `book_story_size`/`book_audience` (fallback `medium`/`child`), so
  teacher-set complexity actually drives generation.
- **D5 Birthdate (recommended)**: add optional `birthdate`; the legacy `age`
  column stays for compatibility until the editor UI is fully migrated.

## Contracts
```ts
interface ProfileRepository {
  list(teacherId: string, activeOnly: boolean): Promise<Profile[]>;
  findById(profileId: string, teacherId: string): Promise<Profile | undefined>;
  create(input: CreateProfileInput): Promise<Profile>;
  update(profileId: string, teacherId: string, patch: UpdateProfileInput): Promise<Profile | undefined>;
  deactivate(profileId: string, teacherId: string): Promise<boolean>;
  getSettings(profileId: string): Promise<ProfileSettings | undefined>;
  saveSettings(profileId: string, settings: ProfileSettingsInput): Promise<ProfileSettings>;
  listOptions(profileId: string): Promise<ProfileOptions>;
}
```
- All endpoints require Supabase auth and scope by `teacherId` (JWT `sub`).
- Settings DTO validates the accessibility fields (0003), `modules` booleans and
  book complexity enums; unknown keys are rejected by the global pipe.
- Responses never include credentials; profile ids are the ones already stored
  in `books.profile_id`.
- The generation DTO keeps accepting `storySize`/`audience` (now optional) for
  backward compatibility.

## File impact
- Backend new: `src/profiles/{profiles.module.ts, profiles.controller.ts,
  profiles.service.ts, profile.repository.ts, supabase-profile.repository.ts,
  in-memory-profile.repository.ts, dto/*}` + specs,
  `supabase/migrations/0005_profiles.sql`; update `app.module.ts`,
  `ai.module.ts` (profile settings provider), `generation-runner.ts`,
  `generate-book-request.dto.ts`.
- Frontend new: `services/backendProfiles.ts` + test; update `StudentApp.tsx`,
  `TeacherPanel.tsx`, `StudentEditor.tsx`, `SettingsPanel.tsx`,
  `StudentLibrary.tsx` (profileId already used), `check-supabase` allowlist,
  i18n keys, delete `contexts/StudentContext.tsx`.
- Tests: backend repository/service/controller/settings validation/options and
  generation defaults; frontend services with MSW plus updated component tests.

## Acceptance criteria
1. Profiles CRUD works scoped by teacher; soft delete hides from active lists;
   foreign profiles are 404.
2. Settings round-trip with validation (accessibility + modules + book
   complexity) and defaults for new profiles.
3. `GET /profiles/:id/options` returns the four enabled option lists.
4. Generation without `storySize`/`audience` uses the profile settings;
   explicit values still win.
5. Frontend uses `backendProfiles` for profiles/settings/options; direct
   Supabase remains only for Auth, legacy `stories` reads and `usage_sessions`
   (documented in the SPEC-010 audit table); dead `StudentContext` removed.
6. All suites, coverage floor, E2E and CI green.

## Edge cases
Profiles without settings row; inactive profile selected; legacy `age` rows;
invalid module keys; settings with unknown fields; teacher switching; profile
deletion with existing books (books keep `profile_id`).

## Out of scope
Options CRUD (SPEC-023), dedications/contacts (SPEC-022), analytics
(SPEC-027), organizations/multi-foundation, data migration to new table names.

## Verification
Backend `build/lint/test/e2e`; frontend `test/test:coverage/test:e2e/typecheck/
build/check:supabase`; manual: create/edit/deactivate a profile, toggle modules,
set complexity and generate.

## Implementation notes (2026-10-01)
- Backend: `ProfilesModule` (Supabase + in-memory repos), `PROFILE_SETTINGS_PROVIDER`
  wired into `generation-runner`; `storySize`/`audience` optional with profile
  defaults (fallback `medium`/`child`). In-memory `update` strips `undefined`
  (TS6 `useDefineForClassFields` made `Object.assign` wipe `isActive`).
- Frontend: `services/backendProfiles.ts` (camel↔snake mappers); `StudentApp`,
  `TeacherPanel`, `SettingsPanel` and `StudentEditor` migrated; `TeacherPanel`
  now requires login (`LoginForm` + `useAuth`); `StudentContext` deleted;
  `check:supabase` allowlist keeps `StudentEditor`/`TeacherPanel` (options
  writes, SPEC-023) plus legacy `stories`/`usage_sessions` readers.
- Deviation: no separate `apellido` field — single `name` kept (editor and DB
  already used `name`); revisitable in a follow-up.
- Verified: backend build/lint + 204 tests; frontend 88 tests, coverage
  41.5/38.14/37.33/43.36, typecheck/build/check:supabase; E2E 11 passed / 1 skip.
