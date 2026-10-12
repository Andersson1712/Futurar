-- SPEC-021: profile modules, book complexity and birthdate.
-- Extends the existing frontend-owned tables; the backend becomes the owner.

alter table public.students
  add column if not exists birthdate date;

alter table public.student_settings
  add column if not exists modules jsonb not null
    default '{"create": true, "library": true, "design": true}',
  add column if not exists book_story_size text not null default 'medium'
    check (book_story_size in ('small', 'medium', 'large')),
  add column if not exists book_audience text not null default 'child'
    check (book_audience in ('child', 'teen', 'adult'));
