# Contributing to Futurar

Thanks for helping build accessible creation tools. This project follows
**spec-driven development (SDD)**: no code without an approved spec. Read
[`AGENTS.md`](AGENTS.md) first — it is the source of truth.

> Last reviewed: 2026-10-01

## Ground rules

- **AI never runs in the frontend.** No AI SDK, API key or prompt in the browser.
  All AI goes through the backend.
- **The backend owns the data.** The frontend uses Supabase Auth only.
- **Accessibility is non-negotiable.** One-switch operation, `pointerdown`
  selection (a direct click always beats scan focus), targets >= 44x44 px,
  contrast >= 4.5:1, visible focus, no blocked scroll.
- **UI is es-AR; code, comments, identifiers and commits are English.**
- No new dependency without approval. No `any` without justification.

## Workflow

1. Read `AGENTS.md` and `MEMORY.md`; update `MEMORY.md` (<= 50 lines) before
   finishing.
2. Write a **SPEC** (objective, versions, acceptance criteria, edge cases, file
   impact, contracts) in `docs/specs/` and get it approved.
3. Branch from `dev`:
   ```bash
   git checkout dev && git pull
   git checkout -b feat/spec-0xx-short-title
   ```
4. Implement to the spec with tests. Keep the CI green.
5. Open a **PR to `dev`**. `main` is protected (1 review) and only updated from
   `dev` at phase close.

Commits and PR titles use **Conventional Commits**:
`feat(actions): per-page limits (SPEC-023B)`, `fix(a11y): restore focus ring`,
`docs: add architecture overview`. A `commitlint` hook and CI job enforce this.

Merge strategy is **squash-only**; branches auto-delete on merge.

## Local checks (run before pushing)

Frontend (repo root):

```bash
npm run typecheck
npm run check:supabase
npm run test:coverage
npm run build
npm run test:e2e
```

Backend (`backend/`):

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

Hooks are installed automatically by `npm install` (husky). To bypass once for a
WIP commit: `HUSKY=0 git commit ...`.

## Tests

- Every new behavior needs a test. Don't lower the coverage floor.
- Frontend: Vitest + Testing Library + MSW; Playwright for end-to-end. Axe runs
  in Vitest for accessibility (color contrast is checked separately).
- Backend: Jest unit + e2e; validate every AI response server-side before
  persisting.

## Accessibility checklist

Include this in your PR and verify it:

- [ ] Works with one switch (scan) and with direct input.
- [ ] `pointerdown` on `[data-option]` selects what is pressed; never on release.
- [ ] Targets >= 44x44 px; text contrast >= 4.5:1; focus contrast >= 3:1 and
      always visible.
- [ ] Honors `prefers-reduced-motion`/`prefers-contrast`; scroll is never blocked.
- [ ] No `div`/`span` used as a button; interactive elements have accessible
      names (`aria-label`).

## Documentation

- Update `docs/specs/SPEC-0xx.md` status when a spec closes.
- Keep `README`/guides accurate; UI strings live in `utils/messages.ts` (see the
  [i18n guide](docs/i18n.md)).

## Reporting bugs and requesting features

Use the issue templates (bug report / feature request). For security issues, see
[`SECURITY.md`](SECURITY.md). All participation is covered by the
[Code of Conduct](CODE_OF_CONDUCT.md).
