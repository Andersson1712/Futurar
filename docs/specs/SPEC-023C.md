# SPEC-023C — Introductory catalog for new teachers

- Status: **proposed**
- Depends on: SPEC-023 (catalog + seedProfileDefaults), SPEC-023B (levels),
  the 79-item introductory seed (applied 2026-10-03 via service key)
- Follow-ups: none (029B Presentaciones next in roadmap)

## Objective

Every new teacher starts with the same introductory catalog (3 actions,
4 story options, 79 items across levels) the first time they create a
profile, and can then grow or prune it freely. Stored catalog vs
on-screen quota follow the owner's rule: all 79 items are stored, but
each profile shows at most `max_enabled` per option (`max_per_page` per
level); adding one more requires disabling another or raising the quota.
No migration, no contract change.

## Why

The catalog is per-teacher, but nothing seeds it for teachers created
after migration 0007 ran: `seedProfileDefaults` only seeds
per-profile enablement over an existing catalog, so a new teacher's
wizard renders empty. The introductory seed must live in code, next to
the model it fills, or it rots on every greenfield signup.

## Design

- New `backend/src/actions/intro-catalog.seed.ts`: pure data module with
  the exact introductory content (3 actions, 4 options, 79 items with
  level/icon/sortOrder) currently in `/tmp/opencode/seed-catalog.js`,
  moved into the repo with a source-of-truth comment. Single place to
  evolve the intro set.
- New `ensureTeacherCatalog(teacherId)` on the action repository port
  (Supabase + in-memory implementations for parity): if the teacher has
  zero actions, insert the intro set (actions → options → items),
  idempotent per teacher (unique constraints + label-existence checks,
  same guards as the one-off script). If actions already exist, it is a
  no-op — existing teachers are never touched.
- Called at the top of `seedProfileDefaults(profileId, teacherId)`
  (both repository implementations' callers funnel through the service,
  so one call site covers Supabase and in-memory paths): first profile
  creation seeds the catalog, second profile finds actions present and
  skips.
- Quota seeding: after ensuring the catalog, write explicit
  `profile_option_items` rows so each new profile starts with exactly
  `max_enabled` items enabled per option (first by `level`, then
  `sort_order`) and the rest disabled. New items rely on no implicit
  state; the wizard and the editor then agree from day one.
- Teacher-facing quota editor: the Elementos tab shows the quota but
  cannot change it, so add a minimal `maxEnabled`/`maxPerPage` editor
  per option (new `updateOption` call in `services/backendActions.ts`
  hitting the existing `PATCH options/:id`, validated server-side).
- One-off repair (parent-run service-key script, not shipped code): the
  already-seeded teacher gets the same explicit disabled rows for the
  excess over each option quota, un-bricking the editor.
- A teacher with zero profiles still has an empty catalog until the
  first profile is created — accepted: every teacher flow starts with
  profile creation, and there is no earlier backend-known teacher event
  (the teacher row is created by the frontend on signup).
- Out: new endpoints, DTOs, migrations, RLS changes, backfill of
  `profile_option_items` (new items are auto-enabled by
  `getStudentOptions`, verified).

## Acceptance criteria

- [ ] New teacher (no actions) + first profile → 3 actions, 4 options,
  79 items (RED: empty catalog; GREEN after hook), with exactly
  `max_enabled` enabled per option and the rest explicitly disabled.
- [ ] Second profile for the same teacher → zero new rows (idempotent).
- [ ] Existing teacher with catalog → hook is a no-op (row counts unchanged).
- [ ] Quota editor: teacher raises `maxEnabled` on an option and can then
  enable up to the new quota; lowering it blocks over-quota enables.
- [ ] `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint`
  (backend) + `typecheck`, `check:supabase`, `npm test` (frontend) green.

## Edge cases

- Concurrent first-profile creations: unique constraints
  (`teacher_id,code` / `action_id,code`) plus label-existence checks make
  double-seed collapse to a no-op instead of duplicates.
- Partial catalog (actions exist, items missing — e.g. legacy teachers):
  hook skips (actions present); the one-off script remains the repair path.
- `level`/`sortOrder`/`icon` values are data, validated by the same unit
  tests that pin the intro set (snapshot-style assertions on counts).

## File impact

- New: `backend/src/actions/intro-catalog.seed.ts`,
  `intro-catalog.seed.spec.ts` (counts + spot labels per option/level).
- Touched: `action.repository.ts` (port method), `supabase-` +
  `in-memory-action.repository.ts` (implementations),
  `profiles.service.ts` or repository `seedProfileDefaults` call site (one
  line), `odd/tasks/spec-023c.md`.
- Out: controllers, DTOs, migrations, frontend.

## Contracts

No HTTP contract change. `GET /profiles/:id/options` for a new teacher's
first profile returns the full introductory set.

## Verification

```bash
npm test
npm run test:e2e
npm run build
npm run lint
```

## Versions

Same pins as SPEC-028/029 (`backend/package.json`): Nest 12.x, TS
`^6.0.3`, Jest `^30.0.0` (`NODE_OPTIONS=--experimental-vm-modules`),
Node `>=20.19.0`.
