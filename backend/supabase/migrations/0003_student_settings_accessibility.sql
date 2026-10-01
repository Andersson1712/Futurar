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

alter table public.student_settings
  add constraint student_settings_font_size_check
  check (font_size is null or font_size in ('normal', 'large', 'xlarge'));
