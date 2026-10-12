-- SPEC-034: the database now owns teacher identity rows.
--
-- Why: the frontend must not call Supabase for data (AGENTS.md; SPEC-010/021).
-- The old flow inserted into public.teachers from the browser right after
-- signUp, which breaks with email confirmation enabled (no session, no INSERT).
-- A trigger on auth.users creates the row for every signup path instead:
-- the app, an invite or the dashboard. Rows are inert, so RLS stays disabled
-- (owner decision D4).
--
-- Re-runnable like every other migration in this repo.

create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teachers (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'teacher'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_teacher();

-- Backfill rows for users created before the trigger existed.
insert into public.teachers (id, email, name, role)
select id, email, coalesce(raw_user_meta_data->>'name', email), 'teacher'
from auth.users
on conflict (id) do nothing;
