# API Health Check Verification (CMPAAA-694, CMPAAA-704)

**Date:** 2026-05-30
**Status:** ✅ Verified
**Last verified:** 2026-05-30 by CMPAAA-704

## Endpoints

| Endpoint | Type | Auth | Behavior |
|---|---|---|---|
| `GET /health` | HTTP (Hono, port 3967) | Public | 200 ok/degraded, 503 unhealthy |
| `POST /api/adapters/:id/health-check` | HTTP | Token | Per-adapter connectivity check |
| `system:healthCheck` | Electron IPC | IPC only | System info + memory |
| `agents:health-check` | Electron IPC | IPC only | Per-agent process liveness |
| Periodic loop (30s) | Background | N/A | Logs status, sends telemetry |

## `GET /health` Response Shape

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
    "lastStatusChangeAt": 1234567890,
    "transitions": []
  }
}
```

## Alert Thresholds

| Alert ID | Severity | Condition |
|---|---|---|
| `high_heap` | warn | heapUsed / heapTotal > 85% |
| `high_ipc_error_rate` | error | errors / calls > 5% |
| `high_ipc_latency` | warn | avgLatencyMs > 500 |
| `low_system_memory` | warn | freeMem / totalMem < 10% |
| `high_cpu_load` | warn | loadAvg[i] / cpus > 2.0 |
| `db_unreachable` | error | DB `SELECT 1` throws |

## Status Classification

- **ok**: no alerts
- **degraded**: warnings only (counts as uptime)
- **unhealthy**: any error-level alert → HTTP 503

## Test Results (141/141 pass)

| Suite | Tests | Status |
|---|---|---|
| `tests/health.test.js` | 32 | ✅ |
| `tests/health-endpoint.test.js` | 12 | ✅ |
| `tests/monitor.test.js` | 32 | ✅ |
| `tests/integration/monitor.integration.test.js` | 19 | ✅ |
| `tests/integration/http-api.integration.test.js` | 65 | ✅ |
