# SPEC-013 — Focus trap for the controls ("Más") menu

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 4 / EPIC 4.3
- Depends on: SPEC-011 (pointerdown contract + tests), SPEC-012 (scroll)
- Blocks: SPEC-014 (autosave), SPEC-016 (WCAG audit)

## Implementation notes
- `FloatingControls` is now a trapped modal: `role="dialog"`,
  `aria-modal="true"`, backdrop that swallows pointer events (pressing outside
  no longer closes it), focus moves to the first option on open and returns to
  the floating button on close, and a `Cerrar` option plus `Escape` provide
  explicit exits.
- Navigation: auto-advance with the configured `scanInterval` (announced with
  `speakOption`), `Space`/`Enter` activate the focused option, arrows move and
  `Tab`/`Shift+Tab` cycle the DOM-ordered options (speed submenu included).
- A capture-phase `keydown` handler calls `stopImmediatePropagation`, so grids
  behind never receive Space/Enter; `isModalOpen` was added to
  `ScanSettingsContext` and `StudentApp` passes `isPaused || isModalOpen` to the
  grids so the scan pauses while the dialog is open.
- Active option highlight via `[data-active="true"]` + `.menu-option` CSS.
- Tests: 7 new `FloatingControls` cases (14 total in the suite) covering dialog
  focus, outside presses, Tab trap/cycle, Space activation, Escape, pause label
  flip and `Menú Principal` navigation.

## Objective
Turn the floating "Controles" menu (open/pause/resume/volver) into a trapped,
switch-navigable dialog: once open it cannot be left without choosing an option,
outer interactions are blocked, and Space/Enter/HID plus arrows/Tab move and
activate options. Today the menu is mouse-only `onClick`, closes on any outside
`mousedown`, has no focus trap and lets the grid behind react to Space/Enter.

## Current behavior (audit)
- `FloatingControls` renders a popup with `onClick` buttons (Velocidad +
  submenu, Voz, Descansar/Continuar, Menú Principal).
- Outside `mousedown` closes the menu (exit without selecting).
- No focus/scan navigation inside the menu; Tab can leave it.
- While open, the global `useInputDevice` listener still activates the grid
  behind on Space/Enter (double target).

## Decisions to confirm
- **D1 Modal trap (recommended)**: while open, a backdrop blocks every
  interaction outside the menu and pressing outside no longer closes it; the
  only exits are explicit selections (Continuar/Pausar, Voz, Velocidad, Volver
  al Menú, Cerrar). Alternative: keep click-outside-to-close and only trap Tab.
- **D2 Switch navigation (recommended)**: options are scanned with the existing
  `scanInterval` (auto-advance, spoken), activated with Space/Enter/HID; arrows
  move the focus manually; Tab/Shift+Tab cycle inside the menu
  (`role="dialog"`, `aria-modal="true"`, focus moves to the first option on
  open). Alternative: Tab-trap only (no scan inside the menu).
- **D3 Explicit close (recommended)**: add a "Cerrar" option and allow Escape
  to activate it, so keyboard users are never stuck while outside presses still
  cannot dismiss the menu.

## Contract
- Menu root: `role="dialog"`, `aria-modal="true"`, `aria-label="Controles"`,
  `data-no-scan` (global input ignores it) plus a `fixed inset-0` backdrop that
  swallows pointer events without closing.
- Options: DOM-ordered `button`s; the focused one gets a visible ring
  (`aria-selected`/`data-active`) and is announced with `speakOption`.
- Keyboard while open: `Space`/`Enter` activate, `ArrowUp/ArrowDown` and
  `ArrowLeft/ArrowRight` move, `Tab`/`Shift+Tab` cycle, `Escape` closes.
- Global listeners (`useInputDevice`, grid scan) must not fire while the menu
  is open (capture-phase `stopImmediatePropagation`).
- Selecting `Tomar un Descanso`/`Continuar` keeps the current behavior
  (toggle pause + close); `Menú Principal` keeps closing and navigating.

## File impact
- Update: `components/FloatingControls.tsx` (dialog semantics, backdrop, index
  state, keyboard/timer navigation, capture-phase guard).
- New: `components/FloatingControls.test.tsx` (Vitest + RTL).
- No backend changes; no new dependencies.

## Acceptance criteria
1. Opening the menu moves focus to the first option and renders a dialog.
2. Pointerdown outside (backdrop/body) does **not** close the menu (test).
3. Tab/Shift+Tab keep the focus inside the menu (test cycles options and the
   dialog remains open).
4. Space activates the focused option; arrows move it; the active option is
   visually indicated (tests).
5. Selecting `Menú Principal` calls `onGoToMenu` and closes; toggling pause
   closes and flips the label to `Continuar` (tests).
6. While open, Space/Enter no longer reach the grid behind (capture guard).
7. `npm run test`, `npm run typecheck`, `npm run build`, `npm run check:supabase`
   green.

## Edge cases
Speed submenu expanded (options added/removed from the cycle), menu opened
while paused, voice disabled (no announcements), reduced motion, double
activation of the same option, focus lost after an option closes the menu.

## Out of scope
Per-profile input modes (SPEC-015), WCAG audit (SPEC-016), restyling the menu,
other modals (dedication/PDF) which get the same trap in SPEC-016.

## Verification
`npm run test` · `npm run typecheck` · `npm run build` · `npm run check:supabase`;
manual: open the menu with the mouse and with Space/Enter/HID.
