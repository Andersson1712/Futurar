# 0003 — Async generation jobs with SSE and an inline|bullmq queue driver

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-006/007)

## Context

Book generation is slow and must survive retries, show progress and stay
idempotent. Redis may not be available in every environment (dev/CI).

## Decision

- Model generation as jobs persisted in Supabase (with an in-memory fallback),
  retried 3x with exponential backoff behind a circuit breaker.
- Accept `Idempotency-Key` on `POST /ai/books/generate`.
- Stream progress to the client with **SSE** (`GET /ai/jobs/:id/events`, header
  auth) plus a polling fallback.
- Select the queue with `QUEUE_DRIVER=inline|bullmq`; `bullmq` uses `REDIS_URL`.

## Consequences

- Positive: works without Redis in dev/CI; resilient to provider failures;
  clients get live progress.
- Negative: BullMQ needs a Redis ping and `maxRetriesPerRequest: null`; SSE auth
  uses headers rather than cookies.
