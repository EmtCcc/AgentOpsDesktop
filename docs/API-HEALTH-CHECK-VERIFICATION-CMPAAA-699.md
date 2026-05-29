# API Health Check Verification — CMPAAA-699

**Date**: 2026-05-30
**Status**: ✅ Verified

## Endpoint: GET /health

- **Route**: `GET /health` (public, no auth required)
- **Port**: 3967 (default, configurable via `API_PORT`)
- **HTTP Status**: 200 (ok/degraded), 503 (unhealthy)

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| `tests/health.test.js` | 14 | ✅ All pass |
| `tests/health-endpoint.test.js` | 12 | ✅ All pass |
| `tests/monitor.test.js` | 48 | ✅ All pass |
| `tests/integration/monitor.integration.test.js` | 2 | ✅ All pass |
| `scripts/api-smoke-test.js` | 24 | ✅ All pass |
| **Total** | **100** | **✅ All pass** |

## Response Shape (verified)

```json
{
  "status": "ok|degraded|unhealthy",
  "version": "<semver>",
  "ts": "<ISO-8601>",
  "uptimeMs": "<number>",
  "memory": { "rss", "heapUsed", "heapTotal", "external" },
  "system": { "totalMem", "freeMem", "loadAvg", "cpus" },
  "ipc": { "calls", "errors", "avgLatencyMs" },
  "renderer": { "crashes", "unresponsive" },
  "app": { "startTime", "uncaughtExceptions", "unhandledRejections" },
  "db": { "ok", "latencyMs" },
  "alerts": [ { "id", "severity", "detail" } ],
  "uptime": { "uptimePercent", "totalUptimeMs", "totalDowntimeMs", "breakdown", "transitions" }
}
```

## Alert Thresholds

| Metric | Threshold | Alert ID |
|--------|-----------|----------|
| Heap usage | > 85% | `high_heap` |
| IPC error rate | > 5% | `high_ipc_error_rate` |
| IPC avg latency | > 500ms | `high_ipc_latency` |
| Free system memory | < 10% | `low_system_memory` |
| Load avg per CPU | > 2.0 | `high_cpu_load` |

## Status Classification

- **ok**: No alerts
- **degraded**: Warning-level alerts only
- **unhealthy**: Any error-level alert → returns HTTP 503

## Health Loop

- Interval: 30s (configurable)
- Started on `app.whenReady()`, stopped on `before-quit`
- Each cycle: `getHealth()` → `checkAlerts()` → `classifyStatus()` → `recordStatusChange()`

## Uptime Tracking

- Tracks cumulative time in each status (ok/degraded/unhealthy)
- Transitions log capped at 100 entries
- Returns `uptimePercent` (0-100) with breakdown per status
