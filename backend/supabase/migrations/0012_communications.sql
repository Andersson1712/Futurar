-- SPEC-029C: canonical board storage with versions, audit and soft delete.
-- Mirrors 0011_presentations.sql: single-version boards with per-version
-- audit, idempotent by generation_job_id. Cells ride as validated JSON in
-- the version row (no extra cells table in v1). Applied by the owner.

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid,
  title text not null,
  kind text not null,
  topic text not null,
  style text not null,
  audience text,
  cell_count integer not null,
  current_version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communications_user_created_idx
  on public.communications (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.communication_versions (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications (id) on delete cascade,
  version integer not null,
  title text not null,
  kind text not null,
  topic text not null,
  style text not null,
  audience text,
  cell_count integer not null,
  cells jsonb not null,
  prompt_version text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd double precision,
  generation_job_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (communication_id, version),
  unique (generation_job_id)
);

create index if not exists communication_versions_communication_idx
  on public.communication_versions (communication_id, version desc);

alter table public.communications enable row level security;
alter table public.communication_versions enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
