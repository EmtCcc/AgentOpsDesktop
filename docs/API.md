# API Reference

AgentOpsDesktop exposes IPC channels between the Electron main process and renderer via `window.agentOps` (set up in `src/main/preload.js`). The renderer calls these methods; the main process handles them in `src/main/index.js`.

## Implemented IPC Channels

These channels are live in the current codebase.

### Agents

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `agents.list(params?)` | `{ offset?, limit?, status?, sortBy?, sortOrder? }` | `PaginatedResult<Agent>` | List agents with pagination |
| `agents.get(id)` | `id: string` | `Agent` | Get a single agent by ID |
| `agents.create(agent)` | `{ name, type?, command?, execPath?, cwd? }` | `Agent` | Register a new agent |
| `agents.update(id, updates)` | `id: string`, `updates: object` | `Agent` | Update agent fields |
| `agents.delete(id)` | `id: string` | `{ deleted: true, id }` | Remove an agent |
| `agents.healthCheck(id)` | `id: string` | `{ ok, execValid, processAlive, status }` | Check if agent executable is reachable |

**Pagination params:**
- `offset` (number, default 0) — items to skip
- `limit` (number, default 20, max 100) — items per page
- `status` (string) — filter by status: `idle`, `running`, `error`
- `sortBy` (string) — field to sort: `createdAt`, `updatedAt`, `name`, `status`
- `sortOrder` (string) — `asc` or `desc` (default `desc`)

**PaginatedResult shape:**
```js
{
  items: Agent[],
  total: number,
  offset: number,
  limit: number,
  hasMore: boolean
}
```

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
| `goals.list()` | — | `Goal[]` | List all goals |
| `goals.create(goal)` | `{ title, description? }` | `Goal` | Create a goal |
| `goals.update(id, updates)` | `id: string`, `updates: object` | `Goal \| null` | Update goal fields |
| `goals.delete(id)` | `id: string` | `boolean` | Delete a goal |

**Goal object shape:**
```js
{
  id: string,          // "goal-1", "goal-2", ...
  title: string,
  description: string,
  status: 'active' | 'completed' | 'archived',
  taskIds: string[],
  createdAt: number
}
```

### Tasks

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `tasks.list()` | — | `Task[]` | List all tasks |
| `tasks.create(task)` | `{ title, description?, goalId?, agentId? }` | `Task` | Create a task (optionally linked to a goal) |
| `tasks.update(id, updates)` | `id: string`, `updates: object` | `Task \| null` | Update task fields |
| `tasks.delete(id)` | `id: string` | `boolean` | Delete a task |

**Task object shape:**
```js
{
  id: string,          // "task-1", "task-2", ...
  title: string,
  description: string,
  goalId?: string,
  agentId?: string,
  status: 'pending' | 'running' | 'done' | 'failed',
  createdAt: number,
  startedAt?: number,
  completedAt?: number
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
