# WCAG 2.2 AA audit — Futurar frontend

Date: 2026-09-30 · Scope: student flow (wizard, scanning, library, reader,
dedication), teacher panel basics and shared controls.

## Method
- Manual review of the audited screens plus automated `axe-core` runs in
  Vitest (`components/a11y.test.tsx`) over LoginForm, ScanningGrid,
  StudentLibrary, the open controls dialog, GlobalConfigModal and the
  dedication dialog.
- jsdom has no layout, so `color-contrast` is verified separately with
  `utils/contrast.test.ts` over the real palette (WCAG relative luminance and
  ratio).
- Interaction rules (keyboard/switch) are covered by the SPEC-011/013/015 test
  suites.

## Result summary
| Area | Result | Notes |
|---|---|---|
| 1.1 Text alternatives | Pass | Icon-only buttons carry `aria-label`; images use `alt`. |
| 1.3 Adaptable | Pass | Semantic headings, dialog roles, `lang="es"` on `<html>`. |
| 1.4.3/1.4.11 Contrast | Pass | Body text ≥4.5:1 (gray-400/white on dark); primary darkened to `#0b6bd3` for white text ≥4.5:1; UI/primary ≥3:1. |
| 1.4.4 Resize text | Pass | Root font size configurable 16/19/22 px per profile. |
| 1.4.10 Reflow | Pass | Vertical scroll unblocked and `100dvh` layouts (SPEC-012). |
| 1.4.12 Text spacing | Pass | Configurable line height per profile (SPEC-015). |
| 2.1.1/2.1.2 Keyboard | Pass | All actions reachable with Space/Enter/HID and pointer; no keyboard trap. |
| 2.4.3/2.4.7 Focus order/visible | Pass | Logical order; global `:focus-visible` ring. |
| 2.4.11 Focus not obscured | Pass | Dialogs keep focus inside and scroll content. |
| 2.5.7 Dragging movements | N/A | No drag-only interactions. |
| 2.5.8 Target size (24 px AA) | Pass | Interactive targets ≥44 px in audited screens (project rule). |
| 3.2.1/3.2.2 On focus/input | Pass | No context changes on focus. |
| 3.3.1/3.3.2 Errors/labels | Pass | Visible labels and text errors (login, forms). |
| 4.1.2 Name, role, value | Pass | `role="dialog"`, `aria-modal`, `aria-expanded`, `aria-pressed` in scanning. |
| 4.1.3 Status messages | Pass (frontend) | `role="status"` on save/PDF progress; generation progress is announced by TTS. |

## Findings and fixes
- Missing visible focus: added global `:focus-visible` outline (3 px white).
- 21 `text-gray-500` small texts below 4.5:1: replaced with `text-gray-400`.
- White text on `primary` was 3.98:1: primary adjusted to `#0b6bd3` (≥4.5:1).
- ~7 icon-only buttons around 40 px: raised to ≥44×44 px.
- Modals without dialog semantics: shared `useDialogA11y` hook (role,
  aria-modal, initial focus, Tab trap, Escape) applied to global config and the
  dedication dialog; heading levels fixed in StoryDetails.

## Pending / known limitations
- `es-AR` TTS voice is not available on most devices: documented fallback to
  `es-US` (see declaration).
- The teacher panel beyond the audited screens, the legacy Supabase data
  screens and the public website need their own pass (SPEC-021/025).
- User testing with assistive technology is still pending.
