# SPEC-024 — Public student kiosk entry

- Status: **implemented** (branch `feat/spec-024-student-entry`; pending PR to `dev`)
- Depends on: SPEC-021 (ProfilesModule), SPEC-010 (session/JWT)
- Numbering note: `plan.md` Fase 7 used number 024 for git-flow governance.
  This branch redefines 024 as student entry (already recorded in MEMORY.md);
  git-flow items are renumbered as follow-up.

## Objective
The student reaches the kiosk and picks a profile with no teacher login.
Generation failures never park the UI on the GENERATING spinner, and entry
errors never surface raw backend text.

## Contracts
- `GET /api/v1/profiles/active` — public (no guard), active profiles across
  teachers ordered by name, `notes` stripped via `toPublicProfile` whitelist.
  Declared before `@Get(':id')` so Express never swallows `/active` as an id.
- `ProfileRepository.listActive()` on both adapters (in-memory sorts by name;
  Supabase `eq(is_active, true).order('name')`).
- Frontend `apiFetchPublic` (no Bearer, no Supabase session touch) +
  `listActiveProfiles(signal)`; single fetch on mount with AbortController +
  cancelled guard.
- `profileListErrorMessage`: ApiError → `messageForErrorCode`, NetworkError →
  network message, else generic.
- Generation failure → back to `SELECT_STYLE` + voice announcement, retryable
  with one switch.

## Verification
- Backend `npm test`: 47 suites / 238 passed; `test:e2e`: 1 passed.
- Frontend `typecheck` clean, `check:supabase` OK, `npm test`: 108 passed.
- Controller spec: public access without token, notes stripped, scoped
  listing still 401. E2E `student-entry.spec.ts`: login-free entry +
  failed generation leaves spinner with localized error.

## File impact
Backend `profiles.controller/service`, `profile.repository` (+ both
adapters) + specs. Frontend `backendApi.ts`, `backendProfiles.ts`,
`StudentApp.tsx` + tests, `e2e/helpers/mockBackend.ts`,
`e2e/student-entry.spec.ts`.
