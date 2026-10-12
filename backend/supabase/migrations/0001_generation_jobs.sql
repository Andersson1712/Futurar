-- SPEC-006: durable generation jobs for the AI pipeline.
-- Apply with the Supabase CLI or the SQL editor (service-role context).

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  request jsonb not null,
  book jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

alter table public.generation_jobs enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
