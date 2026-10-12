-- SPEC-022: profile contacts, book dedications and favorites.

create table if not exists public.profile_contacts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.students (id) on delete cascade,
  name text not null,
  relationship text not null,
  dedication_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_contacts_profile_idx
  on public.profile_contacts (profile_id, name);

alter table public.profile_contacts enable row level security;

alter table public.books
  add column if not exists dedication_to text,
  add column if not exists dedication_reason text,
  add column if not exists dedication_position text
    check (dedication_position in ('start', 'end')),
  add column if not exists is_favorite boolean not null default false;

create index if not exists books_user_favorite_idx
  on public.books (user_id, created_at desc)
  where deleted_at is null and is_favorite = true;
