# SPEC-024 — Public student kiosk entry

## Objective
Login-free kiosk entry (`GET /profiles/active`, notes stripped), single
aborted fetch, localized entry errors, generation failure exits GENERATING to
`SELECT_STYLE` with voice announcement.

## Why
Accessibility-first: the student enters alone with one switch; no login
barrier, no dead-end spinner, no raw backend text, no post-unmount errors.

## Scope
Backend public endpoint + `listActive()` on both adapters + specs.
Frontend `apiFetchPublic`, `listActiveProfiles`, StudentApp entry/failure UX +
tests, E2E `student-entry.spec.ts`, `docs/specs/SPEC-024.md`.
Out: git-flow governance (numbering follow-up), migrations, new deps.

## Tasks
- [x] 024-1 Map dirty tree (15 files) and define real scope
- [x] 024-2 Write SPEC, get approval
- [x] 024-3 Verify suites (be 238+1, fe 108, typecheck, supabase guard)
- [x] 024-4 Work-unit commits + SPEC doc + MEMORY.md (50 lines)
- [ ] 024-5 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline (consolidation of existing tree, no new design). No delegation
available in this runtime; verification ran inline in bounded batches.

## Verification evidence
- backend `npm test`: 47 suites / 238 passed; `test:e2e`: 1 passed
- frontend `typecheck` clean, `check:supabase` OK, `npm test`: 23 files / 108 passed

## Commits (feat/spec-024-student-entry)
- b849ab0 feat(profiles): public active-profiles kiosk entry (SPEC-024)
- 1e630d6 feat(entry): login-free kiosk entry with errors + retry (SPEC-024)
- 656685d docs(memory): record SPEC-023B/SPEC-024 verification state
