# SPEC-032 — Legacy stories backfill (migration 0013)

- Status: **implemented** (approved 2026-10-08; branch
  `feat/spec-032-legacy-migration`)
- Depends on: SPEC-008 (books schema, D6 punt), SPEC-021 (profiles ARE
  students rows), SPEC-022/0006 (book dedication/favorite columns)
- Follow-up (gated): remove the frontend legacy `stories` merge after the
  owner confirms backfill counts (otherwise rows show twice / vanish)

## Objective

One-time, re-runnable backfill of legacy frontend-owned `stories` into
canonical `books`/`book_versions`, preserving ids, timestamps,
dedications and favorites. The `stories` table stays as rollback safety.

## Why

SPEC-008 D6 punted migration because books lacked dedication/favorite
fields. Migration 0006 added them, and profiles turned out to BE students
rows — so every legacy field now has a canonical home and the join is
trivial (`students.teacher_id` → owner, `student_id` → profile).

## Design

- Single migration `0013_legacy_stories_backfill.sql`, `IF NOT EXISTS`
  style idempotency (skip by id), original UUIDs kept for traceability.
- `dedication_position` values outside the books `CHECK` become NULL
  instead of failing the batch; NULL favorites become false; NULL
  timestamps become `now()`.
- Untitled stories and orphan rows (student gone) are SKIPPED by the
  migration and REPORTED by the verification queries below — the owner
  decides their fate, the script never deletes.
- Audit marker `prompt_version = 'legacy/v1'`, `model = 'legacy-import'`,
  `generation_job_id = NULL` so backfilled rows are always
  distinguishable from AI generations.
- Images are NOT copied to storage in v1; the legacy URL is preserved in
  `story_config.legacy_image_url` for a later storage pass.

## Owner verification (run in the SQL editor after 0013)

```sql
-- 1. Totals must match: stories (titled, with student) vs backfilled books.
select count(*) as stories_total from public.stories
 where title is not null and student_id is not null;
select count(*) as backfilled
  from public.book_versions where prompt_version = 'legacy/v1';

-- 2. Leftovers that 0013 skipped on purpose (review one by one):
select id, title, student_id from public.stories
 where title is null or student_id is null
    or not exists (select 1 from public.students s where s.id = stories.student_id);

-- 3. Per-student reconciliation (every row should show equal counts):
select s.student_id,
       count(*) as stories,
       count(b.id) as books
  from public.stories s
  left join public.books b on b.id = s.id
 group by s.student_id;

-- 4. Spot check one migrated row (config, dedication, favorite, dates):
select b.id, b.title, b.dedication_to, b.is_favorite,
       b.created_at, v.story_config
  from public.books b
  join public.book_versions v on v.book_id = b.id and v.version = 1
 where v.prompt_version = 'legacy/v1'
 order by b.created_at desc limit 5;
```

Only when query 2 is reviewed and query 3 shows equal counts everywhere,
approve the follow-up that removes the frontend legacy merge.

## File impact

- New: `backend/supabase/migrations/0013_legacy_stories_backfill.sql`,
  `docs/specs/SPEC-032.md`, `odd/tasks/spec-032.md`.
- Touched: `Migraciones-Futurar.txt` (desktop row 13), `MEMORY.md`.
- Out: dropping `stories`, storage copy of legacy images, frontend merge
  removal (gated follow-up).

## Versions

Plain SQL (`jsonb_build_object/array`, `coalesce`, `case`) on the existing
Supabase Postgres. No new dependency, no API to validate.
