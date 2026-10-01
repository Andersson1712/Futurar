# SPEC-020 — Admin API-key management with encryption and rotation

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D6 as recommended)
- Phase: 6 / EPIC 6.1
- Depends on: SPEC-002 (SecretProvider), SPEC-008 (Supabase), SPEC-019 (CI)
- Blocks: SPEC-021 (profiles), SPEC-030 (cloud TTS evaluation)

## Implementation notes
- Encryption: AES-256-GCM with `node:crypto` and `AI_SECRETS_MASTER_KEY`
  (base64 32 bytes, `parseMasterKey` rejects anything else); per-record random
  IV + auth tag; tampered payloads fail closed. A `CryptoService` seam keeps a
  future KMS adapter pluggable.
- Storage: `ai_credentials` (migration `0004_ai_credentials.sql`) with an
  in-memory fallback; `save` stores the new row first and only then revokes the
  previous one, so rotation has no downtime.
- Resolution: `SecretProvider` is now async and tenant-aware; a
  `CredentialSecretProvider` chains the stored credential (decrypted by
  `CredentialResolver`) and the env fallback. `GeminiClientProvider` replaces
  the boot singleton and caches clients by key hash, so rotations apply without
  restarts; ports gained `tenantId` and the runner passes `job.userId`.
- API: `GET/PUT/DELETE /api/v1/ai/credentials` behind Supabase auth returns
  metadata only (provider, hint, status, dates), 400 on invalid key/provider,
  404 on revoke without credential and 503 when disabled. Nothing logs or
  returns the plaintext key.
- Flag: `AI_CREDENTIALS_ENABLED` (default false) keeps the env path unchanged;
  when true the boot requires Supabase plus a valid master key.
- UI: `ApiKeyPanel` (new tab in the teacher panel) with masked input, hint,
  rotate/revoke and clear messages; if the session is missing it explains that
  sign-in is required. Teacher-panel auth gating itself belongs to SPEC-021.
- Tests: backend **190** (crypto, repositories, chain, client provider, service,
  controller, env) and frontend **78** (service + panel with MSW).

## Objective
Let each foundation/teacher store their own Gemini key from the teacher panel,
encrypted server-side, with rotation and without ever returning the key.
Today the only key path is `GEMINI_API_KEY` in the backend environment and the
legacy `ai_config` table still exists to be purged.

## Current state
- `EnvSecretProvider` reads `GEMINI_API_KEY`; `createGeminiClient` builds one
  singleton client at boot; ports have no tenant context.
- `teachers.role` exists; there is no organization/tenant model.
- Legacy `ai_config` was frontend-owned (SPEC-001) and must be purged by the
  owner.

## Decisions to confirm
- **D1 Encryption (recommended)**: AES-256-GCM with `node:crypto` and a 32-byte
  `AI_SECRETS_MASTER_KEY` (base64) env secret; per-record random IV + auth tag,
  key hint = last 4 chars. A `CryptoService` interface keeps a future KMS
  adapter pluggable. Alternative: add `libsodium`.
- **D2 Storage (recommended)**: new backend-owned `ai_credentials` table
  (migration `0004_ai_credentials.sql`) with in-memory fallback for dev/tests;
  legacy `ai_config` stays untouched and is purged by the owner.
- **D3 Tenant model (recommended)**: `owner_id` = authenticated teacher;
  nullable `tenant_id` (equal to owner today) reserved for multi-foundation.
  Alternative: full organizations model now.
- **D4 Feature flag (recommended)**: `AI_CREDENTIALS_ENABLED` (default false);
  when false the env-key path is unchanged. When true, boot requires Supabase +
  master key and generation resolves per-user credentials with env fallback.
- **D5 Access (recommended)**: any authenticated teacher manages their own
  credential; no admin-role gate yet (role checks need the profiles API).
- **D6 Key verification (recommended)**: format validation + `key_hint` on save;
  a real provider check (`verified_at`) is a later addition to avoid paying a
  Gemini call on every save.

## Contracts
```ts
interface CryptoService {
  encrypt(plain: string): EncryptedPayload;   // { ciphertext, iv, authTag }
  decrypt(payload: EncryptedPayload): string;
}

interface CredentialRepository {
  save(input: { ownerId: string; tenantId?: string; provider: 'gemini';
    encrypted: EncryptedPayload; keyHint: string }): Promise<CredentialMetadata>;
  findActive(ownerId: string, provider: 'gemini'): Promise<StoredCredential | undefined>;
  list(ownerId: string): Promise<CredentialMetadata[]>;
  revoke(ownerId: string, provider: 'gemini'): Promise<boolean>;
}

// SecretProvider stays the adapter-facing port; resolution is tenant-aware:
interface SecretProvider { get(name: SecretName, tenantId?: string): string | undefined; }
```
- Resolution chain: active stored credential for the tenant → env fallback
  (dev) → undefined. `GeminiClientProvider` caches clients by key hash and
  replaces the boot singleton; ports gain optional `tenantId` (the runner
  passes `job.userId`).
- API (auth + throttler, no AI flag): `GET /api/v1/ai/credentials` (metadata
  only), `PUT /api/v1/ai/credentials/gemini` (create/rotate; deactivate previous
  after the new row is stored), `DELETE /api/v1/ai/credentials/gemini` (revoke).
  Responses never include the key; errors use the `AiError` envelope.
- Teacher panel: "API Key" section with masked input, hint/updated metadata,
  save and revoke actions through `services/backendCredentials.ts`.

## File impact
- Backend new: `src/ai/secrets/{crypto.service.ts, credential.repository.ts,
  supabase-credential.repository.ts, in-memory-credential.repository.ts,
  credential-secret.provider.ts}`, `src/ai/ai-credentials.controller.ts` +
  DTOs, `supabase/migrations/0004_ai_credentials.sql`, specs.
- Backend update: `SecretProvider` signature, `EnvSecretProvider`,
  `gemini-client.factory.ts` → `GeminiClientProvider`, adapters (tenantId),
  `generation-runner.ts`, `ai.module.ts`, `env.validation.ts`, `.env.example`.
- Frontend new: `services/backendCredentials.ts` + tests; update
  `TeacherPanel.tsx` (+ i18n keys), MSW handlers.
- No new dependencies.

## Acceptance criteria
1. Crypto round-trip works and tampered ciphertext/IV fails closed; the master
   key is never logged or returned.
2. Saving a key stores ciphertext + hint; `GET` returns metadata only; the
   plaintext key never appears in responses, logs or the database.
3. Rotation keeps the old key active until the new row is stored, then revokes
   it; generation uses the new key without restart.
4. Resolution prefers the tenant credential and falls back to env; a revoked
   credential falls back or fails with `PROVIDER_UNAVAILABLE`.
5. `AI_CREDENTIALS_ENABLED=false` keeps today's behavior and tests green.
6. Teacher panel can save/rotate/revoke with accessible controls (labels,
   44px, i18n) and never displays the key.
7. Backend/frontend suites, coverage floor, E2E and CI stay green.

## Edge cases
Missing master key with the flag on (boot fails); malformed base64; short/long
keys; two rotations in a row; revoke without credential; Supabase down;
in-memory fallback in tests; legacy `ai_config` values ignored.

## Out of scope
Organizations/roles API (SPEC-021), provider verification call, KMS/HSM
integration (adapter ready), key sharing between teachers, frontend removal of
the legacy panel data access (SPEC-021).

## Verification
Backend `build/lint/test/e2e`; frontend `test/test:coverage/test:e2e/typecheck/
build/check:supabase`; manual: save a key, generate, rotate, revoke.
