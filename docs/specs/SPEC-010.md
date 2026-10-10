# SPEC-010 — Session plumbing and Supabase data-access audit

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D5 as recommended)
- Phase: 3 / EPIC 3.2
- Depends on: SPEC-009 (API client + generation flow)
- Blocks: SPEC-017/018 (frontend tests), SPEC-021/023 (profiles/options API)

## Implementation notes
- `apiFetch` attaches a fresh Supabase token, retries once after
  `refreshSession()` on 401 and surfaces `ApiError`/`NetworkError`.
- `logout()` signs out, clears `futurar_story_config` and auth state;
  `StudentContext` subscribes to `SIGNED_OUT` and resets student/library state.
- Dead `ai_config` helpers removed from `services/supabase.ts` (provider keys
  left the frontend in SPEC-001).
- `npm run check:supabase` fails on new direct `{ supabase }` imports in
  `components/`, `contexts/`, `hooks/`; the current direct importers are
  allowlisted and documented here. Final audit table is the one in this spec
  (students/options → SPEC-021/023, `usage_sessions` → SPEC-027, `teachers`
  exception → SPEC-021, legacy `stories` read-only → SPEC-010 follow-up).
- Verification: `npm run typecheck`, `npm run check:supabase`, `npm run build`
  all green; login/logout manual flow unchanged.

## Objective
Make the frontend use Supabase **only for Auth**: every backend request carries
a fresh JWT, sessions refresh transparently, logout clears local state, and all
remaining direct Supabase **data** access is audited and either centralized or
explicitly deferred to the specs that own the missing backend endpoints
(profiles/options). No new direct data access is allowed.

## Decisions to confirm
- **D1 Centralize access (recommended)**: all remaining Supabase data calls
  live in `services/supabase.ts`; components may not import `supabase`
  directly. Enforced with a small `npm run check:supabase` grep script (CI will
  call it in SPEC-019). Alternative: no automated check.
- **D2 Teacher profile (recommended)**: keep reading the `teachers` table
  until SPEC-021 delivers the backend profiles API (documented exception).
  Alternative: rely only on Supabase Auth user metadata now (loses the
  teacher name/role stored today).
- **D3 Dead AI config code (recommended)**: remove the `ai_config` helpers from
  `services/supabase.ts` (frontend no longer uses provider keys since
  SPEC-001) and keep `usage_sessions` analytics until SPEC-027.
- **D4 JWT refresh (recommended)**: `apiFetch` gets the current access token,
  retries once after `supabase.auth.refreshSession()` on 401, and surfaces a
  clear error if refresh fails.
- **D5 Logout (recommended)**: `logout()` signs out, resets auth/student
  contexts and clears app localStorage keys (`futurar_story_config` and scan
  settings), leaving no residual state.

## Audit (current direct data access, to document in the spec result)
| Area | Tables | Status after SPEC-010 |
|---|---|---|
| Library legacy | `stories` | read-only, migrated by SPEC-010 follow-up/021 |
| Students/options | `students`, `student_settings`, `student_*` | deferred to SPEC-021/023 |
| Analytics | `usage_sessions` | deferred to SPEC-027 |
| Teacher | `teachers` | D2 exception |
| AI config | `ai_config` | removed (D3) |
| Auth | Supabase Auth | allowed (login/refresh only) |

## File impact
- Frontend update: `services/supabase.ts` (remove `ai_config` helpers, keep the
  data API centralized), `services/backendApi.ts` (refresh + retry),
  `contexts/AuthContext.tsx` (logout clears local state),
  `contexts/StudentContext.tsx` (reset on logout), `package.json`
  (`check:supabase` script), `docs/` note with the final audit table.

## Acceptance criteria
1. Every backend request sends `Authorization: Bearer <fresh token>`; a 401
   triggers one refresh+retry and then a clear error.
2. Logout signs out and clears auth/student state plus app localStorage keys;
   no stale data remains after switching users.
3. `services/supabase.ts` has no `ai_config` helpers; no component imports
   `supabase` directly (`npm run check:supabase` passes with the known
   exceptions listed in the script).
4. The audit table is recorded in the spec/docs with the owning follow-up spec
   for each remaining access.
5. `npm run build` and `npm run typecheck` pass; no behavior change in login.

## Edge cases
Expired refresh token (force re-login); network failure during refresh;
concurrent requests on 401 (single refresh); unknown token in localStorage;
legacy sessions without metadata.

## Out of scope
Migrating students/options/analytics data (SPEC-021/023/027), backend `/me`
endpoint, CI wiring (SPEC-019), test runner (SPEC-017).

## Verification
Frontend `npm run build`, `npm run typecheck`, `npm run check:supabase`;
manual login → generate → logout → login as another user.
