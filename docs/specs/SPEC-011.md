# SPEC-011 — Direct pointerdown always wins over scan focus

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 4 / EPIC 4.1
- Depends on: SPEC-009 (current frontend), SPEC-010 (session plumbing)
- Blocks: SPEC-012 (scroll), SPEC-015 (per-profile input settings), SPEC-018 (tests)

## Implementation notes
- D1 pulled forward the minimal runner from SPEC-017: Vitest 5 + RTL 16 + jsdom
  30 + user-event + jest-dom, with `npm test` / `npm run test:watch`,
  `vitest.config.ts` and `test/setup.ts`. Seven regression tests cover:
  pointerdown wins over focus, no selection on release, no double activation,
  Space keeps selecting the focus, scan timer paused during selection,
  fallback to focus outside options, and paused grid ignoring input.
- `ScanningGrid` options now expose `data-option` and select on `pointerdown`
  (preventDefault + stopPropagation) through a single-fire `selectOption` that
  locks selection for 500 ms and cancels the scan interval; voice playback is
  skipped while locked and while paused.
- `useInputDevice` global activation moved from `click` to `pointerdown`, also
  ignoring `[data-option]`, `button`, `a` and `[data-no-scan]` targets, so a
  direct press can never trigger the scan focus.
- `FloatingControls` was intentionally left as-is: it is a non-scanned menu
  (`data-no-scan`) whose buttons act directly; no shared contract is needed.
- D2: per-profile input modes stay in SPEC-015 (plan item moved there).

## Objective
Make direct input deterministic and accessible: pressing an option (pointer or
touch) selects the element actually pressed **on pointerdown**, cancels the
running scan timer and acts immediately; release never triggers selection.
Keyboard/HID activation keeps selecting the scan-focused option.

## Current behavior (audit)
- `ScanningGrid` cards select on `onClick` (fires on release) and the global
  `useInputDevice` listener activates the scan focus on `click`.
- `useInputDevice` ignores clicks on `[data-no-scan]`, so grid cards work by
  luck of markup instead of a shared contract; release-time actions remain
  possible if the pointer moved between down/up.
- Scan options are not addressable (`data-option` missing), so there is no
  single "pressed element wins" rule.

## Decisions to confirm
- **D1 Regression test (recommended)**: pull forward the minimal test runner
  from SPEC-017 (Vitest + React Testing Library + jsdom + user-event) and ship
  the SPEC-011 regression test with the fix. Alternative: fix now and add the
  test in SPEC-018.
- **D2 Input modes per profile (recommended)**: keep the per-profile modes
  (scanning/mouse/switch/touch) in SPEC-015; SPEC-011 defines the semantics all
  modes share. Alternative: implement the mode selector now (needs a new
  `student_settings` column).
- **D3 Contract (recommended)**: every selectable option gets
  `data-option="<id>"` and handles `onPointerDown`; `useInputDevice` switches
  its global activation listener from `click` to `pointerdown` and ignores
  events whose target is inside `[data-option]` (the option handles itself).

## Contract
```tsx
// Scan option element
<div data-option={opt.id} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); select(opt.id); }} />
```
- `select` runs once (guard against double fire), stops speech, plays the
  selection sound and calls `onSelect`.
- Direct selection cancels/resets the scan interval so the focus cannot advance
  mid-interaction and re-trigger.
- `useInputDevice.onActivate` (Space/Enter/HID) is unchanged and keeps using
  the focused index.
- Interactive elements (`input`, `textarea`, `select`, `button`, `a`,
  `[data-no-scan]`) never trigger global activation.

## File impact
- Update: `hooks/useInputDevice.ts` (pointerdown + `[data-option]` ignore),
  `components/ScanningGrid.tsx` (pointerdown, `data-option`, timer cancel,
  single-fire guard), `components/FloatingControls.tsx` (same contract).
- New (if D1): `vitest.config.ts`, `test/setup.ts`,
  `components/ScanningGrid.test.tsx` (or `tests/`), `package.json`
  (`test`/`test:watch` scripts + dev deps: `vitest`, `jsdom`,
  `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`,
  `@testing-library/jest-dom`).
- No backend changes.

## Acceptance criteria
1. Pointerdown on option B while the scan focus is A selects **B** and only
   once (regression test with the runner).
2. The scan keeps advancing while idle and Space/Enter/HID still select the
   focused option (existing behavior preserved).
3. Pointerdown on a non-option area falls back to activating the focused
   option; pointerup alone never selects.
4. Selection is cancelled/ignored while the grid is paused
   (`useScanSettings.isPaused`).
5. `npm run test`, `npm run typecheck`, `npm run build` green; no console
   errors in the test run.

## Edge cases
Rapid double pointerdown (single selection); pointerdown on the active option;
touch events emitting compatibility mouse events; pointer capture lost; grid
options changing during a press; disabled/paused grid; nested interactive
elements inside an option (e.g., description text).

## Out of scope
Per-profile input modes (SPEC-015), scroll fixes (SPEC-012), focus trap
(SPEC-013), autosave (SPEC-014), full a11y audit (SPEC-016).

## Verification
Frontend `npm run test`, `npm run typecheck`, `npm run build`; manual: hold
pointer on an option different from the focused one and confirm immediate
selection and no double action.
