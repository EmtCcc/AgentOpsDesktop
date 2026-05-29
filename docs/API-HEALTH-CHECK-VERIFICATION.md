# API Health Check — CMPAAA-559 Verification

**Date:** 2026-05-29
**Status:** ✅ Verified

## Endpoint

`GET /health` — public, no auth required. Default port `3967`.

## Test Results

### Unit & Endpoint Tests (vitest)

| File | Tests | Result |
|------|-------|--------|
| `tests/health.test.js` | 30 | ✅ pass |
| `tests/monitor.test.js` | 30 | ✅ pass |
| `tests/health-endpoint.test.js` | 12 | ✅ pass |
| **Total** | **72** | **✅ all pass** |

### Smoke Test (`scripts/api-smoke-test.js`)

24/24 checks passed:

- HTTP 200, Content-Type `application/json`
- Response fields: `status`, `version` (semver), `ts` (ISO), `uptimeMs`, `memory`, `system`, `ipc`, `renderer`, `app`, `db`, `alerts`, `uptime`
- DB connectivity: ok
- Uptime stats: `uptimePercent` (0-100), `breakdown` (okMs/degradedMs/unhealthyMs), `transitions` array

## Monitoring Architecture

- **Metrics:** IPC calls/errors/latency, renderer crashes, app errors, process memory, system CPU/memory
- **Alerts:** high_heap (>85%), high_ipc_error_rate (>5%), high_ipc_latency (>500ms), low_system_memory (<10% free), high_cpu_load (>2.0)
- **Status classification:** `ok` / `degraded` (warnings) / `unhealthy` (errors → HTTP 503)
- **Uptime tracking:** cumulative time per status, transition history (capped at 100)
- **Health loop:** 30s periodic tick with debug logging
- **SLOs:** 99.9% uptime, <1% IPC error rate, <200ms IPC p95 latency

## Key Files

| Component | Path |
|-----------|------|
| Health route | `src/main/api/routes/health.js` |
| Monitor module | `src/main/monitor.js` |
| Smoke test | `scripts/api-smoke-test.js` |
| Docs | `docs/MONITORING.md` |
