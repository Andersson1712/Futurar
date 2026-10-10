# SPEC-018 — Critical tests and i18n guard

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 5 / EPIC 5.2
- Depends on: SPEC-017 (MSW/coverage), SPEC-011→016
- Blocks: SPEC-019 (CI)

## Implementation notes
- TTS default: `DEFAULT_ACCESSIBILITY.voiceFeedback` is asserted true and a new
  `components/StudentApp.tts.test.tsx` proves the wizard speaks option guidance
  when the profile has no settings row.
- i18n guard: `utils/messages.ts` now exposes a typed `TRANSLATIONS` dictionary
  and `t(key)` (throws on unknown keys). Migrated the critical shared copy in
  FloatingControls, ScanningGrid, StudentApp (wizard titles/menu/retry),
  LoginForm, StudentLibrary and StoryReader; `utils/messages.test.ts` checks no
  empty values, every key round-trips and the error-code fallback. Full i18n
  (namespaces/locales/panel extraction) stays as a follow-up spec.
- Critical E2E: `e2e/helpers/mockBackend.ts` intercepts Supabase REST + the Nest
  API and `e2e/critical-flow.spec.ts` runs profile → wizard → mocked generation
  (SSE) → reader with the generated title, passing on desktop and mobile.
- Coverage floor raised to 36/35/33/37 (measured 37.59/37.45/34.6/39).
- Frontend suite: **72 tests / 15 files** + 11 E2E passed (1 skipped).

## Objective
Close the critical-test matrix and stop UI copy from drifting: add the missing
TTS-default and i18n checks, add an end-to-end critical flow (wizard →
generation → reader) with route interception, and consolidate the tests that
already cover click-wins, focus trap, autosave, scroll and axe.

## Already covered (reference, no duplication)
| Critical test | Where |
|---|---|
| Click/pointerdown wins over scan focus | `components/ScanningGrid.test.tsx` (SPEC-011) |
| Focus trap of the controls menu | `components/FloatingControls.test.tsx` (SPEC-013) |
| Autosave + resume | `utils/progressStore.test.ts`, `components/StudentApp.test.tsx` (SPEC-014) |
| Scroll mobile/desktop | `e2e/scroll.spec.ts` (SPEC-012) |
| axe accessibility on key screens | `components/a11y.test.tsx` (SPEC-016) |

## Decisions to confirm
- **D1 i18n scope (recommended)**: extend the centralized es-AR dictionary in
  `utils/messages.ts` to cover the critical shared copy, migrate the components
  that own it (FloatingControls, ScanningGrid hint, StudentApp wizard titles and
  menu, LoginForm, StudentLibrary/Reader actions) to use `t(...)`, and add tests
  that every key is non-empty and rendered copy comes from the dictionary. The
  full i18n layer (key namespacing, locale switching, panel extraction) becomes
  its own spec; today's goal is "no hardcoded critical strings".
  Alternative: full i18n layer now (much larger).
- **D2 Critical E2E (recommended)**: Playwright flow with Supabase REST + Nest
  API route interception: pick profile → create story → answer the 4 steps →
  mocked generation + SSE → reader shows the book. No real backend/auth needed.
  Alternative: rely on the existing unit/integration coverage.
- **D3 TTS default (recommended)**: explicit tests that voice feedback is on by
  default (profile without settings) and that `StudentApp` calls `speak` when
  selecting options with the default profile.

## Contracts
```ts
// utils/messages.ts (extended dictionary)
export const MESSAGES = { errors: {...}, generation: {...}, controls: {...},
  wizard: {...}, library: {...}, reader: {...} } as const;
export function t(key: MessageKey): string;        // throws on unknown key
export function messageForErrorCode(code?: string): string;
```
- E2E helpers: `e2e/helpers/mockBackend.ts` (route interception for
  `**/rest/v1/**` and `**/api/v1/**`) and `e2e/critical-flow.spec.ts`.

## File impact
- New: `e2e/critical-flow.spec.ts`, `e2e/helpers/mockBackend.ts`,
  `utils/messages.test.ts`, `components/StudentApp.tts.test.tsx` (or extend
  the existing suites).
- Update: `utils/messages.ts` (+ keys), `components/FloatingControls.tsx`,
  `components/ScanningGrid.tsx`, `components/StudentApp.tsx`,
  `components/LoginForm.tsx`, `components/StudentLibrary.tsx`,
  `components/StoryReader.tsx`, `components/StoryDetails.tsx`, docs.
- No backend changes; no new dependencies.

## Acceptance criteria
1. TTS default tests pass: `DEFAULT_ACCESSIBILITY.voiceFeedback === true` and
   the wizard speaks option labels with a profile that has no settings row.
2. i18n guard: every dictionary key is non-empty, `t()` throws on unknown keys
   and the migrated components render dictionary values (asserted by test).
3. Playwright critical flow passes on desktop + mobile projects using mocked
   Supabase REST and Nest API, asserting the generated book title reaches the
   reader.
4. `npm run test`, `npm run test:coverage`, `npm run test:e2e`,
   `npm run typecheck`, `npm run build`, `npm run check:supabase` green.
5. Coverage does not drop below the SPEC-017 floor.

## Edge cases
Supabase REST response shapes (`student_settings` as array vs object);
route interception for SSE bodies; missing optional profile settings;
dictionary key typos (typed keys + throw); StrictMode double effects in E2E;
mobile project lacks HID (not required).

## Out of scope
Full i18n layer and panel string extraction (new spec), translation files,
visual regression, backend tests (SPEC-028).

## Verification
`npm run test` · `npm run test:coverage` · `npm run test:e2e` ·
`npm run typecheck` · `npm run build` · `npm run check:supabase`.
