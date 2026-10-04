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
- Out: endpoints, DTOs, migrations, RLS, frontend.

## Tasks
- [ ] 023C-1 Move intro data into `intro-catalog.seed.ts` + count/label tests (RED→GREEN)
- [ ] 023C-2 `ensureTeacherCatalog` both repositories + `seedProfileDefaults` call site + idempotency tests
- [ ] 023C-3 Full verification (test/e2e/build/lint) + docs + MEMORY.md (<=50 lines)
- [ ] 023C-4 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline (small, understood scope). Writer trigger fires at 2+ files —
delegate one bounded writer if the provider cooperates, else inline with
disclosure.

## Verification evidence
- (pending)

## Commits
- (pending) branch `feat/spec-023c-teacher-catalog`

## Next
SPEC approval first (SDD). Only after approval, implement to this spec.
