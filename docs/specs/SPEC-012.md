# SPEC-012 — Unblocked scroll on mobile and desktop

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 4 / EPIC 4.2
- Depends on: SPEC-011 (test runner)
- Blocks: SPEC-015 (per-profile settings), SPEC-016 (WCAG audit)

## Implementation notes
- `index.html`: body no longer uses `overflow-hidden`; base CSS now sets
  `html, body { min-height: 100dvh }`, `overflow-x: hidden`,
  `touch-action: pan-y`, `overscroll-behavior-y: none` and a `safe-center`
  helper (`justify-content: safe center`) so tall content in centered flex
  layouts is never clipped.
- `StudentApp` screens use `min-h-[100dvh]` and its mains are `overflow-y-auto`;
  `LoginForm`, `TeacherPanel`, `StoryReader` and `StudentEditor` moved to
  `100dvh` (editor dropped `h-screen`/`overflow-hidden`).
- D1: Playwright 1.63 was added (Chromium 1243 was already cached), with
  `playwright.config.ts` (desktop + Pixel 7 projects, Vite dev server) and
  `e2e/scroll.spec.ts`: body styles, desktop wheel document scroll, inner list
  scroll, mobile touch pan via CDP and no horizontal overflow. Result: 9 passed
  / 1 skipped (touch test skips on desktop).
- Space/Enter activation from SPEC-011 is untouched; arrows/PageUp/PageDown
  were never intercepted.

## Objective
Remove the global scroll blocking so pages and inner lists scroll with wheel,
touch, keyboard and switch input, on mobile and desktop, without breaking the
single-switch experience (Space/Enter still activate the scan focus).

## Current behavior (audit)
- `index.html` sets `overflow-hidden` on `<body>`, blocking document scroll.
- `StudentApp` mains use `overflow-hidden` around centered content, clipping
  long libraries/menus.
- `StudentEditor` uses `h-screen ... overflow-hidden` (fixed height).
- Full-height screens use `min-h-screen` (100vh) instead of `100dvh`, causing
  mobile viewport jumps with browser chrome.
- No touch/wheel `preventDefault` exists, but `index.html` has no
  `touch-action` hint; Space/Enter `preventDefault` is intentional (activation)
  and arrows/PageUp/PageDown are not intercepted.

## Decisions to confirm
- **D1 E2E now (recommended)**: add `@playwright/test` and ship the
  mobile/desktop scroll regression (a Chromium build is already cached in this
  environment). Alternative: defer E2E to SPEC-017 and verify with unit
  assertions + manual checks.
- **D2 Scroll strategy (recommended)**: `body { overflow-x: hidden }` only
  (vertical scroll allowed), `min-h-[100dvh]` for full-height screens,
  `touch-action: pan-y` on `body`, and `overflow-y-auto` (never `overflow-hidden`)
  for content areas that can grow. Space/Enter keep `preventDefault`.
- **D3 `select-none`**: keep the current body text-selection behavior; text
  selection accessibility is reviewed in SPEC-016.

## Contract
```css
html, body { min-height: 100dvh; }
body { overflow-x: hidden; touch-action: pan-y; }
```
- Full-height screens: `min-h-[100dvh]`.
- Scrollable content: `overflow-y-auto` with `-webkit-overflow-scrolling` left
  to the platform; no global `overflow: hidden`.
- Space/Enter activation unchanged; keyboard page scroll (arrows, PageUp/Down,
  Home/End) must work outside inputs.

## File impact
- Update: `index.html` (body class + base CSS), `components/StudentApp.tsx`
  (`min-h-screen` → `min-h-[100dvh]`, mains `overflow-hidden` →
  `overflow-y-auto`), `components/StudentEditor.tsx` (fixed height + overflow),
  `components/StoryReader.tsx` (reading panes), `package.json`
  (`test:e2e` script + Playwright dev dep), `vitest.config.ts` (exclude `e2e/`).
- New (D1): `playwright.config.ts`, `e2e/scroll.spec.ts`.
- No backend changes; no logic changes.

## Acceptance criteria
1. Desktop E2E: with tall content, mouse wheel scrolls the document
   (`window.scrollY > 0`) and a long inner list scrolls its container.
2. Mobile E2E (touch emulation): a touch pan scrolls the document; computed
   `body` styles are `overflow-y: auto/visible` and `touch-action: pan-y`.
3. No horizontal scrollbar on desktop or mobile.
4. Space/Enter still activate the scan focus (SPEC-011 tests stay green) and
   arrows/PageDown scroll when no scan grid consumes them.
5. `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run build`,
   `npm run check:supabase` green.

## Edge cases
iOS dynamic viewport (100dvh fallback), long libraries and teacher lists,
modals with internal scroll, `prefers-reduced-motion`, embedded PDF/reader
panes, paused scanning overlay (must not block scroll).

## Out of scope
Per-profile settings (SPEC-015), full WCAG audit (SPEC-016), visual redesign,
momentum-scroll tuning, PDF export layout.

## Verification
`npm run test` · `npm run test:e2e` · `npm run typecheck` · `npm run build` ·
`npm run check:supabase`; manual check on a phone-sized viewport.
