-- SPEC-029: canonical design storage with versions, audit and soft delete.
-- Mirrors 0002_books.sql: single-version flyers with per-version audit,
-- idempotent by generation_job_id. Applied by the owner.

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid,
  title text not null,
  message text not null,
  occasion text not null,
  style text not null,
  audience text,
  image_path text,
  image_prompt text,
  current_version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists designs_user_created_idx
  on public.designs (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  version integer not null,
  title text not null,
  message text not null,
  occasion text not null,
  style text not null,
  audience text,
  image_path text,
  image_prompt text,
  prompt_version text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  generation_job_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (design_id, version),
  unique (generation_job_id)
);

create index if not exists design_versions_design_idx
  on public.design_versions (design_id, version desc);

alter table public.designs enable row level security;
alter table public.design_versions enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
