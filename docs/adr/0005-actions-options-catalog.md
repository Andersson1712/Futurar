# 0005 — Generic actions/options catalog with per-profile permissions

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-023/023B)

## Context

The teacher flow used four hardcoded per-student Supabase tables. The same
options were duplicated per student, the model was fixed, and it was the last big
source of direct Supabase writes in the frontend.

## Decision

- Model the catalog generically: **Acción → Opción → Ítem (nivel/tipo)**, owned
  by the backend and scoped per teacher:
  `actions → action_options → action_option_items`.
- Enable per profile with `profile_actions` and `profile_option_items`.
- Enforce limits on save: `max_enabled` (total per option) and
  `action_options.max_per_page` (per level/page), returning `422 LIMIT_EXCEEDED`.
- The wizard groups options by `level` into scan pages with a "Más opciones"
  target; `GET /profiles/:id/options` keeps a stable adapter shape.
- Drop the frontend Supabase imports for the editor/teacher panel.

## Consequences

- Positive: one catalog per teacher, reusable across profiles; extensible to new
  actions/types; the wizard can't be flooded.
- Negative: migration/backfill of legacy tables; in-memory and Supabase adapters
  must stay behaviorally identical.
