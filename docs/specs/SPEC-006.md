# SPEC-006 — Durable book-generation jobs: BullMQ, Redis, Supabase, retries

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 2 / EPIC 2.1
- Depends on: SPEC-005 (sync runner, validator, in-memory registry)
- Blocks: SPEC-007 (SSE), SPEC-008 (persistence)

## Implementation notes
- Uses raw `bullmq` + `ioredis` instead of `@nestjs/bullmq`: the driver must be
  conditional (no Redis in dev/CI) and `BullModule` cannot be imported
  conditionally at module-definition time. One dependency less than planned.
- `QUEUE_DRIVER=inline|bullmq`; defaults to bullmq only when `REDIS_URL` is
  set. Boot fails when bullmq is forced without Redis; Redis is pinged during
  BullMQ init (5 s timeout).
- Job payloads persist the original request (`request` jsonb), so workers can
  rebuild prompts; `profileId` stays optional for SPEC-021.
- The inline driver keeps SPEC-005 semantics (fail during the request, job
  marked `failed`); BullMQ marks `failed` only after the final attempt and
  relies on runner idempotency for retries.
- `IdempotencyStore` is now async; Redis and in-memory implementations share
  the same contract. Redis client is shared (queue + idempotency) and closed
  on shutdown.
- SQL migration: `backend/supabase/migrations/0001_generation_jobs.sql`.

## Objective
Replace inline in-memory generation with a durable, driver-based pipeline:
BullMQ + Redis in production, an inline driver for dev/CI (no Redis in this
environment), generation jobs persisted in Supabase, retries with exponential
backoff plus a circuit breaker, and the idempotency store moved to Redis when
available. HTTP contracts and `AiError` semantics do not change.

## Decisions to confirm
- **D1 Queue driver (recommended)**: `QUEUE_DRIVER=bullmq|inline`, defaulting
  to `bullmq` when `REDIS_URL` is set and `inline` otherwise. Production uses
  BullMQ; dev/CI keeps working without Redis. Alternative: BullMQ mandatory.
- **D2 Job persistence (recommended)**: `JobRepository` port with
  `SupabaseJobRepository` (table + SQL migration shipped in the repo) and
  `InMemoryJobRepository` fallback when Supabase is not configured.
  Alternative: keep in-memory only until SPEC-008.
- **D3 Retries + breaker (recommended)**: BullMQ `attempts: 3` with
  exponential backoff (5 s base); the job is marked `failed` only after the
  final attempt. In-app `CircuitBreaker` around the provider call: opens
  after 5 consecutive failures, blocks for 60 s, then half-open trial.
  No new deps.
- **D4 Idempotency store (recommended)**: `RedisIdempotencyStore` sharing the
  BullMQ connection when Redis is configured, else the current in-memory
  store. Replays keep returning the same `jobId`/response.
- **Deps to approve**: `@nestjs/bullmq` ^12.0.0, `bullmq` ^6.3.10,
  `ioredis` ^6.0.0 (BullMQ v6 declares `ioredis` as an optional peer).

## Contracts
```ts
interface JobRepository {                       // async: Supabase-backed
  create(input: { userId: string; profileId?: string }): Promise<JobRecord>;
  complete(jobId: string, book: GeneratedBookDto): Promise<void>;
  fail(jobId: string, error: AiErrorDto): Promise<void>;
  find(jobId: string, userId: string): Promise<JobRecord | undefined>;
}

interface JobQueue {
  enqueue(jobId: string): Promise<void>;
}

class GenerationRunner {                        // shared by both drivers
  run(jobId: string): Promise<void>;            // prompt → breaker → text
}                                               // → parse → validate → state

class CircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
```
- POST flow: validate input → `create` job (`queued`) → `enqueue` → return
  `{ jobId, status }` (inline completes during the request; BullMQ returns
  `queued`).
- BullMQ: queue `book-generation`, worker concurrency 1 (provider-friendly),
  `removeOnComplete/removeOnFail` retention; worker retries per D3 and the
  runner marks `failed` after the last attempt.
- Supabase table `generation_jobs` (`id uuid`, `user_id uuid`, `profile_id
  uuid null`, `status text`, `book jsonb null`, `error jsonb null`,
  `created_at`, `updated_at`), migration under
  `backend/supabase/migrations/0001_generation_jobs.sql`; rows map to
  camelCase `JobRecord`.
- Env: `QUEUE_DRIVER` (`inline|bullmq`), `REDIS_URL`; boot fails when
  `QUEUE_DRIVER=bullmq` without `REDIS_URL`. Logs include `jobId`/`userId`
  only (never prompts or keys).

## File impact (backend)
- New: `src/jobs/{job.repository.ts, in-memory-job.repository.ts,
  supabase-job.repository.ts, job-queue.port.ts, inline-job.queue.ts,
  bullmq-job.queue.ts, book-generation.processor.ts}`,
  `src/ai/application/{generation-runner.ts, circuit-breaker.ts}`,
  `src/common/idempotency/redis-idempotency.store.ts`,
  `supabase/migrations/0001_generation_jobs.sql`, specs.
- Update: `src/ai/application/book-generation.service.ts` (queue + repository),
  `src/ai/ai.module.ts` (driver factories), `src/config/env.validation.ts`
  (+`QUEUE_DRIVER`, `REDIS_URL`, cross-field), `src/config/swagger.ts` not
  needed, `.env.example`, remove the leftover `in-memory-job.registry.ts`.
- Tests mock Redis/Supabase/BullMQ: zero external services required.

## Acceptance criteria
1. Driver resolution: `REDIS_URL` set → BullMQ; otherwise inline; invalid
   `QUEUE_DRIVER` fails boot.
2. Inline driver preserves SPEC-005 behavior (service tests stay green).
3. BullMQ adapter enqueues `{ jobId }` with `attempts: 3` + exponential
   backoff and concurrency 1 (mocked `Queue`).
4. Worker marks the job `failed` only after the final attempt; transient
   failures retry (mocked processor tests).
5. `SupabaseJobRepository` issues the expected queries and maps rows
   (mocked client); migration file documents the required table.
6. Circuit breaker opens after 5 failures, rejects fast without calling the
   provider, and recovers after the cooldown.
7. `RedisIdempotencyStore` matches in-memory semantics (set/get/TTL) with a
   mocked ioredis; replay returns the same job.
8. `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint` green with
   no Redis or Supabase running.

## Edge cases
Redis unavailable at boot with `QUEUE_DRIVER=bullmq` (fail fast);
retry exhaustion; duplicate enqueue for the same jobId; worker crash mid-job
(BullMQ retries; runner is idempotent by jobId/status); breaker half-open;
job TTL/retention; Supabase table missing (clear logged error); `profileId`
absent; jobs older than 24 h.

## Out of scope
SSE streaming (SPEC-007), book/image persistence, audit and signed URLs
(SPEC-008), frontend integration (SPEC-009), multi-tenant keys and limits
(SPEC-020/021), LLM moderation.

## Verification
`cd backend && npm run build && npm test && npm run test:e2e && npm run lint`;
optional manual with a local Redis container: set `REDIS_URL` +
`QUEUE_DRIVER=bullmq` and verify enqueue/worker logs.
