# SPEC-027 — Backend observability baseline

- Status: **implemented** (branch `feat/spec-027-observability`; pending PR to `dev`)
- Depends on: SPEC-002 (AiModule), SPEC-006/007 (jobs/SSE)
- Follow-ups: OpenTelemetry SDK, persistent metric series, real alert delivery

## Objective
Structured JSON logs with an end-to-end correlation id (HTTP → job →
generation), minimal metrics and a public health probe. No external
monitoring infrastructure invented.

## Design
- `nestjs-pino` + `pino` (Context7-verified; peers satisfy Nest 12 / pino 10).
  `genReqId` honors incoming `x-correlation-id`, else UUID (validated,
  max 128 chars). `LOG_LEVEL` env (`debug|info|warn|error`, default `info`)
  validated in `validateEnv`. Owner note: add `LOG_LEVEL=info` to
  `backend/.env.example`.
- Credential headers (`authorization`, `cookie`, `x-api-key`) redacted at the
  serializer level; covered by a test that asserts redaction while the
  correlation id stays visible.
- `CorrelationInterceptor` (global): echoes the correlation id on every
  response. `MetricsInterceptor` (global): counts by status family + latency.
- Correlation flows `controller → command.correlationId →
  queue.enqueue(jobId, correlationId) → BookJobPayload → runner.run` and lands
  in every job/generation log object. SSE keeps the job's correlation id in
  job logs (no new id per reconnect).
- `GenerationRunner` records `{ success, latencyMs, input/outputTokens }`
  (usage already came back in `result.usage`); both queue drivers forward the
  correlation id. The 2 legacy Nest `Logger`s and `console.log` migrated to
  `PinoLogger`.
- `GET /api/v1/health` public + `@SkipThrottle()`: `{ status, uptimeSeconds,
  redis, queueDriver }`; Redis down reports `degraded`, never crashes.
- `GET /api/v1/metrics` behind teacher auth: in-memory counters, reset on
  restart by design.
- Module pattern (learned): AiModule imports ObservabilityModule explicitly
  (repo convention, like Redis/Supabase modules); root-provider injection
  does NOT flow downward into imported modules, and `overrideProvider` only
  replaces existing registrations.

## Verification
- `npm run build`, `lint` clean; `npm test`: 53 suites / 265 passed;
  `test:e2e`: 1 passed.
- HTTP wiring spec: echo generated/honored ids, public health, metrics 401.
- Controller spec: public `/profiles/active` unaffected by new globals.

## File impact
New `src/observability/` (correlation-id, interceptors, logger.options,
metrics service/controller, health controller, module, specs). Touched:
`app.module`, `main.ts`, `ai.module`, `ai.controller`, `book-generation`
service/use-case, `generation-runner`, `book-persistence.service`, both
queues + port, `env.validation` (+spec), `package.json` (+2 deps).
