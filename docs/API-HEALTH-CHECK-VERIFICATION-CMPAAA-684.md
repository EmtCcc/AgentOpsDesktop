# API Health Check Verification — CMPAAA-684

**Date:** 2026-05-30
**Issue:** CMPAAA-684 — API health check
**Status:** ✅ All checks pass

---

## Endpoint

| Property | Value |
|----------|-------|
| Route | `GET /health` |
| Auth | Public (no authentication required) |
| Handler | `src/main/api/routes/health.js:14` |
| Mount | `src/main/api/app.js:53` |
| Backend | `src/main/monitor.js` |

## Response Shape

```json
{
  "status": "ok|degraded|unhealthy",
  "version": "0.1.0",
  "ts": "<ISO-8601>",
  "uptimeMs": <number>,
  "memory": { "rss", "heapUsed", "heapTotal", "external" },
  "system": { "totalMem", "freeMem", "loadAvg", "cpus" },
  "ipc": { "calls", "errors", "avgLatencyMs" },
  "renderer": { "crashes", "unresponsive" },
  "app": { "startedAt", "uncaughtExceptions", "unhandledRejections" },
  "db": { "ok": true },
  "alerts": [],
  "uptime": {
    "uptimePercent": 100,
    "totalUptimeMs": ...,
    "totalDowntimeMs": ...,
    "breakdown": { "okMs", "degradedMs", "unhealthyMs" },
    "lastStatusChange": "...",
    "lastStatusChangeAt": "...",
    "transitions": [...]
  }
}
```

## Alert Thresholds

| Metric | Threshold | Level |
|--------|-----------|-------|
| Heap usage | > 85% | warning |
| IPC error rate | > 5% | error |
| IPC latency | > 500ms | warning |
| System free memory | < 10% | warning |
| Load per CPU | > 2.0 | warning |

## Status Classification

- **ok** — no alerts
- **degraded** — warnings only
- **unhealthy** — any error-level alert (returns HTTP 503)

## Test Results

### Unit Tests (`tests/health.test.js`)

**30/30 passed** — covers `getHealth`, `checkAlerts`, `classifyStatus`, `recordIpcCall`, uptime tracking.

### Integration Tests (`tests/health-endpoint.test.js`)

**12/12 passed** — covers HTTP status codes, response shape, DB failure (503), auth bypass, version/timestamp/uptime validation, uptime stats structure.

### Smoke Test (`scripts/api-smoke-test.js`)

**24/24 passed** — end-to-end HTTP request against live server, validates all response fields, content-type, status codes.

## Summary

| Suite | Tests | Result |
|-------|-------|--------|
| Unit | 30 | ✅ |
| Integration | 12 | ✅ |
| Smoke (E2E) | 24 | ✅ |
| **Total** | **66** | **✅ All pass** |
