-- SPEC-020: encrypted per-tenant AI provider credentials.
-- The plaintext key never reaches the database; only AES-256-GCM payloads.

create table if not exists public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  tenant_id uuid,
  provider text not null check (provider in ('gemini')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_hint text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz
);

create index if not exists ai_credentials_owner_provider_idx
  on public.ai_credentials (owner_id, provider, status);

alter table public.ai_credentials enable row level security;

-- The backend uses the service-role key and bypasses RLS; no public policies.
