# SPEC-032 — Legacy stories backfill (migration 0013)

## Objective
One-time, re-runnable backfill of legacy frontend-owned `stories` rows into
canonical `books`/`book_versions`, so the library can drop its read-only
legacy merge. The `stories` table stays as rollback safety; it is NOT dropped
here.

## Why
SPEC-008 D6 deliberately punted migration ("existing stories rows are not
migrated"). Since then books gained dedications/favorites (SPEC-022/0006),
so every legacy field now has a canonical home. After this backfill + owner
verification, the frontend legacy merge is removed in a gated follow-up
(otherwise backfilled rows would show twice, or unmigrated rows vanish).

## Scope
- New migration `0013_legacy_stories_backfill.sql` (books + book_versions
  inserts, idempotent by id, original ids/timestamps preserved,
  `legacy/v1` audit marker). Images: legacy URL preserved in
  `story_config.legacy_image_url`, no storage copy in v1.
- `docs/specs/SPEC-032.md` + verification queries for the owner.
- Out: dropping `stories`, storage copy of legacy images, removing the
  frontend legacy merge (gated follow-up after owner confirms counts).

## Mapping (stories → books)
- `books.id` = `stories.id` (same UUID, traceable)
- `books.user_id` = `students.teacher_id` (join on `student_id`)
- `books.profile_id` = `stories.student_id` (profiles ARE students rows)
- title, dedication_to/reason/position (non-conforming → NULL),
  is_favorite (NULL → false), created_at/updated_at preserved
- `book_versions`: version 1, story_config {protagonist, scenery, mission,
  style, type, legacy_story_id, legacy_image_url}, pages [{pageNumber 1,
  content}], prompt_version `legacy/v1`, model `legacy-import`,
  generation_job_id NULL, created_by = teacher

## Tasks
- [x] 032-1 Write `0013_legacy_stories_backfill.sql` (idempotent, guarded). Done: skips titled/orhpan rows by design, non-conforming dedication_position → NULL, legacy audit marker.
- [x] 032-2 Owner verification queries (counts per student, orphans, sample). Done: 4 queries in docs/specs/SPEC-032.md.
- [x] 032-3 Docs (`docs/specs/SPEC-032.md`), desktop file row, MEMORY.md. Done.
- [ ] 032-4 Commits + push + PR to `dev` (needs user approval — publishing)
- [ ] 032-5 FOLLOW-UP (gated): after owner confirms counts, remove the frontend legacy `stories` merge (separate change, separate PR)

## Route
Direct-inline in bounded batches (delegation unavailable in this runtime,
disclosed since 029B). SQL only + docs; no backend/frontend code changes,
so no test-first cycle applies — verification is owner-run count queries.

## Acceptance
- 0013 runs clean on a copy of prod data; re-running changes nothing
- Every non-orphan, titled story has exactly one book + one version
- Verification queries documented; owner confirms counts before the
  merge-removal follow-up

## Commits (feat/spec-032-legacy-migration)
- 8b9dd2d feat(migration): backfill legacy stories into books (0013) with SPEC-032 (032-1..3)
- 9d1fda8 docs(memory): sync post SPEC-032 task doc
