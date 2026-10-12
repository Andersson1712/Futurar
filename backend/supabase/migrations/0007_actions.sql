-- SPEC-023: dynamic actions/options catalog with per-profile permissions.
-- The four legacy student_* tables stay read-only for rollback; the backend
-- owns the new model and the wizard reads it through the options adapter.

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  code text not null,
  label text not null,
  icon text not null default 'widgets',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, code)
);

create table if not exists public.action_options (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
  code text not null,
  label text not null,
  icon text not null default 'category',
  option_type text not null default 'list'
    check (option_type in ('list', 'image', 'text')),
  max_enabled integer not null default 4,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action_id, code)
);

create table if not exists public.action_option_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.action_options (id) on delete cascade,
  label text not null,
  icon text not null default 'star',
  level integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_option_items_option_idx
  on public.action_option_items (option_id, level, sort_order);

create table if not exists public.profile_actions (
  profile_id uuid not null references public.students (id) on delete cascade,
  action_id uuid not null references public.actions (id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, action_id)
);

create table if not exists public.profile_option_items (
  profile_id uuid not null references public.students (id) on delete cascade,
  item_id uuid not null references public.action_option_items (id) on delete cascade,
  is_enabled boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);

alter table public.actions enable row level security;
alter table public.action_options enable row level security;
alter table public.action_option_items enable row level security;
alter table public.profile_actions enable row level security;
alter table public.profile_option_items enable row level security;

-- Seed the three actions for every existing teacher (idempotent).
insert into public.actions (teacher_id, code, label, icon, sort_order)
select distinct s.teacher_id, a.code, a.label, a.icon, a.sort_order
from public.students s
cross join (
  values
    ('create', 'Crear Cuento', 'auto_stories', 1),
    ('library', 'Mi Biblioteca', 'library_books', 2),
    ('design', 'Diseñar', 'brush', 3)
) as a (code, label, icon, sort_order)
on conflict (teacher_id, code) do nothing;

-- Seed the four create-story options.
insert into public.action_options (action_id, code, label, icon, sort_order)
select act.id, o.code, o.label, o.icon, o.sort_order
from public.actions act
cross join (
  values
    ('protagonist', 'Protagonista', 'face', 1),
    ('scenario', 'Escenario', 'landscape', 2),
    ('mission', 'Misión', 'flag', 3),
    ('style', 'Estilo Visual', 'palette', 4)
) as o (code, label, icon, sort_order)
where act.code = 'create'
on conflict (action_id, code) do nothing;

-- Backfill items deduped per teacher + option (skips options that already have items).
insert into public.action_option_items (option_id, label, icon, level, sort_order)
select opt.id, d.label, d.icon, 1,
       row_number() over (partition by opt.id order by d.created_at, d.label)
from (
  select distinct on (teacher_id, code, label)
    teacher_id, code, label, icon, created_at
  from (
    select s.teacher_id, 'protagonist' as code, p.label, p.icon, p.created_at
    from public.student_protagonists p
    join public.students s on s.id = p.student_id
    union all
    select s.teacher_id, 'scenario', sc.label, sc.icon, sc.created_at
    from public.student_scenarios sc
    join public.students s on s.id = sc.student_id
    union all
    select s.teacher_id, 'mission', m.label, m.icon, m.created_at
    from public.student_missions m
    join public.students s on s.id = m.student_id
    union all
    select s.teacher_id, 'style', st.label, st.icon, st.created_at
    from public.student_styles st
    join public.students s on s.id = st.student_id
  ) legacy
  order by teacher_id, code, label, created_at
) d
join public.actions act
  on act.teacher_id = d.teacher_id and act.code = 'create'
join public.action_options opt
  on opt.action_id = act.id and opt.code = d.code
where not exists (
  select 1 from public.action_option_items existing
  where existing.option_id = opt.id
);

-- Backfill per-profile item enablement (only enabled legacy rows).
insert into public.profile_option_items (profile_id, item_id, is_enabled)
select distinct s.id, it.id, true
from public.student_protagonists p
join public.students s on s.id = p.student_id
join public.actions act
  on act.teacher_id = s.teacher_id and act.code = 'create'
join public.action_options opt
  on opt.action_id = act.id and opt.code = 'protagonist'
join public.action_option_items it
  on it.option_id = opt.id and it.label = p.label
where coalesce(p.is_enabled, true)
on conflict (profile_id, item_id) do nothing;

insert into public.profile_option_items (profile_id, item_id, is_enabled)
select distinct s.id, it.id, true
from public.student_scenarios sc
join public.students s on s.id = sc.student_id
join public.actions act
  on act.teacher_id = s.teacher_id and act.code = 'create'
join public.action_options opt
  on opt.action_id = act.id and opt.code = 'scenario'
join public.action_option_items it
  on it.option_id = opt.id and it.label = sc.label
where coalesce(sc.is_enabled, true)
on conflict (profile_id, item_id) do nothing;

insert into public.profile_option_items (profile_id, item_id, is_enabled)
select distinct s.id, it.id, true
from public.student_missions m
join public.students s on s.id = m.student_id
join public.actions act
  on act.teacher_id = s.teacher_id and act.code = 'create'
join public.action_options opt
  on opt.action_id = act.id and opt.code = 'mission'
join public.action_option_items it
  on it.option_id = opt.id and it.label = m.label
where coalesce(m.is_enabled, true)
on conflict (profile_id, item_id) do nothing;

insert into public.profile_option_items (profile_id, item_id, is_enabled)
select distinct s.id, it.id, true
from public.student_styles st
join public.students s on s.id = st.student_id
join public.actions act
  on act.teacher_id = s.teacher_id and act.code = 'create'
join public.action_options opt
  on opt.action_id = act.id and opt.code = 'style'
join public.action_option_items it
  on it.option_id = opt.id and it.label = st.label
where coalesce(st.is_enabled, true)
on conflict (profile_id, item_id) do nothing;

-- Backfill profile_actions from student_settings.modules (default enabled).
insert into public.profile_actions (profile_id, action_id, is_enabled)
select s.id, act.id,
       case act.code
         when 'create' then coalesce((ss.modules ->> 'create')::boolean, true)
         when 'library' then coalesce((ss.modules ->> 'library')::boolean, true)
         when 'design' then coalesce((ss.modules ->> 'design')::boolean, true)
         else true
       end
from public.students s
left join public.student_settings ss on ss.student_id = s.id
join public.actions act on act.teacher_id = s.teacher_id
on conflict (profile_id, action_id) do nothing;

-- The legacy student_* tables are now read-only: the backend serves the new
-- model and this migration only reads them for the one-time backfill.
