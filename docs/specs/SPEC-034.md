# SPEC-034 — Teacher identity ownership moves to the backend

- **Status**: accepted (2026-10-11). RLS scope revised by owner decision — see D4.
- **Phase**: Fase 9 — Post-MVP (architecture debt; closes the SPEC-010 D2 exception)
- **Depends on**: SPEC-010 (session and data access audit), SPEC-021 (backend data ownership)
- **Blocks**: nothing

## Objective

Remove every `public.teachers` access from the frontend and make the database the sole
owner of the teacher identity row. Row level security is explicitly out of scope; see D4.

## Why

`AGENTS.md` requires that "the frontend stores no secrets and never calls Supabase for
data. Backend is the only data owner; the frontend uses Supabase Auth for login/refresh
only."

`contexts/AuthContext.tsx` breaks that rule in four places — three reads and one INSERT.
The exception was deliberate, and `backend/supabase/migrations/0000_bootstrap.sql`
records it in writing:

| Line | Text |
|------|------|
| 14-15 | "The frontend (anon key) still reads/writes teachers, stories and usage_sessions directly, so those tables keep RLS DISABLED." |
| 21 | "Teachers (row created by the frontend on signup; id = auth.users.id)" |
| 144 | `alter table public.teachers disable row level security;` |

`docs/specs/SPEC-010.md` justified the exception as a stopgap until the backend served
this data (D2, audit row "teachers | D2 exception") and explicitly left a `/me` endpoint
out of scope. SPEC-021 delivered student profiles, not teacher identity, so the
exception outlived its trigger.

The row is inert: no migration declares a foreign key to `public.teachers`, and neither
the backend nor any frontend consumer queries it.

## Current behavior (audit)

| Location | Operation | Detail |
|----------|-----------|--------|
| `contexts/AuthContext.tsx:44-48` | read | `checkSession` → `select('*').eq('id', session.user.id).single()` |
| `contexts/AuthContext.tsx:64-68` | read | `onAuthStateChange` (`SIGNED_IN`) → same query |
| `contexts/AuthContext.tsx:99-103` | read | `login` → same query |
| `contexts/AuthContext.tsx:136-143` | **write** | `register` → `insert({ id, email, name, role: 'teacher' })` |

All three reads discard the error object, so a failed read silently yields
`teacher = null` and therefore `isAuthenticated = false` (`contexts/AuthContext.tsx:177`).

Consumers of the auth context, from a grep over `components/`, `hooks/` and `App.tsx`:

- `components/TeacherPanel.tsx:11,33` — reads only `isAuthenticated` and `isLoading`.
- `components/LoginForm.tsx:2,10` — reads only `login`, `register`, `error`, `isLoading`.
- `App.tsx:4,10,17` — mounts `AuthProvider`.
- `components/a11y.test.tsx:32-39` — mocks those four members only.

**No consumer reads any field of the `teacher` object.** Its only reader is the context
itself, at line 177 (`!!teacher`).

Stale surface found alongside the violation:

- `scripts/check-supabase-imports.mjs:9-14` allowlists four files, but only
  `contexts/AuthContext.tsx` still imports the client in production code.
  `components/StoryDetails.tsx`, `components/StoryReader.tsx` and
  `components/StudentLibrary.tsx` are stale entries.
- `services/supabase.ts` exports 11 named data helpers plus a default export; all are
  dead. Only the `supabase` client itself is still imported, by
  `contexts/AuthContext.tsx:2` and by `services/backendApi.ts` for token refresh.
- `DEFAULT_TEACHER_ID` (`components/TeacherPanel.tsx:21`) is passed as `teacherId` to
  `GlobalConfigModal` (`components/TeacherPanel.tsx:366`), which accepts the prop
  (`components/GlobalConfigModal.tsx:12`) and never uses it.

## Decisions

**D1 (accepted) — `isAuthenticated` derives from the Supabase session.** Replace
`!!teacher` with session presence. `getSession` and `onAuthStateChange` are auth-only and
remain allowed, so this deletes all three reads without new backend surface.
Alternative: keep a `teacher`-backed flag, which preserves the coupling for no
user-visible benefit.

**D2 (accepted) — the database creates the teacher row, through a `security definer`
trigger on `auth.users`.** Migration `0015` adds the trigger and backfills rows for
existing `auth.users`. Rejected alternatives: a backend `GET /api/v1/me` endpoint (new
HTTP surface plus a frontend round trip to return data no client reads today), and
keeping the frontend INSERT (already broken when email confirmation is enabled — see
Edge cases).

**D3 (accepted) — drop `teacher` from the auth context.** `AuthContextType.teacher` and
the `Teacher` import go away; the provider exposes `isAuthenticated`, `isLoading`,
`error`, `login`, `register` and `logout`. No consumer changes. Alternative: keep the
field, which requires a backend fetch to fill it.

**D4 (owner decision, 2026-10-11) — row level security stays disabled on
`public.teachers`, `stories` and `usage_sessions`.** The owner's model is that the tenant
is the foundation, teachers sign in through Supabase Auth, and every authenticated
foundation is allowed to see every teacher, so there is no per-row scoping to express.
`0000_bootstrap.sql:144-146` already records that posture, and this spec does not change
it.

Recorded for future readers, not as a blocker: "RLS disabled" is broader than
"authenticated only". PostgREST serves these tables to the `anon` role too, so the same
read and write access an authenticated foundation has is also reachable with the public
anon key and no session. The owner's model expressed exactly would be two statements —
`enable row level security` plus `create policy ... for all to authenticated using (true)
with check (true)` — which the owner has seen and deferred. Revisit in its own spec if
the exposure ever needs closing; it is independent of everything below.

**D5 (accepted) — stop the guard from being a blanket exemption.** Reduce `ALLOWED` in
`scripts/check-supabase-imports.mjs` to `contexts/AuthContext.tsx`, and add a rule that
fails when a scanned file contains `\.from\(\s*['"]` or `\.rpc\(`. Auth calls
(`supabase.auth.*`) stay legal. The quote after the parenthesis matters: `Array.from(`
appears in production code at `components/FloatingControls.tsx:47` and
`hooks/useDialogA11y.ts:28` and must not trip the check.

**D6 (accepted) — delete the dead `services/supabase.ts` helpers.** All 11 named exports
and the default export are unused; only the `supabase` client survives. Deleting them
shrinks the surface the rule is meant to protect. `DEFAULT_TEACHER_ID` and
`GlobalConfigModal.teacherId` are the same class of dead code and are left as follow-up
to keep this change reviewable.

## Contract

### Migration `backend/supabase/migrations/0015_teacher_identity.sql`

- `create or replace function public.handle_new_teacher()` returning trigger, language
  plpgsql, `security definer`, `set search_path = public`, inserting
  `(id, email, name, role)` from `new.id`, `new.email`,
  `coalesce(new.raw_user_meta_data->>'name', new.email)` and `'teacher'`, with
  `on conflict (id) do update set email = excluded.email, updated_at = now()`.
- `drop trigger if exists on_auth_user_created on auth.users;` followed by
  `create trigger on_auth_user_created after insert on auth.users for each row execute
  function public.handle_new_teacher();`
- Backfill for users created before the trigger: `insert into public.teachers
  (id, email, name, role) select id, email,
  coalesce(raw_user_meta_data->>'name', email), 'teacher' from auth.users
  on conflict (id) do nothing;`
- No RLS statement (D4).
- Re-runnable, like every other migration in this repo (cf. #48).

### Frontend `contexts/AuthContext.tsx`

- Keeps `supabase.auth.getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`
  and `signOut`.
- `register` calls
  `supabase.auth.signUp({ email, password, options: { data: { name } } })` so the
  trigger can read the display name from `raw_user_meta_data`.
- `isAuthenticated` reflects the session; `teacher` and the `Teacher` import are removed.
- No `supabase.from(...)` call remains.

### Frontend `scripts/check-supabase-imports.mjs`

- `ALLOWED` becomes `['contexts/AuthContext.tsx']`.
- New failing patterns inside scanned files: `\.from\(\s*['"]` and `\.rpc\(`.
- Same exit code (1) and message style as today.

### Frontend `services/supabase.ts`

- Keep the `supabase` client export. Remove the 11 dead data helpers and the default
  export.

## File impact

New:

- `backend/supabase/migrations/0015_teacher_identity.sql`
- `contexts/AuthContext.test.tsx`

Touched:

- `contexts/AuthContext.tsx`
- `scripts/check-supabase-imports.mjs`
- `services/supabase.ts`
- `components/a11y.test.tsx` (its Supabase mock no longer needs the data chain)
- `docs/specs/SPEC-010.md` (mark the D2 exception as closed)
- `MEMORY.md`, `plan.md`

Out of scope, tracked but not changed here: row level security on `teachers`, `stories`
and `usage_sessions` (D4), `DEFAULT_TEACHER_ID` and `GlobalConfigModal.teacherId`, the
pending Vite 6→8 and frontend TypeScript 5.8→6/7 chore, and the stale `Status:` headers
in `docs/specs/SPEC-023C.md`, `SPEC-024.md`, `SPEC-033B.md` and `SPEC-033D.md`.

## Acceptance criteria

- [ ] `grep -rn "\.from('teachers')" contexts components hooks` returns nothing.
- [ ] `contexts/AuthContext.tsx` imports `supabase` only for `supabase.auth.*`.
- [ ] `npm run check:supabase` passes with the reduced allowlist and the new rules.
- [ ] `npm run check:supabase` fails on a deliberate `supabase.from('teachers')` probe.
- [ ] `npm run typecheck` passes.
- [ ] `AuthProvider` no longer exposes `teacher` and no consumer breaks.
- [ ] `register` creates exactly one `teachers` row per new user, with email
      confirmation both disabled and enabled.
- [ ] Migration `0015` re-runs without error and without duplicating the trigger.
- [ ] Backend suite green: `$env:NODE_OPTIONS='--experimental-vm-modules'; npx jest`.

## Edge cases

1. **Email confirmation enabled.** `supabase.auth.signUp` returns
   `{ user, session: null }` when confirmations are on, so today's frontend INSERT runs
   with no session and only survives because RLS is disabled. After D2 the trigger owns
   creation, so the flow works either way and `isAuthenticated` correctly stays false
   until a session exists.
2. **Existing users.** The backfill covers `auth.users` rows created before the trigger;
   `on conflict do nothing` leaves current rows untouched.
3. **Missing `name` in metadata.** Users created outside the UI — dashboard, invite,
   another client — fall back to `email`.
4. **Duplicate trigger.** `create or replace function` plus `drop trigger if exists`
   keeps the migration idempotent.
5. **`Array.from(` false positives.** The banned pattern requires a quote after the
   parenthesis; production code always passes an identifier or a newline.
6. **Session expiry or sign-out.** `onAuthStateChange` with `SIGNED_OUT` clears the
   session state, so `isAuthenticated` flips to false without any data call.
7. **A teacher row deleted out of band.** The trigger only fires on `auth.users` insert,
   so the row returns on the next backfill run, not automatically.

## Verification

```bash
npm run check:supabase
npm run typecheck
npm test
npm run test:coverage
```

```powershell
cd backend
$env:NODE_OPTIONS='--experimental-vm-modules'; npx jest
npx jest --config ./test/jest-e2e.json --runInBand
```

Manual:

- Apply `0015` in the Supabase SQL editor, then re-run it to confirm idempotency.
- Sign up a new teacher and confirm exactly one `teachers` row appears.

## Versions

No new dependency. Installed and unchanged by this spec: `@supabase/supabase-js` 2.93.3,
`react`/`react-dom` 19.3.0, `vite` 6.4.1, `typescript` 5.8.3, `vitest` 5.0.3, NestJS 12
on the backend. The Supabase Auth behavior cited above was validated against the
`@supabase/supabase-js` source through the Context7 MCP server (`/supabase/supabase-js`).
The pending Vite 6→8 and frontend TypeScript 5.8→6/7 upgrade stays a separate chore and
is deliberately not folded in: it is unrelated to data ownership and would enlarge the
review for no benefit.
