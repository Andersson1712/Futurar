# SPEC-023C — Introductory catalog for new teachers

## Objective
New teachers start with the 79-item introductory catalog on first profile
creation, then grow/prune freely. No migration, no contract change.

## Why
`seedProfileDefaults` only seeds per-profile enablement over an existing
catalog; post-0007 teachers get an empty wizard. The intro set must live
in code next to the model.

## Scope
- New `backend/src/actions/intro-catalog.seed.ts` (+spec pinning counts).
- `ensureTeacherCatalog(teacherId)` on the repository port (Supabase +
  in-memory), called from `seedProfileDefaults`; no-op when actions exist.
- Out: endpoints, DTOs, migrations, RLS.
- Scope delta (owner rule): all 79 stored, per-profile screen quota
  (`max_enabled`/`max_per_page`); explicit disabled rows at seed; per-option
  quota editor in Elementos tab (PATCH options/:id).

## Tasks
- [x] 023C-1 Move intro data into `intro-catalog.seed.ts` + count/label tests (GREEN 5/5; RED not observed — implementation pre-existed in working tree at handoff)
- [x] 023C-2 `ensureTeacherCatalog` both repositories + `seedProfileDefaults` call site + idempotency tests (GREEN 8/8 new-hook assertions pass; full `npm test` blocked by SPEC-021 spec update outside writer surfaces — see Verification evidence)
- [x] 023C-3 Quota seeding: `seedProfileDefaults` writes explicit per-option rows (exactly `maxEnabled` enabled, rest disabled; deterministic level/sortOrder/label order) in both repositories + quota-row test
- [x] 023C-4 SPEC-021 controller spec: seeded-catalog expectations (arrayContaining + counts), unknown-id 404 kept, new over-quota 422 test (limit-before-lookup incl. unknown ids)
- [x] 023C-5 Quota editor UI: `updateOption` in `services/backendActions.ts` (PATCH options/:id; `updateActionOption` delegates), per-option numeric editor in `ElementSection` + es-AR strings + RTL/axe tests; `h3`→`h2` for axe heading-order
- [x] 023C-6 Full verification green: be `npm test` 307/307, `test:e2e` 18/18,
  `build` + `lint` clean; fe `typecheck` + `check:supabase` clean, `npm test`
  131/131, `build` green. Parent spot-checked `check:supabase`.
- [ ] 023C-7 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline (small, understood scope). Writer trigger fires at 2+ files —
delegate one bounded writer if the provider cooperates, else inline with
disclosure.

## Verification evidence
- Focused: `npm test -- src/actions/intro-catalog.seed.spec.ts src/actions/in-memory-action.repository.spec.ts` → 2 suites, 13/13 pass.
- `npm test` → 303/305 pass; 2 failures in `src/profiles/profiles.controller.spec.ts` (SPEC-021) caused by the intended behavior change: profile creation now seeds the intro catalog, so 'lists and saves per-profile actions and items' sees extra actions and 'rejects unknown catalog ids' gets 422 LIMIT_EXCEEDED (seeded defaults exceed maxEnabled) instead of 404. Fix needs `profiles.controller.spec.ts` — outside writer surfaces, parent-owned.
- `npm run test:e2e` → 3 suites, 18/18 pass. `npm run build` → clean. `npm run lint` → clean (reverted an unrelated --fix formatting hunk in `ai-endpoints-enabled.guard.spec.ts`).

## Commits (feat/spec-023c-teacher-catalog)
- a5a9a5c test(actions): pin intro catalog seed counts and labels
- c059d55 feat(actions): seed teacher catalog on first profile
- fa410b8 feat(actions): seed explicit quota rows per profile
- ce5b9d3 feat(editor): per-option quota editor backed by PATCH options/:id

## Data repair (parent-run, 2026-10-03)
`/tmp/opencode/repair-quota.js` (service key, idempotent): 63 explicit
`is_enabled=false` rows for the existing teacher. Verified per option:
protagonist 39 stored/4 enabled, scenario 18/4, mission 16/4, style 6/4.

## Next
Push + PR to `dev` (needs user approval — publishing).
