# Alert thresholds (SPEC-027)

No alert delivery exists in this repo yet (no PagerDuty/Grafana). These
thresholds define WHAT to alert on once a sink exists; the counters below
are already exposed at `GET /api/v1/metrics` (resets on restart).

## Suggested rules

| Signal | Threshold | Meaning |
|---|---|---|
| `generation.failed / generation.jobs` | > 5% over 10 min | Provider or pipeline problem (quota, breaker, invalid output) |
| `generation.averageLatencyMs` | p95 > 60 s (see note) | Jobs piling up or provider slowdown |
| `requests.byStatus.5xx` rate | > 1% over 5 min | Backend instability (not provider errors, which are 4xx/5xx AiError by design — tune after baseline) |
| `generation.jobs` spike | > 3× 7-day average | Runaway client or abuse (check throttler + idempotency) |
| `generation.outputTokens` jump | > 2× baseline | Cost anomaly (model or limits regression) |
| `health.status == degraded` | > 2 min | Redis down while `QUEUE_DRIVER=bullmq` — generation queue stalls |

Note: `/metrics` currently exposes averages, not percentiles. A p95 rule
needs a histogram (prom-client follow-up) or log-based metrics. Until then,
use `averageLatencyMs` with a lower threshold as a coarse proxy.

## Correlation
Every alert should include the `x-correlation-id` from the failing
request/job so one id traces HTTP → queue → generation logs.
