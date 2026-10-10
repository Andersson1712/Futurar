-- SPEC-033B: per-teacher AI model preference (curated OpenRouter catalog).
-- One row per owner; nullable columns so only one choice may be stored.
-- Applied by the owner (same rule as previous migrations).

create table if not exists public.teacher_ai_settings (
  owner_id uuid primary key,
  text_model text,
  image_model text,
  updated_at timestamptz not null default now()
);

alter table public.teacher_ai_settings enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
