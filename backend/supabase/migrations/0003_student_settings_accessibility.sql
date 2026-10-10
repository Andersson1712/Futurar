-- SPEC-015: per-profile accessibility settings.
-- Reuses the existing font_size column; frontend owns this table until SPEC-021.

alter table public.student_settings
  add column if not exists sweep_enabled boolean not null default true,
  add column if not exists input_mode text not null default 'scan'
    check (input_mode in ('scan', 'switch', 'mouse', 'touch')),
  add column if not exists line_height text not null default 'normal'
    check (line_height in ('normal', 'relaxed', 'loose')),
  add column if not exists bold_titles boolean not null default false,
  add column if not exists uppercase boolean not null default false,
  add column if not exists voice_gender text not null default 'auto'
    check (voice_gender in ('female', 'male', 'auto'));

-- Guarded: re-running must not fail when the constraint already exists
-- (plain ADD CONSTRAINT has no IF NOT EXISTS in Postgres).
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'student_settings'
      AND n.nspname = 'public'
      AND c.conname = 'student_settings_font_size_check'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    ALTER TABLE public.student_settings
      ADD CONSTRAINT student_settings_font_size_check
      CHECK (font_size IS NULL OR font_size IN ('normal', 'large', 'xlarge'));
  END IF;
END
$$;
