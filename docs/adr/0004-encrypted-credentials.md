# 0004 — Per-teacher encrypted AI credentials

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-020)

## Context

Different teachers/foundations may bring their own Gemini key, and a single
shared env key is not enough for multi-tenant operation.

## Decision

- Store per-teacher credentials in `ai_credentials`, encrypted with
  **AES-256-GCM** using `AI_SECRETS_MASTER_KEY` (base64, 32 bytes).
- Use an async, tenant-aware `SecretProvider` (DB first, env fallback) and cache
  provider clients by key hash.
- The API returns **metadata only**, never the full key. Rotation works without
  downtime. Feature flag `AI_CREDENTIALS_ENABLED` defaults to `false`.

## Consequences

- Positive: secret isolation per teacher; the env key remains a dev fallback.
- Negative: managing the master key is an operational responsibility; a KMS
  adapter is a future step.
