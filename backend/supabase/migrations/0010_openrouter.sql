-- SPEC-033: OpenRouter as second AI provider + per-response cost recording.
-- Applied by the owner (same rule as previous migrations).

-- 1. Widen the ai_credentials provider check (gemini -> gemini, openrouter).
-- The inline CHECK got an auto-generated name, so drop it by lookup.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'ai_credentials'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%provider%gemini%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.ai_credentials DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'ai_credentials'
      AND n.nspname = 'public'
      AND c.conname = 'ai_credentials_provider_check'
  ) THEN
    ALTER TABLE public.ai_credentials
      ADD CONSTRAINT ai_credentials_provider_check
      CHECK (provider IN ('gemini', 'openrouter'));
  END IF;
END
$$;

-- 2. Per-response cost (USD) from OpenRouter `usage.cost`, recorded on the
-- job row and on each persisted version row. Recording-only (033C may
-- enforce budgets later).
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS cost_usd numeric;

ALTER TABLE public.book_versions
  ADD COLUMN IF NOT EXISTS cost_usd numeric;

ALTER TABLE public.design_versions
  ADD COLUMN IF NOT EXISTS cost_usd numeric;
