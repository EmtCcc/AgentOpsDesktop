# API Health Check — Verification Report

> Issues: CMPAAA-554, CMPAAA-556
> Status: **DONE** — Health endpoint verified, uptime monitoring confirmed
> Date: 2026-05-29
> Re-verified: 2026-05-29 (CMPAAA-556) — 42/42 tests pass, no regressions

## Endpoint: `GET /health`

- **Framework**: Hono v4.12.23, served via `@hono/node-server` on port 3967
- **Auth**: Public (unauthenticated)
- **HTTP 200** for `ok` / `degraded`, **HTTP 503** for `unhealthy` (e.g., DB unreachable)

## Response Payload

| Field | Description |
|-------|-------------|
| `status` | `ok` / `degraded` / `unhealthy` |
| `version` | Semver from `package.json` |
| `ts` | ISO 8601 timestamp |
| `uptimeMs` | Process uptime in ms |
| `memory` | `rss`, `heapUsed`, `heapTotal`, `external` |
| `system` | `totalMem`, `freeMem`, `loadAvg`, `cpus` |
| `ipc` | `calls`, `errors`, `avgLatencyMs` |
| `renderer` | `crashes`, `unresponsive` |
| `app` | `startedAt`, `uncaughtExceptions`, `unhandledRejections` |
| `db` | `{ ok: true/false, error? }` via `SELECT 1` |
| `alerts` | Array of threshold-based alerts |
| `uptime` | `uptimePercent`, breakdown, transitions |

## Alert Thresholds

| Alert ID | Condition | Severity |
|----------|-----------|----------|
| `high_heap` | Heap usage > 85% | warn |
| `high_ipc_error_rate` | IPC error rate > 5% | error |
| `high_ipc_latency` | Avg IPC latency > 500ms | warn |
| `low_system_memory` | Free system memory < 10% | warn |
| `high_cpu_load` | Load per CPU > 2.0 | warn |
| `db_unreachable` | DB query fails | error |

## Uptime Monitoring

- **Periodic loop**: `startHealthLoop()` runs every 30s in `monitor.js`
- **Tracking**: Tracks `ok` / `degraded` / `unhealthy` durations and transitions (last 100)
- **Uptime %**: `(okMs + degradedMs) / totalMs * 100`
- **Started**: On `app.whenReady()` in `main/index.js`

## Test Results

### Unit Tests — 42/42 passed

- `tests/health.test.js` — Monitor module: getHealth, checkAlerts, classifyStatus, recordIpcCall, uptime tracking, status transitions
- `tests/health-endpoint.test.js` — HTTP endpoint: response shape, DB check, 503 on DB failure, uptime stats, Content-Type, auth bypass

### Smoke Tests — 24/24 passed

- `scripts/api-smoke-test.js` — Real HTTP server test: all fields present, valid types, DB connectivity, status classification

## Additional Health Endpoints

| Endpoint | Type | Auth | Purpose |
|----------|------|------|---------|
| `monitor:health` | IPC | Public | Inter-process health |
| `system:healthCheck` | IPC | Auth | System info |
| `agents:health-check` | IPC | Auth | Per-agent liveness |
| `POST /api/adapters/:id/health-check` | HTTP | Auth | Per-adapter check |
| `GET /api/squads/:id/status` | HTTP | Auth | Squad status |

## Disposition: DONE

All health checks pass. Endpoint returns correct status codes, payload shape, and uptime monitoring is active.
