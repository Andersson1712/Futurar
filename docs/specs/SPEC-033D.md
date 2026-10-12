# SPEC-033D — Per-tenant, provider-aware AI credential resolution

- Status: **approved** (split out of SPEC-033B; owner approved 2026-10-09)
- Phase: 9 / EPIC 9.5
- Depends on: SPEC-020 (encrypted credentials), SPEC-033 (OpenRouter provider)
- Blocks: SPEC-033B per-teacher OpenRouter key usage

## Objective

Make secret resolution provider-aware so a teacher's own `openrouter` key
stored in `ai_credentials` is actually used, and widen the typed provider
surface to `gemini | openrouter` so saving and reading an OpenRouter key is
first-class in the API, env validation and Swagger — not a runtime-only
string that the typed layer denies.

## Why

SPEC-033 added OpenRouter as a provider and `0010_openrouter.sql` widened
the DB CHECK, but the secret layer still resolves tenant keys only for
Gemini. A teacher can persist an OpenRouter key that never reaches the
OpenRouter client, and the env/Swagger surface still advertises only
`gemini`. This is an independent defect: it can ship, be reviewed and be
tested on its own, and it unblocks per-teacher OpenRouter keys for 033B.

## Current behavior (audit)

- `secrets/credential-secret.provider.ts:18` only shortcuts tenant lookup
  for `GEMINI_API_KEY`; `OPENROUTER_API_KEY` falls through to env.
- `secrets/credential-resolver.ts:19` `findActiveKey(tenantId)` takes no
  provider argument.
- `secrets/credential.repository.ts:5` `CredentialProvider = 'gemini'`.
- `config/env.validation.ts:15` `AI_PROVIDERS = ['gemini']`.
- `ai-credentials.controller.ts:55,71` `@ApiParam enum ['gemini']`.
- `ai-credentials.service.ts:14` already accepts `['gemini','openrouter']`
  at runtime (string list) → the DB path works, the typed surface lies.

## Decisions

- **D1 Resolution (recommended)**: extend the secret layer to resolve by
  `(tenantId, provider, secretName)`; both `GEMINI_API_KEY` and
  `OPENROUTER_API_KEY` consult `ai_credentials` first, then env.
- **D2 Union widening (recommended)**: one shared provider union
  (`'gemini' | 'openrouter'`) reused by the repository type, `AI_PROVIDERS`,
  the service and the controller `@ApiParam` enum.
- **D3 Migration**: none expected — `0010_openrouter.sql` already widened
  the DB CHECK. Verify before coding; add a migration only if the audit
  proves otherwise.
- **D4 Caching (recommended)**: keep the per-key-hash cache; include the
  provider in the cache key so two providers cannot collide.

## Contract

- No HTTP contract change. `PUT /ai/credentials/:provider` accepts
  `openrouter`; `GET` returns it; the Swagger enum reflects both values.
- Internal: `SecretProvider` / resolver gain a provider dimension; the
  OpenRouter client receives the per-tenant resolved key.

## File impact

- `secrets/credential-secret.provider.ts`, `secrets/credential-resolver.ts`,
  `secrets/credential.repository.ts`, `secrets/secret-provider.ts`,
  `secrets/supabase-credential.repository.ts`,
  `ai-credentials.controller.ts`, `ai-credentials.service.ts`,
  `config/env.validation.ts`, the shared provider-union constant, and the
  matching `*.spec.ts`.
- Out: model selection (033B), budgets (033C).

## Acceptance criteria

- [x] Saving an `openrouter` key via the API persists and returns it in
  metadata (test).
- [x] With `OPENROUTER_ENABLED=true` and a per-tenant OpenRouter key, a
  generation uses that key (unit test with a fake resolver); with no row
  it falls back to env (unchanged).
- [x] Gemini path unchanged (existing credential tests green).
- [x] Backend `npm test`, `npm run test:e2e`, `npm run build`,
  `npm run lint` green. (On Windows the `npm test` / `test:e2e` scripts fail
  at the cmd.exe shell because of their POSIX `NODE_OPTIONS=` prefix; the same
  Jest runs pass via `npx jest`.)

## Edge cases

- Both provider keys present → each secret resolves its own provider.
- Row `status='revoked'` / inactive → env fallback.
- Decryption failure → loud error; never a silent env fallback that hides
  a broken key.
- Unknown provider value → 400, not a runtime string.

## Out of scope

Model selection UI (033B), tenant budgets (033C), key rotation UX changes,
KMS/HSM integration (future).

## Verification

```bash
# backend
npm test
npm run test:e2e
npm run build
npm run lint
```

## Versions

No new dependency. Same pins as SPEC-033 (Nest 12.x, TS `^6.0.3`,
Jest `^30.0.0`, Node `>=20.19.0`).
