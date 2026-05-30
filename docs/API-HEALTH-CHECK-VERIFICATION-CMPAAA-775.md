# API Health Check Verification — CMPAAA-775

**Date**: 2026-05-30
**Status**: ✅ All checks pass

## Summary

Verified the `/health` API endpoint responds correctly via both unit tests and real HTTP smoke test.

## Test Results

### Unit Tests (vitest)
- `tests/health.test.js` — 32 tests passed
- `tests/health-endpoint.test.js` — 12 tests passed
- **Total: 44/44 passed**

### HTTP Smoke Test
- `scripts/api-smoke-test.js` — 23/23 checks passed
- Server starts on random port, hits `/health` via real HTTP
- Returns HTTP 200, Content-Type `application/json`

## Endpoint Contract

`GET /health` returns:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `ok` / `degraded` / `unhealthy` | Classified from alerts |
| `version` | string (semver) | From package.json |
| `ts` | ISO 8601 | Current timestamp |
| `uptimeMs` | number | Process uptime |
| `memory` | object | rss, heapUsed, heapTotal, external |
| `system` | object | totalMem, freeMem, loadAvg, cpus |
| `ipc` | object | calls, errors, avgLatencyMs |
| `renderer` | object | crashes, unresponsive counts |
| `app` | object | startedAt, uncaughtExceptions, unhandledRejections |
| `db` | object | ok (bool), error (if failed) |
| `alerts` | array | Active alerts |
| `uptime` | object | uptimePercent, breakdown, transitions |

## Alert Thresholds

| Alert ID | Severity | Trigger |
|----------|----------|---------|
| `high_heap` | warn | heap usage > 85% |
| `high_ipc_error_rate` | error | IPC error rate > 5% |
| `low_system_memory` | warn | free memory < 10% |
| `high_cpu_load` | warn | load per CPU > 2.0 |
| `high_ipc_latency` | warn | avg latency > 500ms |
| `db_unreachable` | error | DB query throws |

## HTTP Status Codes

- **200** — status is `ok` or `degraded`
- **503** — status is `unhealthy` (any error-level alert)

## Uptime Tracking

- Tracks cumulative time per status (ok/degraded/unhealthy)
- `degraded` counts as uptime, not downtime
- Transitions array capped at 100 internally, 10 in API response
