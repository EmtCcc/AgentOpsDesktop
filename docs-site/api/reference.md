# API Reference

AgentOpsDesktop exposes IPC channels between the Electron main process and renderer via `window.agentOps` (set up in `src/main/preload.js`).

## Error Responses

When an IPC handler throws an `IpcError`, the router catches it and returns a structured error:

```js
{
  ok: false,
  error: {
    code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'FORBIDDEN',
    message: string,
    status: number,
    field?: string  // Only for VALIDATION_ERROR
  }
}
```

| Code | Status | Meaning |
|------|--------|---------|
| `NOT_FOUND` | 404 | Entity does not exist |
| `VALIDATION_ERROR` | 400 | Invalid input (field constraint violated) |
| `CONFLICT` | 409 | Duplicate or conflicting state |
| `FORBIDDEN` | 403 | Auth failure or insufficient permissions |

---

## Agents

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `agents.list(params?)` | `{ offset?, limit?, status?, sortBy?, sortOrder? }` | `Agent[]` | List agents (paginated) |
| `agents.get(id)` | `id: string` | `Agent` | Get a single agent by ID |
| `agents.create(agent)` | `{ name, type?, command?, execPath?, cwd? }` | `Agent` | Register a new agent |
| `agents.update(id, updates)` | `id: string`, `updates: object` | `Agent` | Update agent fields |
| `agents.delete(id)` | `id: string` | `{ deleted: true, id }` | Remove an agent |
| `agents.healthCheck(id)` | `id: string` | `{ ok, execValid, processAlive, status }` | Check agent reachability |

**Agent object:**
```js
{
  id: string,
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

---

## Goals

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `goals.list(params?)` | `{ offset?, limit?, status?, sortBy?, sortOrder? }` | `Goal[]` | List goals (paginated) |
| `goals.get(id)` | `id: string` | `Goal` | Get a single goal |
| `goals.create(goal)` | `{ title, description? }` | `Goal` | Create a goal |
| `goals.update(id, updates)` | `id: string`, `updates: object` | `Goal` | Update goal fields |
| `goals.delete(id)` | `id: string` | `{ deleted: true, id }` | Delete a goal |

**Goal object:**
```js
{
  id: string,
  title: string,
  description: string | null,
  status: 'active' | 'completed' | 'archived',
  taskIds: string[],
  createdAt: number,
  updatedAt: number
}
```

---

## Tasks

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `tasks.list(params?)` | `{ offset?, limit?, status?, goalId?, sortBy?, sortOrder? }` | `Task[]` | List tasks (paginated) |
| `tasks.get(id)` | `id: string` | `Task` | Get a single task |
| `tasks.create(task)` | `{ title, description?, goalId?, assigneeAgentId? }` | `Task` | Create a task |
| `tasks.update(id, updates)` | `id: string`, `updates: object` | `Task` | Update task fields |
| `tasks.delete(id)` | `id: string` | `{ deleted: true, id }` | Delete a task |

**Task object:**
```js
{
  id: string,
  title: string,
  description: string | null,
  goalId: string | null,
  assigneeAgentId: string | null,
  status: 'pending' | 'running' | 'done' | 'failed',
  createdAt: number,
  updatedAt: number
}
```

---

## Logs

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `logs.list(opts?)` | `{ agentId?, limit? }` | `LogEntry[]` | Fetch logs (default limit: 200) |
| `logs.append(entry)` | `{ agentId, message, level? }` | `LogEntry` | Append a log entry |
| `logs.onNew(callback)` | `(entry: LogEntry) => void` | `() => void` | Subscribe to real-time logs |

**LogEntry object:**
```js
{
  id: string,
  agentId: string,
  message: string,
  level?: string,
  timestamp: number
}
```

---

## Stats

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `stats.summary()` | — | `StatsSummary` | Aggregate counts |

```js
{
  agents: { total, running, idle, error },
  tasks: { total, pending, running, done, failed }
}
```

---

## Monitor

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `monitor.health()` | — | `HealthReport` | Full application health snapshot |

**HealthReport includes:** status, uptime, memory usage (RSS, heap), system info (total/free memory, load average, CPU count), IPC metrics (call count, error count, avg latency), renderer crash/unresponsive counts, and app error counts.

---

## Agent Runtime Module

`src/main/agent-engine.js` exports `AgentEngine` for managing CLI agent processes in the main process.

```js
const { AgentEngine, AGENT_STATUS } = require('./agent-engine');

const engine = new AgentEngine();

// Spawn an agent
const { agentId } = engine.spawnAgent({
  execPath: '/usr/local/bin/claude',
  args: ['--print'],
  cwd: '/path/to/project',
  env: { ANTHROPIC_API_KEY: '...' },
  label: 'claude-code',
  resourceLimits: { maxMemoryMB: 1024 },
  recovery: { enabled: true, maxRetries: 3 },
});

// Listen for events
engine.on('log', ({ agentId, type, data }) => { /* stdout/stderr */ });
engine.on('status-change', ({ agentId, status }) => { /* created/running/paused/terminated/errored */ });
engine.on('exit', ({ agentId, code, signal }) => { /* process exited */ });
engine.on('resource-limit', ({ agentId, type, limit, actual }) => { /* memory or cpu */ });
engine.on('recovery-attempt', ({ agentId, attempt, maxRetries }) => { /* crash recovery */ });

// Control
engine.pauseAgent(agentId);    // SIGSTOP
engine.resumeAgent(agentId);   // SIGCONT
engine.stopAgent(agentId);     // SIGTERM, then SIGKILL after 5s
engine.getAgent(agentId);      // current state
engine.listAgents();           // all agents
engine.getLogs(agentId);       // captured output
engine.removeAgent(agentId);   // clean up (must be stopped first)
```

### Agent States

```
created → running ↔ paused → terminated | errored
```

| State | Description |
|-------|-------------|
| `created` | Agent spawned, waiting for process to start |
| `running` | Process is active |
| `paused` | Process suspended via SIGSTOP |
| `terminated` | Clean exit (code 0) |
| `errored` | Non-zero exit or crash |

---

## Adapter Registry

`src/main/adapter-registry.js` exports `AdapterRegistry` and `AgentAdapter` base class.

```js
const { AdapterRegistry, AgentAdapter } = require('./adapter-registry');

const registry = new AdapterRegistry();

// Register and load adapters
registry.registerClass('my-agent', MyAdapter);
const adapter = registry.load('my-agent', { execPath: '...' });

// Health check
const result = await registry.healthCheck('my-agent');

// List
registry.listRegistered();  // ['my-agent', ...]
registry.listLoaded();      // [{ type, id, name, status }, ...]
```

See the [Adapter Guide](/adapters/guide) for building custom adapters.

---

## Data Store

`src/main/store.js` exports `Store`, a JSON file-based persistence layer. Data saved to `~/.agentops/data.json`.

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

---

## Paperclip REST API (Planned)

AgentOpsDesktop will communicate with the Paperclip control plane for goal/task CRUD and governance.

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
