# API Health Check Verification — CMPAAA-565

**Date**: 2026-05-29
**Status**: ✅ Verified

## Health Endpoint

- **Route**: `GET /health` (public, no auth required)
- **Port**: 3967 (default, configurable)
- **HTTP Status**: 200 (ok/degraded), 503 (unhealthy)

## Response Shape

```json
{
  "status": "ok|degraded|unhealthy",
  "version": "0.1.0",
  "ts": "2026-05-29T...",
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
    "totalUptimeMs", "totalDowntimeMs",
    "breakdown": { "okMs", "degradedMs", "unhealthyMs" },
    "lastStatusChange", "lastStatusChangeAt",
    "transitions": []
  }
}
```

## Alert Thresholds

| Alert ID | Severity | Trigger |
|----------|----------|---------|
| high_heap | warn | Heap usage > 85% |
| high_ipc_error_rate | error | IPC error rate > 5% |
| high_ipc_latency | warn | Avg IPC latency > 500ms |
| low_system_memory | warn | Free system memory < 10% |
| high_cpu_load | warn | Load per CPU > 2.0 |
| db_unreachable | error | SQLite query fails |

## Status Classification

- **ok**: No alerts
- **degraded**: Only warning-level alerts
- **unhealthy**: At least one error-level alert → HTTP 503

## Test Results

- **21/21 endpoint checks passed** (inline verification with mocked Electron runtime)
- **42/42 unit tests defined** in `tests/health.test.js` (30) + `tests/health-endpoint.test.js` (12)
- Note: vitest execution requires Electron binary (devDependency build script); endpoint-level verification performed via direct Hono app.request()

## Uptime Tracking

- Status transitions recorded (ok → degraded → unhealthy)
- Degraded counts as uptime, unhealthy counts as downtime
- Uptime % = (ok + degraded) / total × 100
- Max 100 transitions stored internally, 10 returned in response
- Periodic health tick every 30s with telemetry integration

## Key Files

| File | Purpose |
|------|---------|
| `src/main/monitor.js` | Metrics, alerts, uptime tracking, health loop |
| `src/main/api/routes/health.js` | HTTP endpoint (Hono route) |
| `src/main/api/app.js` | App setup, mounts `/health` as public route |
| `src/main/api/server.js` | Server startup (port 3967) |
| `tests/health.test.js` | Monitor module unit tests |
| `tests/health-endpoint.test.js` | HTTP endpoint integration tests |
