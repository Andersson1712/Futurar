-- SPEC-029B: canonical presentation storage with versions, audit and soft delete.
-- Mirrors 0009_designs.sql: single-version decks with per-version audit,
-- idempotent by generation_job_id. Slides ride as validated JSON in the
-- version row (no extra slides table in v1). Applied by the owner.

create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid,
  title text not null,
  topic text not null,
  style text not null,
  audience text,
  slide_count integer not null,
  current_version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentations_user_created_idx
  on public.presentations (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.presentation_versions (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations (id) on delete cascade,
  version integer not null,
  title text not null,
  topic text not null,
  style text not null,
  audience text,
  slide_count integer not null,
  slides jsonb not null,
  prompt_version text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd double precision,
  generation_job_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (presentation_id, version),
  unique (generation_job_id)
);

create index if not exists presentation_versions_presentation_idx
  on public.presentation_versions (presentation_id, version desc);

alter table public.presentations enable row level security;
alter table public.presentation_versions enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
