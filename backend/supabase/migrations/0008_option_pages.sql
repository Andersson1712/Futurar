-- SPEC-023B: per-page scan limit for action options.
-- `max_enabled` caps the total enabled items per option; `max_per_page` caps the
-- enabled items shown on one scan page (one `level`). Both are enforced by the
-- backend on PUT /profiles/:id/items and consumed by the wizard pagination.

alter table public.action_options
  add column if not exists max_per_page integer not null default 6
  check (max_per_page between 1 and 12);
