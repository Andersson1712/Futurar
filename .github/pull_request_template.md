<!--
Thanks for contributing to Futurar. Keep the PR scoped to one SPEC.
Title must be a Conventional Commit, e.g. `feat(actions): per-page limits`.
-->

## SPEC
- SPEC: <!-- e.g. SPEC-024 (docs/specs/SPEC-024.md) -->
- Objective:

## Changes
<!-- What changed and why. Keep it short. -->

## Accessibility checklist (WCAG 2.2 AA / single-switch)
- [ ] Works with one switch (scan) and with direct input.
- [ ] `pointerdown` on `[data-option]` selects what is pressed; selection never happens on release.
- [ ] Targets are at least 44x44px; text contrast >= 4.5:1; focus contrast >= 3:1 and always visible.
- [ ] Honors `prefers-reduced-motion` / `prefers-contrast`; scroll is never blocked.
- [ ] No `div`/`span` used as a button; interactive elements have accessible names.

## Engineering checklist
- [ ] No business logic in React components; UI strings are in `utils/messages.ts` (i18n, es-AR).
- [ ] AI stays server-side: no AI SDK, key, prompt or provider call in the frontend.
- [ ] New logic has tests; existing suites stay green.
- [ ] DTO/schema validation added or updated where inputs change.

## Verification
<!-- Paste the commands you ran and their result, e.g. -->
- Backend: `npm run build && npm run lint && npm test && npm run test:e2e`
- Frontend: `npm run typecheck && npm run test:coverage && npm run build && npm run check:supabase && npm run test:e2e`

## Risk / rollback
<!-- Migrations, flags, or anything an operator must do. -->
