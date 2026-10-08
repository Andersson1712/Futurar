-- SPEC-032: backfill legacy frontend-owned stories into books/book_versions.
-- Run AFTER 0002 and 0006. Safe to re-run (idempotent by id).
-- The stories table is NOT dropped here: it stays as rollback safety until
-- the owner confirms counts and the frontend legacy merge is removed.
--
-- Mapping:
--   books.id            = stories.id (same UUID, traceable)
--   books.user_id       = students.teacher_id (profiles ARE students rows)
--   books.profile_id    = stories.student_id
--   dedication_position = only 'start'/'end' survive (books CHECK); other
--                         values become NULL rather than failing the batch
--   is_favorite         = NULL becomes false
--   timestamps          = preserved from the legacy row
--   book_versions       = version 1, story_config carries the legacy brief +
--                         legacy_story_id + legacy_image_url, pages = single
--                         page, prompt_version 'legacy/v1', model
--                         'legacy-import', generation_job_id NULL
-- Images are NOT copied to storage in v1: the legacy URL is preserved in
-- story_config.legacy_image_url for a later storage pass.

-- 1. Books (skip titled stories already present; join drops orphans whose
--    student row is gone — those are reported by the verification queries).
insert into public.books (
  id, user_id, profile_id, title,
  page_count, current_version,
  dedication_to, dedication_reason, dedication_position, is_favorite,
  created_at, updated_at
)
select
  s.id,
  st.teacher_id,
  s.student_id,
  s.title,
  1,
  1,
  s.dedication_to,
  s.dedication_reason,
  case when s.dedication_position in ('start', 'end')
    then s.dedication_position end,
  coalesce(s.is_favorite, false),
  coalesce(s.created_at, now()),
  coalesce(s.created_at, now())
from public.stories s
join public.students st on st.id = s.student_id
where s.title is not null
  and not exists (select 1 from public.books b where b.id = s.id);

-- 2. Book versions (one v1 per backfilled book).
insert into public.book_versions (
  book_id, version, title, dedication,
  story_config, pages,
  prompt_version, model,
  input_tokens, output_tokens, image_count,
  generation_job_id, created_by, created_at
)
select
  s.id,
  1,
  s.title,
  s.dedication_to,
  jsonb_build_object(
    'protagonist', s.protagonist,
    'scenery', s.scenery,
    'mission', s.mission,
    'style', s.style,
    'type', s.type,
    'legacy_story_id', s.id,
    'legacy_image_url', s.image_url
  ),
  jsonb_build_array(jsonb_build_object(
    'pageNumber', 1,
    'content', coalesce(s.content, '')
  )),
  'legacy/v1',
  'legacy-import',
  null, null, 0,
  null,
  st.teacher_id,
  coalesce(s.created_at, now())
from public.stories s
join public.students st on st.id = s.student_id
where s.title is not null
  and not exists (
    select 1 from public.book_versions v
    where v.book_id = s.id and v.version = 1
  );
