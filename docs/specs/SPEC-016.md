# SPEC-016 — WCAG 2.2 AA audit, ISO/IEC 17549-3 and accessibility statement

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 4 / EPIC 4.6
- Depends on: SPEC-011→015 (interaction, scroll, trap, resume, settings)
- Blocks: SPEC-025 (public docs), SPEC-031 (release)

## Implementation notes
- `axe-core` runs in Vitest through `test/a11y.ts` (color-contrast disabled
  because jsdom has no layout) over LoginForm, ScanningGrid, StudentLibrary,
  the open controls dialog, GlobalConfigModal and the dedication dialog → 0
  violations.
- Contrast is verified with `utils/contrast.ts` + tests: body text ≥4.5:1,
  primary/white ≥4.5:1 (primary darkened `#137fec` → `#0b6bd3`), UI ≥3:1, and
  gray-500 documented as failing body text.
- Fixes: global `:focus-visible` outline, gray-500 → gray-400 texts (21),
  icon buttons raised to ≥44×44 px (7), `useDialogA11y` hook (role, aria-modal,
  initial focus, Tab trap, Escape) applied to the global config and dedication
  dialogs, and a heading-order fix in StoryDetails.
- Docs published: `docs/accessibility/audit-wcag-2.2.md`,
  `iso-17549-3-alignment.md`, `en-301-549-applicability.md`,
  `declaration.es.md` (limitations include es-AR TTS and pending user testing).
- Frontend suite: **54 tests** (10 files).

## Objective
Close Phase 4 with a real audit: run automated checks on the key screens, fix
the AA blockers found, document alignment with WCAG 2.2 AA / ISO/IEC 17549-3 /
EN 301 549 and publish an accessibility statement in es-AR.

## Current audit (manual, 2026-09-30)
- `<html lang="es">` OK; one trapped dialog (controls menu) from SPEC-013;
  reduced-motion/contrast handled in CSS; 44px+ on the new controls.
- Gaps found: **no global `:focus-visible` outline**; 21 `text-gray-500` small
  texts on dark backgrounds (contrast ≈ 4.1:1, below AA 4.5:1); ~34 icon
  buttons with `p-2` (≈40px target, below 44px); other modals
  (GlobalConfigModal, dedication/PDF dialogs, connection details) lack
  `role="dialog"`/`aria-modal`/Escape; no automated a11y tests yet.

## Decisions to confirm
- **D1 Automated audit (recommended)**: add `axe-core` and run it in Vitest for
  the key screens (LoginForm, ScanningGrid, StudentLibrary with mocks, open
  controls menu, dedication modal) with `color-contrast` disabled because jsdom
  has no layout; contrast is covered by D4. Alternative: manual-only audit and
  defer the tooling to SPEC-018.
- **D2 Fix blockers (recommended)**: fix everything found (global
  `:focus-visible`, contrast tokens, 44px targets, dialog semantics + Escape +
  initial focus on the remaining modals, form labels/alts found by axe).
  Alternative: document-only with fixes scheduled later.
- **D3 Statement (recommended)**: publish in the repo now
  (`docs/accessibility/declaration.es.md` + technical audit and alignment docs,
  linked from the spec/plan); the public web page arrives with SPEC-025.
  Alternative: build an in-app accessibility page now.
- **D4 Contrast (recommended)**: a small `utils/contrast.ts` computes WCAG
  ratios for the palette pairs used in the UI and unit-tests them (≥4.5:1 for
  body text, ≥3:1 for large text/UI borders), so contrast stays verified in CI
  without a real browser.

## Contracts / deliverables
- `test/a11y.ts`: `expectNoA11yViolations(container)` (axe, contrast disabled).
- `utils/contrast.ts`: `contrastRatio(hexA, hexB)`, `relativeLuminance(hex)`.
- `hooks/useDialogA11y.ts`: dialog semantics, initial focus, Escape and
  Tab trap, reusable by the remaining modals.
- Docs: `docs/accessibility/audit-wcag-2.2.md` (criterion-by-criterion),
  `iso-17549-3-alignment.md`, `en-301-549-applicability.md`,
  `declaration.es.md`.

## File impact
- New: `test/a11y.ts`, `utils/contrast.ts` (+ test), `hooks/useDialogA11y.ts`
  (+ test), `components/a11y.test.tsx`, four docs above.
- Update: `index.html` (focus-visible + contrast/theme tokens),
  `components/GlobalConfigModal.tsx`, `components/StoryDetails.tsx`,
  `components/StoryReader.tsx`, `components/ConnectionStatus.tsx` (dialog
  semantics), components with `text-gray-500`/`p-2` icon buttons,
  `package.json` (`axe-core` dev dep).
- No backend changes.

## Acceptance criteria
1. `expectNoA11yViolations` passes for LoginForm, ScanningGrid, StudentLibrary,
   the open controls menu and the dedication modal (axe violations = 0 with
   contrast excluded).
2. Contrast unit tests prove body/large/UI pairs meet 4.5:1 / 3:1.
3. Every interactive target is ≥44x44 px; visible focus exists for keyboard
   users (`:focus-visible`); all icon-only buttons have `aria-label`.
4. Remaining modals use the shared dialog hook (role, aria-modal, Escape,
   initial focus, Tab trap) with tests.
5. The four docs are published with the audit findings, ISO/EN mappings and the
   es-AR declaration (including known limitations).
6. `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run build`,
   `npm run check:supabase` green.

## Edge cases
jsdom lacks layout (axe contrast/canvas) → handled by D1/D4; third-party
Material Symbols icons without text; color-only meaning in scan states; focus
inside removed elements; uppercase mode with screen readers (text-transform is
cosmetic but `aria-label` keeps original text).

## Out of scope
Public website hosting of the declaration (SPEC-025), user testing with
assistive tech (documented as pending), IAAP certification, backend/a11y of the
teacher panel beyond the audited screens.

## Verification
`npm run test` · `npm run test:e2e` · `npm run typecheck` · `npm run build` ·
manual keyboard/switch pass over the audited screens.
