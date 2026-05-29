# API Health Check Verification — CMPAAA-553

**Date**: 2026-05-29
**Status**: ✅ Verified

## Endpoint

`GET /health` — Hono route at `src/main/api/routes/health.js`

- Public endpoint, no authentication required
- Returns HTTP 200 for `ok`/`degraded`, HTTP 503 for `unhealthy`

## Response Shape

```json
{
  "status": "ok|degraded|unhealthy",
  "version": "x.y.z",
  "ts": "ISO-8601",
  "uptimeMs": 12345,
  "memory": { "rss", "heapUsed", "heapTotal", "external" },
  "system": { "totalMem", "freeMem", "loadAvg", "cpus" },
  "ipc": { "calls", "errors", "avgLatencyMs" },
  "renderer": { "crashes", "unresponsive" },
  "app": { "startedAt", "uncaughtExceptions", "unhandledRejections" },
  "db": { "ok": true },
  "alerts": [],
  "uptime": {
    "uptimePercent": 100,
    "totalUptimeMs": 12345,
    "totalDowntimeMs": 0,
    "breakdown": { "okMs", "degradedMs", "unhealthyMs" },
    "lastStatusChange": "ok",
    "lastStatusChangeAt": "ISO-8601",
    "transitions": []
  }
}
```

## Alert Thresholds

| Alert ID | Severity | Condition |
|----------|----------|-----------|
| `high_heap` | warn | Heap usage > 85% |
| `high_ipc_error_rate` | error | IPC error rate > 5% (min 10 calls) |
| `high_ipc_latency` | warn | Avg IPC latency > 500ms (min 10 calls) |
| `low_system_memory` | warn | Free system memory < 10% |
| `high_cpu_load` | warn | Load avg per CPU > 2.0 |
| `db_unreachable` | error | SQLite `SELECT 1` fails |

## Status Classification

- **ok**: No alerts
- **degraded**: Warning-level alerts only
- **unhealthy**: At least one error-level alert → HTTP 503

## Uptime Tracking

- Tracks cumulative time per status (ok/degraded/unhealthy)
- `degraded` counts as uptime, not downtime
- Transition history capped at 100 internal, last 10 in response
- Periodic health tick every 30s via `startHealthLoop()`
- Telemetry integration for health metrics

## Test Results

```
✓ tests/health.test.js (30 tests) 7ms
✓ tests/health-endpoint.test.js (12 tests) 22ms

Test Files  2 passed (2)
Tests      42 passed (42)
```

### Coverage

- ✅ 200 response with all required fields
- ✅ No authentication required
- ✅ DB connectivity check (ok + unreachable paths)
- ✅ Version string format validation
- ✅ ISO timestamp validation
- ✅ Non-negative uptime
- ✅ Memory usage fields
- ✅ Alerts array shape
- ✅ Status classification consistency
- ✅ 503 on DB failure with error details
- ✅ Uptime stats with percentage and breakdown
- ✅ Content-Type application/json
- ✅ IPC metrics recording (calls, errors, avg latency)
- ✅ Status transitions with deduplication
- ✅ Cumulative time tracking per status
- ✅ Transition array capping (100 internal, 10 response)
- ✅ Alert threshold edge cases (heap, IPC error rate, system memory)
