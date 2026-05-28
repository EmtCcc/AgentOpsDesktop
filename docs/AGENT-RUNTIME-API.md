# Agent Runtime API

> Version: MVP (v0.1) | Last updated: 2026-05-28

This document defines the Agent Runtime subsystem — the orchestration layer that connects human goals to machine execution. It covers the five core components: **Goal Parser**, **Task Decomposer**, **DAG Builder**, **Orchestrator**, and **Message Bus**.

All runtime interfaces are exposed via Electron IPC. The renderer communicates through `window.agentOps` (defined in `src/main/preload.js`); the main process handles requests via controllers registered in `src/main/ipc/index.js`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [IPC Protocol](#ipc-protocol)
3. [Authentication & RBAC](#authentication--rbac)
4. [Goal Parser](#goal-parser)
5. [Task Decomposer](#task-decomposer)
6. [DAG Builder](#dag-builder)
7. [Orchestrator](#orchestrator)
8. [Agent Engine](#agent-engine)
9. [Message Bus](#message-bus)
10. [Data Models](#data-models)
11. [Error Handling](#error-handling)
12. [Security Boundaries](#security-boundaries)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│                                                              │
│  window.agentOps.goals.*        ─┐                           │
│  window.agentOps.tasks.*        ─┤  IPC invoke               │
│  window.agentOps.agents.*       ─┤  (contextBridge)          │
│  window.agentOps.orchestrator.* ─┤                           │
│  window.agentOps.logs.*         ─┘                           │
└────────────────────────┬─────────────────────────────────────┘
                         │
            ┌────────────▼────────────┐
            │      IPC Router         │
            │  + Auth + RBAC + Valid.  │
            └────────────┬────────────┘
                         │
      ┌──────┬───────────┼───────────┬──────────┬──────────┐
      ▼      ▼           ▼           ▼          ▼          ▼
 ┌────────┐┌────────┐┌────────┐┌──────────┐┌────────┐┌────────┐
 │  Goal  ││  Task  ││ Agent  ││ Orchestr.││  Log   ││ Stats  │
 │ Parser ││Decomp. ││Control.││ Control. ││Control.││Control. │
 └───┬────┘└───┬────┘└───┬────┘└────┬─────┘└───┬────┘└────────┘
     │         │         │          │          │
     └─────────┴─────────┴─────┬────┴──────────┘
                               ▼
                       ┌───────────────┐
                       │   Repositories│
                       │  (SQLite WAL) │
                       └───────┬───────┘
                               │
                  ┌────────────┼────────────┐
                  ▼                         ▼
          ┌───────────────┐       ┌──────────────────┐
          │  AgentEngine  │       │  Orchestrator    │
          │ (EventEmitter)│       │  (DAG executor)  │
          └───────┬───────┘       └──────────────────┘
                  │
          spawn / stdin+stdout
                  │
          ┌───────▼───────┐
          │   CLI Agents  │
          │  Claude Code  │
          │  Codex, etc.  │
          └───────────────┘
```

---

## IPC Protocol

All IPC calls follow a unified request/response pattern:

**Request:** `window.agentOps.<namespace>.<method>(params)`

**Response:**
```js
// Success — raw return value (no wrapper)
handler result directly

// Failure (IpcError)
{ ok: false, error: { code, message, status, field? } }
```

> **Note:** Successful responses are returned directly from the handler without any `{ ok: true, data }` wrapper. Only `IpcError` exceptions are caught and wrapped in the error envelope. Other exceptions propagate to Electron's error handling.

**Error codes:**

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Request params fail schema validation |
| `FORBIDDEN` | 403 | Auth failure or insufficient permissions |
| `NOT_FOUND` | 404 | Entity does not exist |
| `CONFLICT` | 409 | Duplicate or conflicting state |
| `INVALID_DAG` | 400 | DAG definition is invalid |
| `DAG_START_FAILED` | 400 | Could not start DAG execution |
| `INVALID_TASK_TYPE` | 400 | Task type does not support the operation |
| `INVALID_TASK_STATUS` | 400 | Task is not in the required state |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication & RBAC

### Auth Flow

1. Renderer loads → preload auto-calls `auth:login` → caches token
2. All subsequent `window.agentOps.*` calls inject `_auth: { token }` automatically
3. Router auth middleware verifies token; authorize middleware checks RBAC
4. Session context (`event.session.role`) is attached for ownership checks in handlers

### Roles

| Role | Scope |
|------|-------|
| `admin` | Full access to all resources (`*` wildcard) |
| `operator` | CRUD on agents, goals, tasks, orchestrations, logs, settings, updates |
| `viewer` | Read-only (list/get) + auth management |

### Permission Matrix

| Permission | admin | operator | viewer |
|------------|:-----:|:--------:|:------:|
| `agents:list` | Y | Y | Y |
| `agents:get` | Y | Y | Y |
| `agents:create` | Y | Y | - |
| `agents:update` | Y | Y | - |
| `agents:delete` | Y | Y | - |
| `agents:spawn` | Y | Y | - |
| `agents:kill` | Y | Y | - |
| `agents:health-check` | Y | Y | Y |
| `agents:status` | Y | Y | Y |
| `goals:list` | Y | Y | Y |
| `goals:get` | Y | Y | Y |
| `goals:create` | Y | Y | - |
| `goals:update` | Y | Y | - |
| `goals:delete` | Y | Y | - |
| `tasks:list` | Y | Y | Y |
| `tasks:get` | Y | Y | Y |
| `tasks:create` | Y | Y | - |
| `tasks:update` | Y | Y | - |
| `tasks:delete` | Y | Y | - |
| `orchestrator:list` | Y | Y | Y |
| `orchestrator:get` | Y | Y | Y |
| `orchestrator:create` | Y | Y | - |
| `orchestrator:start` | Y | Y | - |
| `orchestrator:pause` | Y | Y | - |
| `orchestrator:resume` | Y | Y | - |
| `orchestrator:cancel` | Y | Y | - |
| `orchestrator:progress` | Y | Y | Y |
| `orchestrator:task:get` | Y | Y | Y |
| `orchestrator:task:complete` | Y | Y | - |
| `logs:list` | Y | Y | Y |
| `logs:append` | Y | Y | - |
| `stats:summary` | Y | Y | Y |
| `settings:get` | Y | Y | Y |
| `settings:update` | Y | Y | - |
| `update:check` | Y | Y | Y |
| `update:download` | Y | Y | - |
| `update:install` | Y | Y | - |

---

## Goal Parser

The Goal Parser is the entry point for the runtime loop. It accepts human intent as structured goal objects and persists them for downstream decomposition.

### Interface

```js
// Renderer API
window.agentOps.goals.list(params?)
window.agentOps.goals.get(id)
window.agentOps.goals.create(goal)
window.agentOps.goals.update(id, updates)
window.agentOps.goals.delete(id)
```

### Methods

#### `goals.list(params?)` → `{ items: Goal[], total: number }`

List all goals with optional filtering and pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | number | 0 | Items to skip |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `active`, `completed`, `archived` |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `title`, `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### `goals.get(id)` → `Goal`

Get a single goal by ID. Throws `NOT_FOUND` if missing.

#### `goals.create(goal)` → `Goal`

Create a new goal.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | yes | 1–500 chars |
| `description` | string | no | max 5000 chars |

Returns the created goal with `id`, `status: 'active'`, and timestamps.

#### `goals.update(id, updates)` → `Goal`

Update goal fields.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | string | yes | — |
| `updates` | object | yes | Allowed fields: `title`, `description`, `status` |

Status transitions: `active` → `completed` → `archived`

#### `goals.delete(id)` → `{ deleted: true, id }`

Delete a goal. Linked tasks are unlinked but not deleted.

### Goal Object Shape

```js
{
  id: string,              // UUID
  title: string,
  description: string | null,
  status: 'active' | 'completed' | 'archived',
  taskIds: string[],       // Linked task IDs (in-memory mode only)
  createdAt: number,       // epoch ms
  updatedAt: number
}
```

---

## Task Decomposer

The Task Decomposer breaks goals into executable units. Each task belongs to one goal and can be assigned to one agent.

### Interface

```js
// Renderer API
window.agentOps.tasks.list(params?)
window.agentOps.tasks.get(id)
window.agentOps.tasks.create(task)
window.agentOps.tasks.update(id, updates)
window.agentOps.tasks.delete(id)
```

### Methods

#### `tasks.list(params?)` → `{ items: Task[], total: number }`

List tasks with optional filtering.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | number | 0 | Items to skip |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `pending`, `assigned`, `running`, `done`, `failed`, `blocked` |
| `goalId` | string | — | Filter by parent goal |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `title`, `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### `tasks.get(id)` → `Task`

Get a single task by ID.

#### `tasks.create(task)` → `Task`

Create a task and optionally link to a goal and agent.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | yes | 1–500 chars |
| `description` | string | no | max 5000 chars |
| `goalId` | string | no | Must reference an existing goal |
| `assigneeAgentId` | string | no | Must reference an existing agent |

#### `tasks.update(id, updates)` → `Task`

Update task fields.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | string | yes | — |
| `updates` | object | yes | Allowed fields: `title`, `description`, `status`, `goalId`, `assigneeAgentId` |

Status transitions: `pending` → `assigned` → `running` → `done` | `failed` | `blocked`

#### `tasks.delete(id)` → `{ deleted: true, id }`

Delete a task. Cascades to all child task logs.

### Task Object Shape

```js
{
  id: string,                // UUID
  title: string,
  description: string | null,
  goalId: string | null,     // Parent goal
  assigneeAgentId: string | null,  // Assigned agent
  status: 'pending' | 'assigned' | 'running' | 'done' | 'failed' | 'blocked',
  outputSummary: string | null,    // Final output (set on completion)
  startedAt: number | null,        // epoch ms
  completedAt: number | null,
  createdAt: number,
  updatedAt: number
}
```

---

## DAG Builder

The DAG Builder is the relationship layer between goals and tasks. It operates at two levels:

### Current (MVP): Goal-based DAG

Tasks are grouped under goals via `goalId` foreign key. Ordering is implicit via `createdAt`. The DAG is enforced at the data layer:

- `tasks.goal_id` → `goals.id` with `ON DELETE CASCADE`
- `tasks.agent_id` → `agents.id` with `ON DELETE SET NULL`
- Composite index `idx_tasks_goal_status` for efficient filtered queries

### Planned (Milestone M4): Workflow Engine DAG

The Orchestrator component (see below) implements explicit DAG execution with:

- Task nodes with typed execution (`agent`, `noop`, `manual`)
- Dependency edges defining execution order
- Parallel execution with configurable `maxParallel`
- Retry with exponential backoff
- Failure strategies (`fail-fast`, `best-effort`)

### Querying the Goal-based DAG

```js
// Get all tasks for a goal
const { items } = await window.agentOps.tasks.list({ goalId, sortBy: 'createdAt' });

// Get aggregated stats
const stats = await window.agentOps.stats.summary();
// Returns: { agents: { total, running, idle, error }, tasks: { total, pending, running, done, failed } }
```

---

## Orchestrator

The Orchestrator is the DAG workflow engine. It defines, executes, and monitors multi-step workflows composed of typed task nodes connected by dependency edges.

### IPC Interface

```js
// Renderer API
window.agentOps.orchestrator.list(params?)
window.agentOps.orchestrator.get(id)
window.agentOps.orchestrator.create(definition)
window.agentOps.orchestrator.start(id)
window.agentOps.orchestrator.pause(id)
window.agentOps.orchestrator.resume(id)
window.agentOps.orchestrator.cancel(id)
window.agentOps.orchestrator.progress(id)
window.agentOps.orchestrator.task.get(dagId, taskId)
window.agentOps.orchestrator.task.complete(dagId, taskId, output, success)
```

### Methods

#### `orchestrator.list(params?)` → `{ items: Dag[], total: number }`

List all DAG workflow definitions with pagination and status filter.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | number | 0 | Items to skip |
| `limit` | number | 20 | Items per page |
| `status` | string | — | Filter: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `paused` |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `name`, `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### `orchestrator.get(id)` → `DagFull`

Returns the full DAG definition including all task nodes, edges, and current execution state.

#### `orchestrator.create(definition)` → `DagFull`

Create a new DAG workflow definition.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–200 chars |
| `description` | string | no | max 2000 chars |
| `tasks` | array | yes | Non-empty array of task nodes (see below) |
| `edges` | array | no | Dependency edges `{ from, to }` |
| `maxParallel` | number | no | 1–32, max concurrent tasks |
| `retryMax` | number | no | 0–10, max retries per failed task |
| `retryBackoffMs` | number | no | 100–60000, initial backoff |
| `retryBackoffMult` | number | no | 1–10, backoff multiplier |
| `retryMaxBackoffMs` | number | no | 1000–300000, backoff cap |
| `onFailure` | string | no | `fail-fast` or `best-effort` |

**Task node shape:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Task display name |
| `taskType` | string | no | `agent` (default), `noop`, `manual` |
| `agentId` | string | no | Agent to execute (for `agent` type) |
| `config` | object | no | Task-specific configuration |

#### `orchestrator.start(id)` → `{ ok: true, dagId }`

Begin executing the DAG. Tasks without dependencies start immediately; others wait for predecessors to complete.

#### `orchestrator.pause(id)` → `{ ok: true, dagId }`

Pause the DAG. Running tasks continue to completion; no new tasks are started.

#### `orchestrator.resume(id)` → `{ ok: true, dagId }`

Resume a paused DAG. Queued tasks begin executing according to their dependencies.

#### `orchestrator.cancel(id)` → `{ ok: true, dagId }`

Cancel the DAG. Running tasks are killed; pending tasks are marked cancelled.

#### `orchestrator.progress(id)` → `DagProgress`

Returns current execution progress.

```js
{
  total: number,
  pending: number,
  running: number,
  succeeded: number,
  failed: number,
  cancelled: number,
  percent: number        // 0–100
}
```

#### `orchestrator.task.get(dagId, taskId)` → `DagTask`

Get detail of a single task within a DAG, including its output if completed.

#### `orchestrator.task.complete(dagId, taskId, output, success)` → `{ ok: true }`

Mark a `manual`-type task as complete or failed. Only applicable to tasks with `taskType: 'manual'` that are in `running` status.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `dagId` | string | yes | Parent DAG ID |
| `taskId` | string | yes | Task ID |
| `output` | object | no | Task output data |
| `success` | boolean | yes | `true` for succeeded, `false` for failed |

### DAG Object Shape

```js
// Summary (list)
{
  id: string,
  name: string,
  description: string | null,
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'paused',
  taskCount: number,
  createdAt: number,
  updatedAt: number
}

// Full (get/create)
{
  id: string,
  name: string,
  description: string | null,
  status: string,
  tasks: DagTask[],
  edges: { from: string, to: string }[],
  maxParallel: number,
  retryMax: number,
  retryBackoffMs: number,
  retryBackoffMult: number,
  retryMaxBackoffMs: number,
  onFailure: 'fail-fast' | 'best-effort',
  createdAt: number,
  updatedAt: number
}
```

### DAG Task Shape

```js
{
  id: string,
  title: string,
  taskType: 'agent' | 'noop' | 'manual',
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled',
  agentId: string | null,
  output: object | null,
  startedAt: number | null,
  endedAt: number | null
}
```

---

## Agent Engine

The Agent Engine (`src/main/agent-engine.js`) is the process lifecycle manager. It spawns, monitors, pauses, and terminates CLI agent processes. It is implemented as the `AgentEngine` class extending `EventEmitter`.

### Architecture

```
                    ┌──────────────────────┐
                    │   Agent Controller   │
                    │   (IPC handlers)     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    AgentEngine       │
                    │  extends EventEmitter│
                    │                      │
                    │  Map<agentId, Agent> │
                    │  + state machine     │
                    │  + resource monitor  │
                    │  + crash recovery    │
                    └──────────┬───────────┘
                               │ spawn / kill
                    ┌──────────▼───────────┐
                    │   child_process      │
                    │   (stdio: pipe)      │
                    └──────────────────────┘
```

### IPC Interface

```js
// Config CRUD (persistent agent definitions)
window.agentOps.agents.list(params?)
window.agentOps.agents.get(id)
window.agentOps.agents.create(agent)
window.agentOps.agents.update(id, updates)
window.agentOps.agents.delete(id)
window.agentOps.agents.healthCheck(id)

// Live process management
window.agentOps.agents.spawn(config)
window.agentOps.agents.status(id)
window.agentOps.agents.kill(id)
window.agentOps.agents.pause(id)
window.agentOps.agents.resume(id)
window.agentOps.agents.logs(id, limit?, offset?)
```

### Config CRUD (Persistent)

#### `agents.list(params?)` → `{ items: Agent[], total: number }`

List registered agent configurations with pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | number | 0 | Items to skip |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `idle`, `running`, `error`, `paused`, `terminated`, `created` |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `name`, `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### `agents.get(id)` → `Agent`

Get a single agent configuration by ID.

#### `agents.create(agent)` → `Agent`

Register a new agent configuration.

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–200 chars |
| `type` | string | no | `claude`, `codex`, `gemini`, `opencode`, `cursor`, `custom` |
| `command` | string | no | max 1000 chars |
| `execPath` | string | no | max 1000 chars |
| `cwd` | string | no | max 500 chars |

#### `agents.update(id, updates)` → `Agent`

Update agent config. Allowed fields: `name`, `type`, `status`, `command`, `execPath`, `cwd`.

#### `agents.delete(id)` → `{ deleted: true, id }`

Remove agent config. Does not kill running processes — use `agents:kill` first if needed.

#### `agents.healthCheck(id)` → `{ ok, execValid, processAlive, status }`

Check agent executable reachability and process state.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | `execValid && processAlive` |
| `execValid` | boolean | Executable exists and is runnable |
| `processAlive` | boolean | Process is running and not killed |
| `status` | string | Current session or config status |

### Agent Object Shape (Config)

```js
{
  id: string,              // UUID
  name: string,
  type: 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor' | 'custom',
  status: 'idle' | 'running' | 'error' | 'paused' | 'terminated' | 'created',
  command: string | null,
  execPath: string | null,
  cwd: string | null,
  ownerRole: string,       // 'admin' | 'operator' | 'viewer'
  createdAt: number,       // epoch ms
  updatedAt: number
}
```

### Live Process Management

#### `agents.spawn(config)` → `{ id, status }`

Spawn a CLI agent process. Validates the executable path before spawning.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `execPath` | string | yes | Path to executable (validated via `stat` + `which` fallback) |
| `name` | string | no | Display label (defaults to basename of execPath) |
| `args` | string[] | no | CLI arguments |
| `cwd` | string | no | Working directory (defaults to `process.cwd()`) |
| `env` | object | no | Environment variables (merged with `process.env`) |
| `resourceLimits` | object | no | See [Resource Limits](#resource-limits) |
| `recovery` | object | no | See [Crash Recovery](#crash-recovery) |

#### `agents.status(id)` → `AgentStatus`

Query live session status.

```js
{
  id: string,
  name: string,               // display label
  status: 'created' | 'running' | 'paused' | 'terminated' | 'errored',
  pid: number,
  exitCode: number | null,
  error: string | null,
  startedAt: number,          // epoch ms
  endedAt: number | null,
  logCount: number,
  resourceUsage: { rss: number, cpuPercent: number } | null,
  resourceLimits: { maxCpuPercent: number, maxMemoryMB: number, checkIntervalMs: number },
  retryCount: number
}
```

#### `agents.kill(id)` → `{ id, status: 'terminated' }`

Terminate a running agent process.

- Sends `SIGTERM` first
- If process doesn't exit within 5 seconds, escalates to `SIGKILL`
- Sets `_intentionalStop = true` to suppress crash recovery
- Returns immediately (does not wait for exit)

#### `agents.pause(id)` → `{ id, status: 'paused' }`

Pause a running agent via `SIGSTOP`. Stops resource monitoring while paused.

#### `agents.resume(id)` → `{ id, status: 'running' }`

Resume a paused agent via `SIGCONT`. Restarts resource monitoring.

#### `agents.logs(id, limit?, offset?)` → `LogEntry[]`

Get captured stdout/stderr output for a live agent process.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | required | Agent session ID |
| `limit` | number | 500 | Max entries to return |
| `offset` | number | 0 | Entries to skip |

### Agent Status Constants

```js
const AGENT_STATUS = {
  CREATED: 'created',       // Process created, waiting for 'spawn' event
  RUNNING: 'running',       // Process spawned successfully
  PAUSED: 'paused',         // Process suspended via SIGSTOP
  TERMINATED: 'terminated', // Process exited cleanly (code 0)
  ERRORED: 'errored',       // Process exited with error, spawn failure, or runtime error
};
```

### Lifecycle State Machine

```
                    ┌─────────┐
                    │ created │
                    └────┬────┘
                         │ spawn success
                         ▼
              ┌─────── running ◄──────┐
              │          │            │
         SIGSTOP         │ exit       │ SIGCONT
              │    ┌─────┴──────┐     │
              ▼    ▼            ▼     │
          paused  terminated  errored │
              │                       │
              └───────────────────────┘
```

**Valid transitions:**

| From | To |
|------|-----|
| `created` | `running`, `errored` |
| `running` | `paused`, `terminated`, `errored` |
| `paused` | `running`, `terminated`, `errored` |
| `terminated` | *(terminal — no transitions)* |
| `errored` | *(terminal — no transitions)* |

### Resource Limits

The engine monitors agent process resource usage at configurable intervals. If limits are exceeded, the process is killed and emits a `resource-limit` event.

```js
{
  maxCpuPercent: 80,     // Emit warning when exceeded
  maxMemoryMB: 512,      // Kill process when exceeded
  checkIntervalMs: 5000  // Polling interval
}
```

| Field | Type | Default | Action on exceed |
|-------|------|---------|-----------------|
| `maxMemoryMB` | number | 512 | Kill process (`SIGKILL`) |
| `maxCpuPercent` | number | 80 | Emit `resource-limit` event (no auto-kill) |
| `checkIntervalMs` | number | 5000 | — |

### Crash Recovery

The engine can automatically restart crashed agents with exponential backoff.

```js
{
  enabled: false,
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2
}
```

Recovery is suppressed when:
- The agent was intentionally stopped (`agents:kill`)
- The process exited cleanly (`code === 0`) and `_restartOnCleanExit` is false

### Internal Module API (`agent-engine.js`)

The `AgentEngine` class can also be used directly from the main process:

```js
const { AgentEngine, AGENT_STATUS, VALID_TRANSITIONS } = require('./agent-engine');

const engine = new AgentEngine();

// Spawn
const { agentId } = engine.spawnAgent({
  execPath: '/usr/local/bin/claude',
  args: ['--print'],
  cwd: '/path/to/project',
  env: { ANTHROPIC_API_KEY: '...' },
  label: 'claude-code',
  resourceLimits: { maxMemoryMB: 1024 },
  recovery: { enabled: true, maxRetries: 5 },
});

// Control
engine.pauseAgent(agentId);    // SIGSTOP
engine.resumeAgent(agentId);   // SIGCONT
engine.stopAgent(agentId);     // SIGTERM → SIGKILL after 5s
engine.getAgent(agentId);      // current state object
engine.listAgents();           // all agents array
engine.getLogs(agentId, { limit?, offset? }); // captured output
engine.removeAgent(agentId);   // must be stopped first
engine.getValidTransitions(agentId); // allowed next states
engine.shutdownAll();          // graceful terminate all (async)

// Events
engine.on('log', ({ agentId, type, data }) => { /* stdout | stderr */ });
engine.on('status-change', ({ agentId, status, from }) => { /* state transition */ });
engine.on('exit', ({ agentId, code, signal }) => { /* process exited */ });
engine.on('resource-limit', ({ agentId, type, limit, actual }) => { /* limit exceeded */ });
engine.on('recovery-attempt', ({ agentId, attempt, maxRetries, backoffMs }) => {});
engine.on('recovery-exhausted', ({ agentId, retries }) => {});
engine.on('recovery-success', ({ agentId, attempt }) => {});
engine.on('recovery-failed', ({ agentId, error }) => {});
```

---

## Message Bus

The Message Bus is the real-time event layer that pushes state changes from the main process to the renderer. It uses Electron's `webContents.send()` under the hood.

### Push Events (Main → Renderer)

#### Agent Events

| Channel | Payload | Trigger |
|---------|---------|---------|
| `agent:status` | `{ agentId, status, timestamp }` | Agent status changes |
| `task:status` | `{ taskId, status, timestamp }` | Task status changes |
| `task:log` | `{ taskId, stream, content, timestamp }` | Real-time stdout/stderr from agent process |
| `task:output` | `{ taskId, summary }` | Task completion with output summary |
| `logs:new` | `LogEntry` | New log entry appended (broadcast) |

#### Orchestrator Events

| Channel | Payload Type | Trigger |
|---------|-------------|---------|
| `orchestrator:event` | `{ type, ...data }` | DAG lifecycle events |
| `orchestrator:progress` | `DagProgress` | DAG progress update |

**Orchestrator event types:**

| Event Type | Description |
|------------|-------------|
| `dag:created` | New DAG created |
| `dag:started` | DAG execution started |
| `dag:completed` | All tasks succeeded |
| `dag:failed` | DAG failed (task failure + fail-fast) |
| `dag:cancelled` | DAG cancelled by user |
| `dag:paused` | DAG execution paused |
| `dag:resumed` | DAG execution resumed |
| `task:ready` | Task dependencies satisfied, ready to execute |
| `task:dispatched` | Task sent to agent for execution |
| `task:running` | Agent started processing task |
| `task:completed` | Task succeeded |
| `task:failed` | Task failed |
| `task:skipped` | Task skipped (upstream failure) |
| `task:cancelled` | Task cancelled |
| `task:retrying` | Task retrying after failure |

### LogEntry Shape

```js
{
  id: string,           // "log-{timestamp}-{random}"
  agentId: string,
  message: string,
  level?: string,       // 'info' | 'warn' | 'error' | 'debug'
  timestamp: number     // epoch ms
}
```

### Subscribing to Events

From the renderer, use the `logs.onNew()` convenience method:

```js
const unsubscribe = window.agentOps.logs.onNew((entry) => {
  console.log(`[${entry.level}] ${entry.message}`);
});

// Later: unsubscribe();
```

For orchestrator events, listen on the `orchestrator:event` channel:

```js
window.electronAPI.on('orchestrator:event', (event, data) => {
  console.log(`DAG event: ${data.type}`, data);
});

window.electronAPI.on('orchestrator:progress', (event, progress) => {
  console.log(`Progress: ${progress.percent}%`);
});
```

---

## Data Models

### SQLite Schema

Database path: `<userData>/data/agentops.db` (WAL mode)

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/agentops-desktop/data/agentops.db` |
| Windows | `%APPDATA%/agentops-desktop/data/agentops.db` |
| Linux | `~/.config/agentops-desktop/data/agentops.db` |

### Table: `agents`

```sql
CREATE TABLE agents (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  executable_path   TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  agent_type        TEXT NOT NULL,
  config_json       TEXT DEFAULT '{}',
  status            TEXT DEFAULT 'idle',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'custom',
  command           TEXT,
  exec_path         TEXT,
  cwd               TEXT
);
```

### Table: `goals`

```sql
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

### Table: `tasks`

```sql
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  goal_id         TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'pending',
  output_summary  TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### Table: `task_logs`

```sql
CREATE TABLE task_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stream    TEXT NOT NULL,
  content   TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
```

### Table: `settings`

```sql
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_tasks_goal        ON tasks(goal_id);
CREATE INDEX idx_tasks_agent       ON tasks(agent_id);
CREATE INDEX idx_task_logs_task    ON task_logs(task_id);
CREATE INDEX idx_agents_type       ON agents(type);
CREATE INDEX idx_agents_status     ON agents(status);
CREATE INDEX idx_goals_status      ON goals(status);
CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_tasks_goal_status ON tasks(goal_id, status);
```

---

## Error Handling

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Agent process crash | `exit` event, exit code != 0 | Mark task failed, log stderr, UI notification |
| Agent timeout | `resourceLimits.checkIntervalMs` polling | Kill process if memory limit exceeded |
| Agent executable missing | `agents:health-check` → `execValid: false` | Mark agent offline, disable assignment |
| SQLite write failure | try/catch on db.run | Log error, UI toast, don't block other ops |
| IPC disconnect | renderer `visibilitychange` | Re-register listeners, pull latest state |
| App crash | main process `uncaughtException` | Log to crash file, prompt recovery on next launch |
| Crash recovery | `exit` event + recovery config | Auto-restart with exponential backoff (if enabled) |

---

## Security Boundaries

| Boundary | Measure |
|----------|---------|
| **Preload isolation** | `contextBridge` exposes minimal API; renderer cannot access Node.js |
| **Auth tokens** | Session-based, auto-rotated, cached in preload |
| **RBAC** | Three roles with per-channel permission checks |
| **Ownership** | Operators can only access their own resources |
| **Input validation** | All IPC handlers validate types, lengths, enums via schema |
| **SQL injection** | `better-sqlite3` parameterized queries, no string concatenation |
| **Path traversal** | `executable_path` and `working_directory` validated against allowed ranges |
| **Process isolation** | Agent processes run as current user, no privilege escalation |

---

## Repository Layer

Repositories are initialized in `src/main/ipc/index.js` and injected into controllers during bootstrap:

```js
const repos = createRepositories(db);

// Injected into controllers:
agentController.setRepository(repos.agents);
goalController.setRepository(repos.goals);
taskController.setRepository(repos.tasks);
logController.setRepository(repos.taskLogs);
settingsController.setRepository(repos.settings);
orchestratorController.setRepository(repos.orchestrator);
```

---

_This document is maintained alongside `docs/ARCHITECTURE.md` and `docs/openapi.yaml`. Changes to the Agent Runtime must be reflected here._
