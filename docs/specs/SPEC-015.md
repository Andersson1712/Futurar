# SPEC-015 — Per-profile accessibility settings

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D6 as recommended)
- Phase: 4 / EPIC 4.5
- Depends on: SPEC-011 (input contract), SPEC-014 (progress), SPEC-010 (state cleanup)
- Blocks: SPEC-016 (WCAG audit), SPEC-021 (backend profiles)

## Implementation notes
- `0003_student_settings_accessibility.sql` adds `sweep_enabled`, `input_mode`,
  `line_height`, `bold_titles`, `uppercase`, `voice_gender` plus a `font_size`
  check; the teacher panel edits them through the current Supabase path until
  SPEC-021.
- `utils/accessibility.ts` normalizes/clamps profile values (interval 800–5000,
  columns 1–4) and applies root font size (16/19/22), line height, uppercase
  and bold titles as document attributes; `useAccessibility` also configures the
  TTS voice and runs on every active profile change.
- `ScanSettingsContext` now exposes `sweepEnabled`/`inputMode`/`scanColumns` and
  `applyProfileSettings`, so profile values seed the session and floating
  speed/voice changes finally reach the grids. `ScanningGrid` reads the context
  optionally and auto-advances only when sweeping is enabled in `scan`/`switch`
  modes; `mouse`/`touch` stay direct-only (SPEC-011 tests unchanged).
- `utils/speech.ts` gains `pickSpanishVoice` (es-AR → es-419 → es-US → es-MX →
  es-ES, with gender name heuristics) and `configureSpeechVoice`; the default
  language is es-AR with the documented es-US fallback.
- `index.html` adds line-height/uppercase/bold attribute rules and always-on
  `prefers-reduced-motion`/`prefers-contrast` media queries (independent of the
  profile).
- Tests: accessibility (6), speech voices (5), `useAccessibility` (2) and
  scan-mode cases in `ScanningGrid` (2) → 38 frontend tests total.

## Objective
Give every student profile its own accessibility configuration and apply it
app-wide: scan speed, scanning on/off, input mode (scan/switch/mouse/touch),
font size (12/16/22), line height, bold titles, uppercase, voice gender and
OS-level reduced-motion/contrast. Today only speed, columns and voice on/off
are editable, and nothing beyond that is persisted or applied.

## Current behavior (audit)
- `student_settings` already stores `scan_interval`, `scan_columns`,
  `voice_feedback`, `sound_enabled` (plus unused `font_size` and `theme`).
- `StudentEditor` (Accesibilidad tab) edits speed/columns/voice via Supabase.
- `StudentApp` derives scan settings from the profile; `FloatingControls`
  changes speed only for the session.
- `utils/speech.ts` never selects a `voice`; it speaks with `lang: 'es-ES'`.
- No font/line/uppercase/bold controls, no input-mode selector and no
  `prefers-reduced-motion/contrast` handling.

## Decisions to confirm
- **D1 Persistence (recommended)**: migration `0003_student_settings_accessibility.sql`
  adds `sweep_enabled`, `input_mode`, `line_height`, `bold_titles`, `uppercase`
  and `voice_gender` to `student_settings` (reusing the existing `font_size`),
  edited from the teacher panel through the current Supabase path until
  SPEC-021 moves ownership to the backend. Alternative: localStorage only.
- **D2 Application (recommended)**: an `AccessibilityProvider` derives the
  effective settings from `currentStudent` and applies them to
  `document.documentElement` (root font size 12/16/22 px via `--a11y-font-size`,
  line-height CSS variable, `data-bold-titles`/`data-uppercase` attributes) so
  every screen scales without prop drilling.
- **D3 Sizes (recommended)**: `font_size`: `normal=16px`, `large=19px`,
  `xlarge=22px` labels Chico/Normal/Grande (the 12 px floor is honored by the
  reduced-motion/contrast CSS). Alternative: only 16/22.
- **D4 Voice (recommended)**: `voice_gender` (`female`/`male`/`auto`) selects a
  Spanish voice by preference order es-AR → es-419 → es-US → any `es`, with
  name heuristics for gender; `es-US` fallback is documented because Gemini TTS
  and device voices lack es-AR consistently. Alternative: expose the raw device
  voice list.
- **D5 Input (recommended)**: `sweep_enabled` (master) plus `input_mode`
  (`scan`/`switch`/`mouse`/`touch`); auto-advance runs only when scanning is
  enabled and the mode is `scan`/`switch`; direct pointer selection still wins
  (SPEC-011). The floating speed control stays a session override.
- **D6 Motion/contrast (recommended)**: CSS media queries
  (`prefers-reduced-motion: reduce` disables scan/animation keyframes;
  `prefers-contrast: more` strengthens outlines/contrast) always honored,
  independent of the profile.

## Contract
```ts
interface AccessibilitySettings {
  scanInterval: number;        // 800–5000 ms
  sweepEnabled: boolean;
  inputMode: 'scan' | 'switch' | 'mouse' | 'touch';
  scanColumns: number;         // 1–4
  voiceFeedback: boolean;
  voiceGender: 'female' | 'male' | 'auto';
  soundEnabled: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  lineHeight: 'normal' | 'relaxed' | 'loose';
  boldTitles: boolean;
  uppercase: boolean;
}
```
- Applied through `data-*` attributes + CSS variables on `<html>`; components
  keep reading the existing `useScanSettings` context (now seeded from the
  profile) so no call sites change.
- `student_settings` defaults keep today's behavior for existing rows.
- The editor validates values and saves per profile; `StudentApp` refreshes
  the applied settings when the profile changes.

## File impact
- New: `backend/supabase/migrations/0003_student_settings_accessibility.sql`,
  `contexts/AccessibilityContext.tsx` (+ test), `utils/accessibility.ts`
  (defaults/mapping) + tests.
- Update: `types/database.ts` (settings row), `components/StudentEditor.tsx`
  (new controls), `components/StudentApp.tsx` (apply on profile change and
  honor `sweepEnabled`/`inputMode`), `contexts/ScanSettingsContext.tsx` (seed
  from profile), `utils/speech.ts` (voice selection), `index.html` (CSS
  variables + reduced-motion/contrast media queries), docs.
- No new dependencies; no backend code changes (SQL only).

## Acceptance criteria
1. Editor can set and persist every setting per profile (migration applied);
   defaults preserve current behavior.
2. Applying a profile updates root font size, line height, uppercase and bold
   titles immediately; switching profiles updates them again.
3. Scanning auto-advances only with `sweep_enabled` and `scan`/`switch` modes;
   `mouse`/`touch` never auto-advance and direct selection keeps working
   (SPEC-011 tests stay green).
4. Voice preference picks an `es` voice (AR/419/US order) and falls back
   gracefully when no Spanish voice exists.
5. `prefers-reduced-motion` disables animations and `prefers-contrast: more`
   increases contrast, regardless of profile settings (CSS + a jsdom-verifiable
   attribute).
6. `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run build`,
   `npm run check:supabase` green.

## Edge cases
Profiles without a settings row; legacy values (`font_size: null`); invalid
stored values; no `speechSynthesis` voices (jsdom/unsupported browsers); root
font-size at 12 px and layout overflow; floating speed override vs profile
value on profile switch; uppercase with proper names in headings.

## Out of scope
Backend-owned profiles/settings API (SPEC-021), theme/high-contrast themes
beyond the OS query, per-page overrides, cloud TTS.

## Verification
`npm run test` · `npm run test:e2e` · `npm run typecheck` · `npm run build` ·
`npm run check:supabase`; manual per-profile check in the teacher panel.
