# API Reference

AgentOpsDesktop exposes IPC channels between the Electron main process and renderer via `window.agentOps` (set up in `src/main/preload.js`). The renderer calls these methods; the main process handles them in `src/main/index.js`.

## Implemented IPC Channels

These channels are live in the current codebase.

### Error Responses

When an IPC handler throws an `IpcError`, the router catches it and returns a structured error:

```js
{
  ok: false,
  error: {
    code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'FORBIDDEN',
    message: string,      // Human-readable error description
    status: number,       // HTTP-like status code (400, 403, 404, 409, 500)
    field?: string        // Only for VALIDATION_ERROR — the offending field
  }
}
```

**Common error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `NOT_FOUND` | 404 | Entity does not exist |
| `VALIDATION_ERROR` | 400 | Invalid input (field constraint violated) |
| `CONFLICT` | 409 | Duplicate or conflicting state |
| `FORBIDDEN` | 403 | Auth failure or insufficient permissions |

### Agents

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `agents.list(params?)` | `{ offset?, limit?, status?, sortBy?, sortOrder? }` | `Agent[]` | List agents (paginated internally) |
| `agents.get(id)` | `id: string` | `Agent` | Get a single agent by ID |
| `agents.create(agent)` | `{ name, type?, command?, execPath?, cwd? }` | `Agent` | Register a new agent |
| `agents.update(id, updates)` | `id: string`, `updates: object` | `Agent` | Update agent fields |
| `agents.delete(id)` | `id: string` | `{ deleted: true, id }` | Remove an agent |
| `agents.healthCheck(id)` | `id: string` | `{ ok, execValid, processAlive, status }` | Check if agent executable is reachable |

**Pagination params (for list):**
- `offset` (number, default 0) — items to skip
- `limit` (number, default 20, max 100) — items per page
- `status` (string) — filter by status: `idle`, `running`, `error`
- `sortBy` (string) — field to sort: `createdAt`, `updatedAt`, `name`, `status`
- `sortOrder` (string) — `asc` or `desc` (default `desc`)

**Agent object shape:**
```js
{
  id: string,          // "agent-1", "agent-2", ...
  name: string,
  type: 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor' | 'custom',
  status: 'idle' | 'running' | 'error',
  command: string | null,
  execPath: string | null,
  cwd: string | null,
  createdAt: number,   // Date.now() timestamp
  updatedAt: number,
  lastHealthCheck?: number
}
```

### Goals

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `goals.list(params?)` | `{ offset?, limit?, status?, sortBy?, sortOrder? }` | `Goal[]` | List goals (paginated internally) |
| `goals.get(id)` | `id: string` | `Goal` | Get a single goal by ID |
| `goals.create(goal)` | `{ title, description? }` | `Goal` | Create a goal |
| `goals.update(id, updates)` | `id: string`, `updates: object` | `Goal` | Update goal fields |
| `goals.delete(id)` | `id: string` | `{ deleted: true, id }` | Delete a goal |

**Pagination params (for list):**
- `offset` (number, default 0) — items to skip
- `limit` (number, default 20, max 100) — items per page
- `status` (string) — filter by status: `active`, `completed`, `archived`
- `sortBy` (string) — field to sort: `createdAt`, `updatedAt`, `title`, `status`
- `sortOrder` (string) — `asc` or `desc` (default `desc`)

**Goal object shape:**
```js
{
  id: string,          // "goal-1", "goal-2", ...
  title: string,
  description: string | null,
  status: 'active' | 'completed' | 'archived',
  taskIds: string[],
  createdAt: number,
  updatedAt: number
}
```

### Tasks

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `tasks.list(params?)` | `{ offset?, limit?, status?, goalId?, sortBy?, sortOrder? }` | `Task[]` | List tasks (paginated internally) |
| `tasks.get(id)` | `id: string` | `Task` | Get a single task by ID |
| `tasks.create(task)` | `{ title, description?, goalId?, assigneeAgentId? }` | `Task` | Create a task (optionally linked to a goal) |
| `tasks.update(id, updates)` | `id: string`, `updates: object` | `Task` | Update task fields |
| `tasks.delete(id)` | `id: string` | `{ deleted: true, id }` | Delete a task |

**Pagination params (for list):**
- `offset` (number, default 0) — items to skip
- `limit` (number, default 20, max 100) — items per page
- `status` (string) — filter by status: `pending`, `running`, `done`, `failed`
- `goalId` (string) — filter by parent goal
- `sortBy` (string) — field to sort: `createdAt`, `updatedAt`, `title`, `status`
- `sortOrder` (string) — `asc` or `desc` (default `desc`)

**Task object shape:**
```js
{
  id: string,          // "task-1", "task-2", ...
  title: string,
  description: string | null,
  goalId: string | null,
  assigneeAgentId: string | null,
  status: 'pending' | 'running' | 'done' | 'failed',
  createdAt: number,
  updatedAt: number
}
```

### Logs

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `logs.list(opts?)` | `{ agentId?, limit? }` | `LogEntry[]` | Fetch logs, optionally filtered by agent. Default limit: 200. |
| `logs.append(entry)` | `{ agentId, message, level? }` | `LogEntry` | Append a log entry. Also pushes to renderer via `logs:new` event. |
| `logs.onNew(callback)` | `(entry: LogEntry) => void` | `() => void` (unsubscribe) | Subscribe to real-time log entries. Returns an unsubscribe function. |

**LogEntry shape:**
```js
{
  id: string,          // "log-{timestamp}-{random}"
  agentId: string,
  message: string,
  level?: string,
  timestamp: number
}
```

### Stats

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `stats.summary()` | — | `StatsSummary` | Aggregate counts for agents and tasks |

**StatsSummary shape:**
```js
{
  agents: { total, running, idle, error },
  tasks: { total, pending, running, done, failed }
}
```

### Monitor

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `monitor.health()` | — | `HealthReport` | Full application health snapshot |

**HealthReport includes:** status, uptime, memory usage (RSS, heap), system info (total/free memory, load average, CPU count), IPC metrics (call count, error count, avg latency), renderer crash/unresponsive counts, and app error counts.

### Chat

Group chat sessions for multi-agent conversation orchestration.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `chat.list(params?)` | `{ offset?, limit?, status? }` | `ChatSession[]` | List chat sessions (status: active/paused/completed) |
| `chat.get(id)` | `{ id }` | `ChatSession` | Get a single chat session with details |
| `chat.create(params)` | `{ title, agentIds, strategyType?, strategyConfig? }` | `ChatSession` | Create a new group chat session |
| `chat.update(id, updates)` | `{ id, updates }` | `ChatSession` | Update session title, status, or strategy |
| `chat.delete(id)` | `{ id }` | `{ deleted: true, id }` | Delete session (stops if running) |
| `chat.start(id)` | `{ id }` | `SessionState` | Start a chat session |
| `chat.pause(id)` | `{ id }` | `SessionState` | Pause a running session |
| `chat.resume(id)` | `{ id }` | `SessionState` | Resume a paused session |
| `chat.stop(id)` | `{ id }` | `SessionState` | Stop a session |
| `chat.sendMessage(id, content)` | `{ id, content }` | `Message` | Send a human message into the chat |
| `chat.listMessages(id, since?)` | `{ id, since? }` | `Message[]` | List messages (optionally since timestamp) |
| `chat.addParticipant(id, agentId, role?)` | `{ id, agentId, role? }` | `Participant` | Add an agent (role: manager/expert/observer) |
| `chat.removeParticipant(id, agentId)` | `{ id, agentId }` | `{ removed: true }` | Remove an agent from the session |
| `chat.getState(id)` | `{ id }` | `SessionState` | Get current engine state for a session |

**Strategy types:** `round-robin`, `manager-assign`, `topic-trigger`, `human-assign`

### Message Bus

Inter-agent pub/sub messaging with persistence and request-reply correlation.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `messageBus.publish(params)` | `{ topic, type, payload, senderId?, ttl? }` | `{ ok: true, messageId }` | Publish a message to a topic |
| `messageBus.subscribe(topic)` | `{ topic }` | `{ ok: true, subscriberId }` | Subscribe to a topic; messages pushed to renderer via `bus:message` |
| `messageBus.unsubscribe(subscriberId)` | `{ subscriberId }` | `{ ok: boolean }` | Unsubscribe from a topic |
| `messageBus.request(params)` | `{ topic, payload, timeout?, senderId? }` | `Message` | Send request and wait for correlated response (timeout: 100-60000ms) |
| `messageBus.replay(params)` | `{ topic, since?, limit? }` | `{ ok: true, messages }` | Replay persisted messages (crash recovery); limit max 500 |
| `messageBus.stats()` | — | `BusStats` | Get bus statistics |

**Message types:** `request`, `response`, `event`, `heartbeat`

### Shared Context

DAG-scoped key-value blackboard for agent collaboration within a task graph.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `sharedContext.set(params)` | `{ dagId, key, value, updatedBy? }` | `ContextEntry` | Set a key-value pair scoped to a DAG |
| `sharedContext.get(params)` | `{ dagId, key }` | `ContextEntry` | Get a single context entry |
| `sharedContext.getMany(params)` | `{ dagId, keys }` | `ContextEntry[]` | Get multiple entries by key list |
| `sharedContext.list(dagId)` | `{ dagId }` | `ContextEntry[]` | List all entries for a DAG |
| `sharedContext.delete(params)` | `{ dagId, key }` | `{ ok: true }` | Delete a context entry |

### Governance

Approval gates for task-level policy enforcement.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `governance.approve(params)` | `{ gateId, decision, comment? }` | `Gate` | Respond to an approval gate |
| `governance.listPending()` | — | `Gate[]` | List all pending (undecided) gates |
| `governance.register(params)` | `{ taskId, type?, description? }` | `Gate` | Register a new approval gate |

**Decision values:** `approve`, `reject`, `rollback`
**Gate types:** `manual` (default), `auto`

### System

Application diagnostics and health.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `system.healthCheck()` | — | `SystemHealth` | App status, version, platform, memory, uptime |
| `system.listRoutes()` | — | `{ routes }` | List all registered IPC routes (debugging) |

**SystemHealth shape:**
```js
{
  status: 'ok',
  version: string,
  platform: string,       // 'darwin' | 'win32' | 'linux'
  arch: string,
  nodeVersion: string,
  uptime: number,         // seconds
  memory: { total, free, usage: { rss, heapTotal, heapUsed, ... } },
  timestamp: number
}
```

### Telemetry

Usage statistics and data management.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `telemetry.getStats()` | — | `TelemetryStats` | Get aggregated telemetry statistics |
| `telemetry.setEnabled(params)` | `{ enabled }` | `{ enabled }` | Enable or disable telemetry collection |
| `telemetry.exportData()` | — | `TelemetryExport` | Export all collected telemetry data |
| `telemetry.clearData()` | — | `{ ok: true }` | Clear all stored telemetry data |

## Agent Runtime (Main Process Module)

`src/main/agent-runtime.js` exports `AgentRuntime`, a class for managing CLI agent processes. This module is available in the main process but not yet wired to IPC handlers.

```js
const { AgentRuntime, AGENT_STATUS } = require('./agent-runtime');

const runtime = new AgentRuntime();

// Health check
const result = await runtime.healthCheck('/usr/local/bin/claude');
// { ok: true } or { ok: false, error: '...' }

// Spawn an agent
const { agentId } = runtime.spawnAgent({
  execPath: '/usr/local/bin/claude',
  args: ['--print'],
  cwd: '/path/to/project',
  env: { ANTHROPIC_API_KEY: '...' },
  label: 'claude-code'
});

// Listen for events
runtime.on('log', ({ agentId, type, data }) => { /* stdout/stderr */ });
runtime.on('status-change', ({ agentId, status }) => { /* SPAWNING/RUNNING/STOPPED/ERROR */ });
runtime.on('exit', ({ agentId, code, signal }) => { /* process exited */ });

// Control
runtime.stopAgent(agentId);   // SIGTERM, then SIGKILL after 5s
runtime.getAgent(agentId);    // current state
runtime.listAgents();         // all agents
runtime.getLogs(agentId);     // captured output
runtime.removeAgent(agentId); // clean up (must be stopped first)
```

## Data Store (Main Process Module)

`src/main/store.js` exports `Store`, a JSON file-based persistence layer. Data is saved to `~/.agentops/data.json`.

```js
const { Store } = require('./store');
const store = new Store();

store.addAgent({ name: 'claude', execPath: '/usr/local/bin/claude' });
store.getAgents();
store.getAgent(id);
store.removeAgent(id);

store.addGoal({ title: 'Implement API', description: '...' });
store.getGoals();
store.updateGoal(id, { status: 'completed' });

store.addTask({ goalId, title: 'Design schema', agentId });
store.getTasks(goalId);
store.updateTask(id, { status: 'done' });
```

## Paperclip REST API (Planned)

AgentOpsDesktop will communicate with the Paperclip control plane for goal/task CRUD and governance. Key endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/companies/{id}/goals` | List company goals |
| `POST` | `/api/companies/{id}/goals` | Create a goal |
| `PATCH` | `/api/goals/{id}` | Update goal status |
| `GET` | `/api/projects/{id}/issues` | List project issues/tasks |
| `POST` | `/api/issues` | Create an issue |
| `PATCH` | `/api/issues/{id}` | Update issue |
| `POST` | `/api/issues/{id}/checkout` | Claim an issue |
| `POST` | `/api/issues/{id}/comments` | Post a comment |

Authentication: bearer token via `Authorization` header, stored in OS keychain.

## Target IPC Protocol (Planned)

The [Architecture doc](ARCHITECTURE.md) describes the target IPC protocol with channels like `agent:spawn`, `agent:output`, `task:start`, `task:stop`, etc. These will replace the current flat handler pattern when the project moves to TypeScript and structured IPC routing.
