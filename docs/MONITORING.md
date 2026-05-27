# Monitoring & Observability

## Overview

AgentOpsDesktop uses a local-first monitoring stack built on zero external dependencies. All telemetry is structured JSON written to disk, queryable by standard CLI tools, and exposed to the renderer via IPC.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Main Process                     │
│                                                 │
│  ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │  Logger  │   │  Monitor │   │ IPC Timing │  │
│  │ (JSONL)  │   │ (health) │   │  (wrapper) │  │
│  └────┬─────┘   └────┬─────┘   └─────┬──────┘  │
│       │              │               │          │
│       ▼              ▼               ▼          │
│  ┌──────────────────────────────────────────┐   │
│  │        ~/.agentops-desktop/logs/         │   │
│  │     app-YYYY-MM-DD.jsonl  (rotated)      │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │        monitor:health  (IPC endpoint)    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Components

### 1. Structured Logger (`src/main/logger.js`)

All log output is machine-parseable JSON, one entry per line (JSONL format).

**Log levels**: `debug` (10), `info` (20), `warn` (30), `error` (40), `fatal` (50)

**Configuration**: Set `LOG_LEVEL` env var to control minimum level (default: `info`).

**Log location**: `~/.agentops-desktop/logs/app-YYYY-MM-DD.jsonl`

**Entry format**:
```json
{
  "ts": "2026-05-28T10:30:00.000Z",
  "level": "info",
  "msg": "app.ready",
  "pid": 12345,
  "version": "0.1.0",
  "platform": "darwin"
}
```

**Consistent fields**: Every entry includes `ts`, `level`, `msg`, `pid`. Additional context passed as flat keys.

**Dev mode**: When `--dev` flag is set, logs also print to stdout with color-coded level prefixes.

**Usage**:
```js
const logger = require('./logger');
logger.info('task.created', { taskId: 'task-1', goalId: 'goal-1' });
logger.error('agent.crash', { agentId: 'agent-3', err: { message: err.message, stack: err.stack } });
```

### 2. Monitor Module (`src/main/monitor.js`)

Collects metrics, runs health checks, tracks errors, and fires alerts.

#### Health Check

Available via IPC: `monitor:health` (exposed to renderer as `window.agentOps.monitor.health()`).

**Response schema**:
```json
{
  "status": "ok",
  "ts": "2026-05-28T10:30:00.000Z",
  "uptimeMs": 120000,
  "memory": {
    "rss": 85000000,
    "heapUsed": 45000000,
    "heapTotal": 60000000,
    "external": 5000000
  },
  "system": {
    "totalMem": 17179869184,
    "freeMem": 8589934592,
    "loadAvg": [1.5, 1.2, 1.0],
    "cpus": 8
  },
  "ipc": {
    "calls": 150,
    "errors": 2,
    "avgLatencyMs": 12
  },
  "renderer": {
    "crashes": 0,
    "unresponsive": 0
  },
  "app": {
    "startedAt": 1716892200000,
    "uncaughtExceptions": 0,
    "unhandledRejections": 0
  }
}
```

#### IPC Latency Tracking

Every `ipcMain.handle` call is automatically timed via a transparent wrapper. Metrics are aggregated in the `ipc` section of the health check. Errors are logged with full stack traces.

#### Renderer Health

- **Crash detection**: Listens to `render-process-gone` event, logs fatal, increments crash counter.
- **Unresponsive detection**: Listens to `unresponsive` window event, logs warning.

### 3. Alert Thresholds

Alerts fire when metrics breach thresholds. Each alert ID fires once until resolved.

| Alert ID | Condition | Severity | Threshold |
|----------|-----------|----------|-----------|
| `high_heap` | Heap usage ratio | warn | > 85% |
| `high_ipc_error_rate` | IPC call failure rate | error | > 5% (min 10 calls) |
| `high_ipc_latency` | Average IPC call latency | warn | > 500ms (min 10 calls) |
| `low_system_memory` | System free memory | warn | < 10% |
| `high_cpu_load` | Load average per CPU core | warn | > 2.0 |

Alerts are logged as `warn` or `error` level entries with the `alert` message type.

### 4. Global Error Handlers

Installed at process startup, before any other code:

- **`uncaughtException`**: Logged as `fatal`, increments counter. Process continues (Electron best practice).
- **`unhandledRejection`**: Logged as `error`, increments counter.

### 5. Periodic Health Loop

Runs every 30 seconds (interval is `unref()`'d, won't prevent app exit). Each tick:
- Captures a health snapshot
- Evaluates alert thresholds
- Logs a `debug`-level summary

Disable by calling `monitor.stopHealthLoop()`.

## Log Querying

Logs are standard JSONL, queryable with `jq`:

```bash
# All errors today
cat ~/.agentops-desktop/logs/app-$(date +%Y-%m-%d).jsonl | jq 'select(.level == "error")'

# IPC calls with latency > 100ms
cat logs/app-*.jsonl | jq 'select(.msg == "ipc.error" or (.latencyMs and .latencyMs > 100))'

# Alert history
cat logs/app-*.jsonl | jq 'select(.msg == "alert")'

# Fatal/crash events
cat logs/app-*.jsonl | jq 'select(.level == "fatal")'
```

## IPC Channel Reference

| Channel | Direction | Description |
|---------|-----------|-------------|
| `monitor:health` | Renderer -> Main | Returns full health snapshot |
| `logs:new` | Main -> Renderer | Pushes new log entries to renderer (existing) |

## SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| App uptime | 99.9% during active session | Renderer crash count / session duration |
| IPC error rate | < 1% | `ipc.errors / ipc.calls` |
| IPC p95 latency | < 200ms | Tracked via `ipc.totalLatencyMs / ipc.calls` (avg proxy) |
| Fatal errors | 0 per session | `app.uncaughtExceptions` + renderer crashes |

## Log Retention

- Logs are written daily to `app-YYYY-MM-DD.jsonl`.
- No automatic rotation or cleanup is implemented yet.
- **Manual cleanup**: Delete old `.jsonl` files from `~/.agentops-desktop/logs/`.
- **Future**: Add retention policy (e.g., keep 30 days) via a scheduled cleanup task.

## Future Improvements

- [ ] Add Sentry or similar for remote error reporting (when cloud sync is enabled)
- [ ] Persist metrics across sessions for trend analysis
- [ ] Add renderer-side performance observer (navigation timing, long tasks)
- [ ] Dashboard UI panel for health metrics
- [ ] Log file rotation and retention policy
- [ ] Electron auto-update health tracking
