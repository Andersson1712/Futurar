-- SPEC-008: canonical book storage with versions, audit and soft delete.

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid,
  title text not null,
  page_count integer not null default 0,
  current_version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_user_created_idx
  on public.books (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.book_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  version integer not null,
  title text not null,
  dedication text,
  pages jsonb not null,
  prompt_version text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  image_count integer not null default 0,
  generation_job_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (book_id, version),
  unique (generation_job_id)
);

create index if not exists book_versions_book_idx
  on public.book_versions (book_id, version desc);

alter table public.books enable row level security;
alter table public.book_versions enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
