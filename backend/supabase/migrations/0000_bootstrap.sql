-- FUTURAR bootstrap for a FRESH Supabase project (0000).
-- Run this FIRST (or use the combined futurar-migrations-all.sql) in the SQL editor.
--
-- Why: repo migrations 0001->0008 assume the legacy frontend-owned tables
-- (teachers, students, student_settings, student_protagonists/scenarios/
-- missions/styles, stories, usage_sessions) already exist. On a brand-new
-- project they don't, so 0003 fails with "relation public.student_settings
-- does not exist". This file creates them empty with the schema the app expects.
--
-- Everything below is IF NOT EXISTS, so re-running is safe.
--
-- Access model (same as the original project):
-- * The backend uses the service_role key and bypasses RLS.
-- * The frontend (anon key) still reads/writes teachers, stories and
--   usage_sessions directly, so those tables keep RLS DISABLED.
-- * students / student_settings / legacy option tables are backend-only and
--   get RLS enabled (service_role bypasses it).

create extension if not exists "pgcrypto";

-- 1. Teachers (row created by the frontend on signup; id = auth.users.id) ---
create table if not exists public.teachers (
  id uuid primary key,
  email text not null,
  name text not null,
  role text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Students / profiles (backend-owned since SPEC-021) ----------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  name text not null,
  age integer,
  avatar_icon text not null default 'person',
  notes text,
  birthdate date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_teacher_idx on public.students (teacher_id);

create table if not exists public.student_settings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students (id) on delete cascade,
  content_filter_level text,
  font_size text,
  max_stories_per_day integer,
  preferred_protagonists text[],
  preferred_sceneries text[],
  preferred_styles text[],
  scan_columns integer,
  scan_interval integer,
  sound_enabled boolean,
  theme text,
  updated_at timestamptz not null default now(),
  voice_feedback boolean
);

-- 3. Legacy per-student option tables (read-only since SPEC-023) -------------
create table if not exists public.student_protagonists (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  label text not null,
  icon text not null default 'star',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_scenarios (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  label text not null,
  icon text not null default 'star',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_missions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  label text not null,
  icon text not null default 'star',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_styles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  label text not null,
  icon text not null default 'star',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. Legacy stories + usage sessions (frontend reads/writes, anon key) -------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  protagonist text not null,
  scenery text not null,
  mission text not null,
  style text not null,
  content text,
  image_url text,
  type text,
  dedication_to text,
  dedication_reason text,
  dedication_position text,
  is_favorite boolean,
  created_at timestamptz not null default now()
);
create index if not exists stories_student_idx on public.stories (student_id);

create table if not exists public.usage_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  stories_created integer,
  total_interactions integer
);
create index if not exists usage_sessions_student_idx on public.usage_sessions (student_id);

-- 5. RLS: backend-only tables ON (service_role bypasses it) ------------------
alter table public.students enable row level security;
alter table public.student_settings enable row level security;
alter table public.student_protagonists enable row level security;
alter table public.student_scenarios enable row level security;
alter table public.student_missions enable row level security;
alter table public.student_styles enable row level security;

-- 6. RLS: frontend legacy tables OFF ----------------------------------------
-- The frontend (anon key) reads/writes these directly, so RLS must stay off.
-- (Stated explicitly: if the tables pre-exist with RLS on and no policies,
-- inserts fail with 42501 and selects come back empty.) All three statements
-- are safe to re-run.
alter table public.teachers disable row level security;
alter table public.stories disable row level security;
alter table public.usage_sessions disable row level security;
