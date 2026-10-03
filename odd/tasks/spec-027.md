# SPEC-027 — Backend observability baseline

## Objective
Structured JSON logs with end-to-end correlation ID (HTTP → job →
generation), minimal metrics (latency, errors, tokens/usage, queue times),
public health check. No external infra invented.

## Why
Backend flies blind: 2 ad-hoc Nest Loggers, no request logs, no correlation,
no metrics (even though `generation-runner` exposes `result.usage`), no health
endpoint. Approved deps: `nestjs-pino` + `pino` (Context7-verified genReqId +
injectable PinoLogger). No prom-client yet; no OTel SDK (follow-up).

## Scope
- New `src/observability/`: correlation (genReqId honors `x-correlation-id`,
  UUID fallback, echo response header, propagate to `BookJobPayload`), metrics
  service (in-memory counters, reset-on-restart documented), health controller.
- Instrument `generation-runner.run` (latency/outcome/usage) + BullMQ
  `process()` (wait/process time, success/fail). Migrate 2 Loggers +
  `console.log` to PinoLogger. `LOG_LEVEL` via `validateEnv`.
- `GET /api/v1/health` public (degraded, never crash); `GET /api/v1/metrics`
  behind teacher auth (JSON).
- Docs: `docs/specs/SPEC-027.md`, `docs/ops/alerts.md` (thresholds only).
- Out: OTel SDK, persistent metrics, real alerting delivery.

## Tasks
- [x] 027-1 Deps (`nestjs-pino` 5.3.1, `pino` 10.4.0) + LoggerModule + LOG_LEVEL env
- [x] 027-2 Correlation ID end-to-end + tests (RED→GREEN)
- [x] 027-3 Metrics service + endpoint + runner/queue instrumentation + tests
- [x] 027-4 Health endpoint + tests (redis down → degraded)
- [x] 027-5 Migrate existing loggers; credential-redaction test
- [x] 027-6 Full verification (build/lint clean, 265 unit + 1 e2e) + docs
- [ ] 027-7 Push + PR to `dev` (needs user approval — publishing)

## Route
Delegated-direct unavailable in this runtime (provider refused on earlier
SPECs); proceeding direct-inline in bounded batches, disclosed here.

## Commits
- (pending)
