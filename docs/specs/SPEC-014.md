# SPEC-014 — Autosave and resume (wizard + viewer)

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 4 / EPIC 4.4
- Depends on: SPEC-009 (generation flow), SPEC-010 (local state cleanup)
- Blocks: SPEC-015 (per-profile settings), SPEC-021 (profiles API)

## Implementation notes
- `utils/progressStore.ts` keeps a versioned key (`futurar_progress_v1`) with a
  validated, whitelisted payload per student; `GENERATING` maps to
  `SELECT_STYLE`, unknown steps/corrupt JSON are discarded and the viewer is
  dropped when storage rejects the full payload. An **empty config is valid**
  (menu-level progress) — the first implementation rejected it and prevented
  resuming at MENU.
- `StudentApp` restores after students load (only for active students), saves
  with a 300 ms debounce plus `pagehide`/`visibilitychange: hidden`, and clears
  progress on profile switch, new story and logout (SPEC-010's `logout` now
  clears the key too).
- `StoryReader` reports the preview scroll (400 ms throttle) and restores it
  with `requestAnimationFrame` once chapters are parsed.
- Tests: 6 store cases + 2 `StudentApp` cases (unmount/remount resume at MENU
  and `GENERATING → SELECT_STYLE` restore); 23 frontend tests total.

## Objective
If a student leaves mid-flow (reload, close, device sleep), reopening resumes
the wizard at the same step with the same selections, and the last opened story
can continue in the viewer where it was left. Today everything resets to the
profile picker on reload.

## Current behavior (audit)
- `StudentApp` keeps `step`, `config` and `currentStudent` only in memory; a
  reload returns to `PROFILE` and loses selections.
- `StoryReader` keeps the preview scroll in the DOM only; reopening a story
  starts at the top.
- The only persisted frontend state is `futurar_story_config` (story size),
  cleared on logout.

## Decisions to confirm
- **D1 Storage (recommended)**: localStorage **per student**
  (`futurar_progress_v1`, keyed by student id), since the backend profiles API
  arrives in SPEC-021; the store is a small pure module so a server-backed
  implementation can replace it later. Alternative: wait for the backend.
- **D2 Scope (recommended)**: persist the wizard (`studentId`, `step`,
  `config` including generated content and the generated book id), the last
  opened story and the viewer preview scroll offset. Alternative: wizard only.
- **D3 Clearing (recommended)**: keep progress on normal exits (reload, close,
  back to menu) so it can resume; clear it on profile switch, on logout
  (SPEC-010) and when starting a new story (`handleCreateAnother`/new wizard).
- **D4 Safety (recommended)**: never persist transient steps; on restore map
  `GENERATING → SELECT_STYLE`, ignore unknown steps, and require the student to
  still exist in the active list before restoring.

## Contract
```ts
// utils/progressStore.ts
interface StudentProgress {
  studentId: string;
  step: string;                 // whitelisted UI steps
  config: { id?, protagonist, scenery, mission, style, title?, content?,
            imageUrl?, type };
  viewer?: { storyId: string; scrollTop: number };
  updatedAt: string;
}
loadProgress(): StudentProgress | undefined;   // validated + migration-safe
saveProgress(progress: StudentProgress): void; // debounced by the caller
clearProgress(): void;
```
- `StudentApp` restores on mount after students load; saves on
  `step`/`config` changes (debounced ~300 ms) and on `visibilitychange: hidden`
  / `pagehide` for fast exits.
- `StoryReader` reports the preview scroll offset through an optional
  `onProgress` callback and restores it after chapters are parsed.
- Corrupt or old payloads are discarded silently (versioned key).

## File impact
- New: `utils/progressStore.ts` + `utils/progressStore.test.ts`.
- Update: `components/StudentApp.tsx` (restore/save/clear + integration),
  `components/StoryReader.tsx` (scroll persist/restore),
  `components/StudentApp.test.tsx` (leave/return resume test).
- Update `SPEC-010` cleanup: logout also clears the progress key.

## Acceptance criteria
1. Store unit tests: roundtrip, per-student isolation, corrupt payload
   discarded, whitelisted steps, `GENERATING → SELECT_STYLE` mapping, clear.
2. Component test: select a student, advance the wizard to `SELECT_SCENERY`
   with a protagonist chosen, unmount, remount → resumes on `SELECT_SCENERY`
   with the selection and the same student.
3. Returning after a completed generation reopens the viewer with the same
   story content (`RESULT_VIEW`/`STORY_DETAILS`) and restores the preview
   scroll offset.
4. Starting a new story or switching profile clears the stored progress.
5. `npm run test`, `npm run typecheck`, `npm run build`,
   `npm run check:supabase` green.

## Edge cases
Corrupt JSON or unknown `step`; progress from a deleted/inactive student;
content larger than localStorage budget (drop `viewer` first); SSR/jsdom
without localStorage; logout race with debounced save; profile switch while a
save is pending.

## Out of scope
Server-side per-profile persistence (SPEC-021), scan/voice settings per profile
(SPEC-015), autosaving teacher panel edits, multi-device sync.

## Verification
`npm run test` · `npm run typecheck` · `npm run build` · `npm run check:supabase`;
manual: pick options, reload, confirm resume; read a story, scroll, reload.
