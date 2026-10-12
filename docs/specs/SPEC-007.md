# SPEC-007 — Job status streaming (SSE) with polling fallback

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 2 / EPIC 2.2
- Depends on: SPEC-006 (job repository + queue drivers)
- Blocks: SPEC-009 (frontend integration)

## Implementation notes
- `@Sse('jobs/:id/events')` returns an `Observable<MessageEvent>` built by
  `createJobStatusStream`: initial snapshot, 1 s polling, `distinctUntilChanged`
  on status+updatedAt, 15 s heartbeats, and completion on `completed`/`failed`
  or when the job disappears (`error` event with `NOT_FOUND`).
- Auth stays header-only (`SupabaseAuthGuard`); 404 is returned before opening
  the stream for unknown/foreign jobs.
- Verified live: SSE route registered in OpenAPI and 401 without a token.
- Frontend integration (SPEC-009) must use fetch-based streaming, not
  `EventSource`.

## Objective
Stream generation progress to authenticated clients over Server-Sent Events,
driver-agnostic (works with both inline and BullMQ), closing the stream on
terminal states, keeping `GET /ai/jobs/:id` as the polling fallback. No tokens
in URLs.

## Decisions to confirm
- **D1 SSE auth (recommended)**: standard `Authorization: Bearer` header via
  the existing `SupabaseAuthGuard`; the frontend must use fetch-based
  streaming (SPEC-009) because `EventSource` cannot send headers. Alternative:
  `?access_token=` query param for `EventSource` (tokens leak into logs).
- **D2 Stream mechanism (recommended)**: server-side polling of the
  `JobRepository` every 1 s, emitting only on change, with a heartbeat every
  15 s. Works for inline and BullMQ and needs no pub/sub. Alternative: Redis
  pub/sub events (more moving parts, only helps multi-instance fanout).
- **D3 Polling fallback (recommended)**: keep `GET /ai/jobs/:id` documented as
  the fallback; frontend chooses SSE first.

## Contract
```
GET /api/v1/ai/jobs/:id/events
Guards: throttler → AiEndpointsEnabledGuard → SupabaseAuthGuard
200 text/event-stream
  event: status
  data: <JobStatusDto JSON>        // initial snapshot + every change
  : heartbeat                      // comment every 15 s
Terminal: stream completes after status completed | failed
Errors: 401 UNAUTHORIZED, 404 NOT_FOUND (before opening), 503 when disabled
```
- Before opening the stream the job is resolved; unknown or foreign jobs
  return the `AiErrorDto` 404 envelope.
- If the job disappears mid-stream (TTL), emit `event: error` with
  `NOT_FOUND` and complete.
- `@Sse()` returning an `Observable<MessageEvent>`; client disconnect
  unsubscribes and stops polling.
- No cookies, no token in query strings.

## File impact (backend)
- New: `src/ai/application/job-status.stream.ts` (RxJS stream factory) + spec,
  `src/ai/ai-events.controller.ts` (or a `@Sse` method on `AiController`) +
  spec.
- Update: `src/ai/ai.module.ts` (provide the stream service),
  OpenAPI decorators (`@ApiProduces('text/event-stream')`), spec docs.
- No repository/queue changes.

## Acceptance criteria
1. Stream emits the initial `JobStatusDto`, then only changes, and completes
   after `completed`/`failed`.
2. Heartbeat comments are emitted during idle periods (~15 s).
3. Unknown/foreign job → 404 envelope before any event.
4. Guards enforced: 503 when AI disabled, 401 without token.
5. Unit tests with fake timers and a mocked repository cover: no-duplicate
   emission, heartbeat, terminal close, TTL error, unsubscribe stopping the
   poll.
6. `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint` green (no
   Redis required).

## Edge cases
Job completes between polls; TTL expiry mid-stream; client disconnects;
slow consumers (RxJS backpressure); proxies buffering (heartbeats keep the
connection alive); inline jobs completing before the first poll.

## Out of scope
BullMQ/Redis pub-sub fanout, multi-instance broadcast, frontend client
implementation (SPEC-009), correlation IDs (SPEC-027), WebSocket transport.

## Verification
`cd backend && npm run build && npm test && npm run test:e2e && npm run lint`;
manual: `curl -N -H "Authorization: Bearer <token>" .../ai/jobs/:id/events`.
