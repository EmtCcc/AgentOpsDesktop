# AgentOps Desktop HTTP API Reference

> **Base URL:** `http://localhost:3967`
> **Framework:** Hono v4 on `@hono/node-server`
> **Default port:** 3967 (configurable via `PORT` env var)

## Overview

AgentOps Desktop exposes an HTTP REST API for managing AI agents, goals, tasks, schedules, squads, cost budgets, adapters, and skills. The API also provides health monitoring, authentication, and system statistics.

All responses follow a standard envelope:

```json
{
  "ok": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found",
    "status": 404
  }
}
```

## Table of Contents

- [Authentication](#authentication)
- [Error Codes](#error-codes)
- [Public Endpoints](#public-endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Debug](#debug)
  - [Docs](#docs)
- [Protected Endpoints](#protected-endpoints)
  - [Agents](#agents)
  - [Goals](#goals)
  - [Tasks](#tasks)
  - [Logs](#logs)
  - [Stats](#stats)
  - [Settings](#settings)
  - [Schedules](#schedules)
  - [Squads](#squads)
  - [Cost](#cost)
  - [Adapters](#adapters)
  - [Adapter Registry](#adapter-registry)
  - [Skills](#skills)

---

## Authentication

All routes under `/api/*` require a Bearer token. Obtain a token via `POST /auth/login`.

```
Authorization: Bearer <token>
```

Unauthenticated requests to `/api/*` receive `401 Unauthorized`.

### Login Flow

```
POST /auth/login          → get token
GET  /api/agents          → use token in Authorization header
POST /auth/rotate         → rotate token (old one invalidated)
POST /auth/logout         → destroy session
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body or query params failed validation |
| `CONFLICT` | 409 | Duplicate resource (e.g., adapter type already exists) |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
| `HTTP_ERROR` | varies | Hono HTTP exception |
| `ADAPTER_ERROR` | 422 | Adapter load/unload failure |
| `INSTALL_ERROR` | 422 | Adapter installation failure |
| `REGISTER_ERROR` | 422 | Local adapter registration failure |
| `UNINSTALL_ERROR` | 422 | Adapter uninstall failure |
| `UPDATE_ERROR` | 422 | Adapter update failure |

### Validation Errors

Validation errors include a `details` array describing each field violation:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "name is required",
    "status": 422,
    "details": [{ "field": "name", "message": "is required" }]
  }
}
```

---

## Public Endpoints

These endpoints do not require authentication.

### Health

#### `GET /health`

System health check. Returns uptime, memory, IPC metrics, renderer stats, DB connectivity, alerts, and overall status.

**Response:**

| Status | Meaning |
|--------|---------|
| 200 | OK or degraded |
| 503 | Unhealthy (error-level alerts present) |

```json
{
  "status": "ok",
  "ts": "2026-05-29T12:00:00.000Z",
  "uptimeMs": 3600000,
  "memory": {
    "rss": 120000000,
    "heapUsed": 60000000,
    "heapTotal": 100000000,
    "external": 5000000
  },
  "system": {
    "totalMem": 17179869184,
    "freeMem": 8589934592,
    "loadAvg": [1.5, 1.2, 1.0],
    "cpus": 8
  },
  "ipc": {
    "calls": 1523,
    "errors": 2,
    "avgLatencyMs": 4.2
  },
  "renderer": {
    "crashes": 0,
    "unresponsive": 0
  },
  "app": {
    "startedAt": 1716900000000,
    "uncaughtExceptions": 0,
    "unhandledRejections": 0
  },
  "db": {
    "ok": true
  },
  "alerts": [],
  "uptime": {
    "uptimePercent": 99.95,
    "totalUptimeMs": 86400000,
    "totalDowntimeMs": 43200,
    "breakdown": {
      "okMs": 86356800,
      "degradedMs": 0,
      "unhealthyMs": 43200
    },
    "lastStatusChange": "ok",
    "lastStatusChangeAt": "2026-05-29T11:00:00.000Z",
    "transitions": []
  }
}
```

---

### Auth

#### `POST /auth/login`

Create a new session. Returns a Bearer token.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | No | Session role. Default: `"operator"` |

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "token": "tok_a1b2c3d4e5",
    "role": "operator",
    "expiresAt": 1717000000000
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3967/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

#### `POST /auth/logout`

Destroy the current session.

**Response (200):**

```json
{
  "ok": true,
  "data": { "ok": true }
}
```

---

#### `GET /auth/status`

Check if the current session is valid.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "isValid": true,
    "token": "tok_a1b2c3d4e5",
    "role": "operator",
    "expiresAt": 1717000000000,
    "createdAt": 1716900000000
  }
}
```

If no valid session exists:

```json
{
  "ok": true,
  "data": { "isValid": false }
}
```

---

#### `POST /auth/rotate`

Rotate the session token. The old token is immediately invalidated.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "token": "tok_f6g7h8i9j0",
    "role": "operator",
    "expiresAt": 1717100000000
  }
}
```

---

### Debug

#### `GET /routes`

List all registered Hono routes. Useful for debugging.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    { "method": "GET", "path": "/health" },
    { "method": "POST", "path": "/auth/login" },
    { "method": "GET", "path": "/api/agents" }
  ]
}
```

---

### Docs

#### `GET /docs/openapi.yaml`

Serve the OpenAPI 3.0 spec YAML file.

**Response:** `text/yaml` (200) or 404 if not generated.

#### `GET /docs`

Serve the API documentation HTML page.

**Response:** `text/html` (200) or 404 if not generated.

---

## Protected Endpoints

All endpoints below require `Authorization: Bearer <token>`.

### Agents

Agent configuration CRUD.

#### `GET /api/agents`

List agents with pagination and filtering.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `status` | string | `idle`, `running`, `paused`, `error` | Filter by status |
| `sortBy` | string | `name`, `status`, `createdAt`, `updatedAt` | Sort field |
| `sortOrder` | string | `asc`, `desc` | Sort direction |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "agent-1",
      "name": "claude-dev",
      "type": "autonomous",
      "status": "idle",
      "command": "claude --print",
      "execPath": "/usr/local/bin/claude",
      "cwd": "/project",
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ]
}
```

---

#### `GET /api/agents/:id`

Get a single agent by ID.

**Response (200):** Agent object (same shape as above).

**Response (404):**

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Agent not found" }
}
```

---

#### `POST /api/agents`

Create a new agent.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | Yes | 1–200 chars | Agent name |
| `type` | string | No | `autonomous`, `supervised`, `manual` | Agent type |
| `command` | string | No | max 1000 chars | CLI command |
| `execPath` | string | No | max 1000 chars | Executable path |
| `cwd` | string | No | max 500 chars | Working directory |

**Response (201):** Created agent object.

**Example:**

```bash
curl -X POST http://localhost:3967/api/agents \
  -H "Authorization: Bearer tok_a1b2c3d4e5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "claude-dev",
    "type": "autonomous",
    "execPath": "/usr/local/bin/claude",
    "cwd": "/project"
  }'
```

---

#### `PATCH /api/agents/:id`

Update an existing agent.

**Request Body:** Same fields as create, all optional.

**Response (200):** Updated agent object.

**Response (404):** Agent not found.

---

#### `DELETE /api/agents/:id`

Delete an agent.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "agent-1" }
}
```

---

### Goals

Goal management — group tasks under strategic objectives.

#### `GET /api/goals`

List goals with pagination and filtering.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `status` | string | `active`, `completed`, `archived` | Filter by status |
| `sortBy` | string | `title`, `status`, `createdAt`, `updatedAt` | Sort field |
| `sortOrder` | string | `asc`, `desc` | Sort direction |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "goal-1",
      "title": "Ship MVP",
      "description": "Launch the minimum viable product",
      "status": "active",
      "taskIds": ["task-1", "task-2"],
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ]
}
```

---

#### `GET /api/goals/:id`

Get a single goal by ID.

**Response (200):** Goal object.

---

#### `POST /api/goals`

Create a new goal.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `title` | string | Yes | 1–500 chars | Goal title |
| `description` | string | No | max 5000 chars | Goal description |

**Response (201):** Created goal object.

---

#### `PATCH /api/goals/:id`

Update an existing goal.

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `title` | string | 1–500 chars | Goal title |
| `description` | string | max 5000 chars | Goal description |
| `status` | string | `active`, `completed`, `archived` | Goal status |

**Response (200):** Updated goal object.

---

#### `DELETE /api/goals/:id`

Delete a goal.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "goal-1" }
}
```

---

### Tasks

Task management — create, assign, track work items linked to goals.

#### `GET /api/tasks`

List tasks with pagination and filtering.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `status` | string | `pending`, `assigned`, `running`, `done`, `failed`, `blocked` | Filter by status |
| `goalId` | string | — | Filter by parent goal |
| `sortBy` | string | `createdAt`, `updatedAt`, `title`, `status` | Sort field |
| `sortOrder` | string | `asc`, `desc` | Sort direction |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "task-1",
      "title": "Implement auth",
      "description": "Add JWT-based auth flow",
      "status": "pending",
      "goalId": "goal-1",
      "assigneeAgentId": "agent-1",
      "dependsOn": null,
      "output": null,
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ]
}
```

---

#### `GET /api/tasks/:id`

Get a single task by ID.

**Response (200):** Task object.

---

#### `POST /api/tasks`

Create a new task.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `title` | string | Yes | 1–500 chars | Task title |
| `description` | string | No | max 5000 chars | Task description |
| `goalId` | string | No | — | Parent goal ID |
| `assigneeAgentId` | string | No | — | Assigned agent ID |
| `dependsOn` | object | No | — | Dependency specification |

**Response (201):** Created task object.

---

#### `PATCH /api/tasks/:id`

Update an existing task.

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `title` | string | 1–500 chars | Task title |
| `description` | string | max 5000 chars | Task description |
| `status` | string | `pending`, `assigned`, `running`, `done`, `failed`, `blocked` | Task status |
| `goalId` | string | — | Parent goal ID |
| `assigneeAgentId` | string | — | Assigned agent ID |
| `output` | object | — | Task output (set on completion) |
| `dependsOn` | object | — | Dependency specification |

**Response (200):** Updated task object.

---

#### `DELETE /api/tasks/:id`

Delete a task.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "task-1" }
}
```

---

#### `GET /api/tasks/:id/upstream`

Get upstream task outputs for handoff context. Returns the output of all tasks that this task depends on.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "taskId": "task-0",
      "title": "Research",
      "output": { "findings": "..." }
    }
  ]
}
```

---

#### `GET /api/tasks/:id/handoffs`

List handoffs involving this task (both outgoing and incoming).

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "outgoing": [...],
    "incoming": [...]
  }
}
```

---

### Logs

Log entry management.

#### `GET /api/logs`

List log entries with optional filtering.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `agentId` | string | — | Filter by agent ID |
| `taskId` | string | — | Filter by task ID |
| `limit` | number | 1–500 | Max entries to return |
| `offset` | number | min: 0 | Pagination offset |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "log-1",
      "agentId": "agent-1",
      "taskId": "task-1",
      "message": "Agent started successfully",
      "level": "info",
      "stream": "stdout",
      "timestamp": 1717000000000
    }
  ]
}
```

---

#### `POST /api/logs`

Append a log entry.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `agentId` | string | No | — | Agent ID |
| `taskId` | string | No | — | Task ID |
| `message` | string | Yes | — | Log message |
| `level` | string | No | `debug`, `info`, `warn`, `error` | Log level |
| `stream` | string | No | `stdout`, `stderr` | Output stream |

**Response (201):** Created log entry.

---

### Stats

#### `GET /api/stats/summary`

Aggregate dashboard statistics.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "agents": {
      "total": 5,
      "running": 2,
      "idle": 2,
      "error": 1
    },
    "tasks": {
      "total": 12,
      "pending": 3,
      "running": 3,
      "done": 4,
      "failed": 2
    },
    "goals": {
      "total": 3,
      "active": 2,
      "completed": 1
    }
  }
}
```

---

### Settings

Application settings management.

#### `GET /api/settings`

Get all settings.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "theme": "dark",
    "logLevel": "info",
    "autoStartAgents": false,
    "maxConcurrentAgents": 4
  }
}
```

---

#### `PATCH /api/settings`

Update settings. Merges provided keys into existing settings.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `settings` | object | Yes | Key-value pairs to update |

**Example:**

```bash
curl -X PATCH http://localhost:3967/api/settings \
  -H "Authorization: Bearer tok_a1b2c3d4e5" \
  -H "Content-Type: application/json" \
  -d '{"settings": {"theme": "light", "logLevel": "debug"}}'
```

**Response (200):** Updated full settings object.

---

### Schedules

Cron-based task scheduling.

#### `GET /api/schedules`

List schedules with pagination.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "schedule-1",
      "name": "Daily report",
      "cronExpr": "0 9 * * *",
      "goalId": "goal-1",
      "agentId": "agent-1",
      "taskTemplate": { "title": "Generate daily report" },
      "maxExecutions": 30,
      "enabled": true,
      "nextRunAt": "2026-05-30T09:00:00.000Z",
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ],
  "total": 1
}
```

---

#### `GET /api/schedules/:id`

Get a single schedule.

**Response (200):** Schedule object.

---

#### `POST /api/schedules`

Create a new schedule. The `nextRunAt` is automatically calculated from the cron expression.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | Yes | 1–200 chars | Schedule name |
| `cronExpr` | string | Yes | valid cron | Cron expression (5-field) |
| `goalId` | string | No | — | Associated goal |
| `agentId` | string | No | — | Agent to execute |
| `taskTemplate` | object | No | — | Template for generated tasks |
| `maxExecutions` | number | No | — | Max times to fire |

**Response (201):** Created schedule with computed `nextRunAt`.

**Example:**

```bash
curl -X POST http://localhost:3967/api/schedules \
  -H "Authorization: Bearer tok_a1b2c3d4e5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily report",
    "cronExpr": "0 9 * * *",
    "agentId": "agent-1",
    "taskTemplate": { "title": "Generate daily report" }
  }'
```

---

#### `PATCH /api/schedules/:id`

Update a schedule. If `cronExpr` changes, `nextRunAt` is recalculated.

**Request Body:** Same fields as create, all optional. Additional:

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable/disable the schedule |

**Response (200):** Updated schedule.

---

#### `DELETE /api/schedules/:id`

Delete a schedule.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "schedule-1" }
}
```

---

#### `POST /api/schedules/:id/pause`

Disable a schedule (set `enabled: false`).

**Response (200):** Updated schedule.

---

#### `POST /api/schedules/:id/resume`

Enable a schedule and recalculate `nextRunAt`.

**Response (200):** Updated schedule.

---

#### `GET /api/schedules/:id/logs`

Get trigger logs for a schedule.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max log entries |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "slog-1",
      "scheduleId": "schedule-1",
      "triggeredAt": "2026-05-29T09:00:00.000Z",
      "taskId": "task-5",
      "status": "success"
    }
  ]
}
```

---

### Squads

Agent grouping for batch operations.

#### `GET /api/squads`

List squads with members.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `status` | string | `idle`, `running`, `error` | Filter by status |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "squad-1",
      "name": "Dev Team",
      "description": "Main development squad",
      "leaderId": "agent-1",
      "status": "idle",
      "members": [
        { "agentId": "agent-1", "role": "leader" },
        { "agentId": "agent-2", "role": "member" }
      ],
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ],
  "meta": { "total": 1, "offset": 0, "limit": 20 }
}
```

---

#### `GET /api/squads/:id`

Get a single squad with members.

**Response (200):** Squad object with `members` array.

---

#### `POST /api/squads`

Create a new squad.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | Yes | 1–200 chars | Squad name |
| `description` | string | No | max 1000 chars | Squad description |
| `leaderId` | string | No | — | Leader agent ID |
| `members` | array | No | — | Initial members (agentId strings or `{agentId, role}` objects) |

**Response (201):** Created squad with members.

**Example:**

```bash
curl -X POST http://localhost:3967/api/squads \
  -H "Authorization: Bearer tok_a1b2c3d4e5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dev Team",
    "leaderId": "agent-1",
    "members": [
      {"agentId": "agent-1", "role": "leader"},
      {"agentId": "agent-2", "role": "member"}
    ]
  }'
```

---

#### `PATCH /api/squads/:id`

Update a squad. Handles leader rotation automatically.

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1–200 chars | Squad name |
| `description` | string | max 1000 chars | Squad description |
| `leaderId` | string | — | New leader agent ID |
| `status` | string | `idle`, `running`, `error` | Squad status |

**Response (200):** Updated squad.

---

#### `DELETE /api/squads/:id`

Delete a squad.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "squad-1" }
}
```

---

#### `POST /api/squads/:id/members`

Add a member to a squad.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `agentId` | string | Yes | — | Agent to add |
| `role` | string | No | `member`, `leader` | Member role. Default: `member` |

**Response (201):** Created member record.

---

#### `DELETE /api/squads/:id/members/:agentId`

Remove a member from a squad.

**Response (200):**

```json
{
  "ok": true,
  "data": { "removed": true }
}
```

---

#### `GET /api/squads/:id/status`

Get aggregated squad status — combines member agent statuses.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "squadId": "squad-1",
    "squadName": "Dev Team",
    "status": "running",
    "memberCount": 3,
    "statusCounts": {
      "idle": 1,
      "running": 2,
      "error": 0,
      "offline": 0
    },
    "agents": [
      { "agentId": "agent-1", "name": "claude-dev", "status": "running", "role": "leader" },
      { "agentId": "agent-2", "name": "codex-dev", "status": "running", "role": "member" },
      { "agentId": "agent-3", "name": "gemini-dev", "status": "idle", "role": "member" }
    ]
  }
}
```

**Status aggregation rules:**
- If any member has `error` status → squad status is `error`
- If any member has `running` status → squad status is `running`
- Otherwise → squad status is `idle`

---

#### `POST /api/squads/:id/start`

Batch start all agents in a squad (set squad status to `running`).

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "squadId": "squad-1",
    "status": "running",
    "memberCount": 3
  }
}
```

---

#### `POST /api/squads/:id/stop`

Batch stop all agents in a squad (set squad status to `idle`).

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "squadId": "squad-1",
    "status": "idle",
    "memberCount": 3
  }
}
```

---

### Cost

Budget management and usage tracking.

#### `GET /api/cost/budgets`

List all budgets.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "budget-1",
      "agentId": "agent-1",
      "monthlyLimit": 100.00,
      "currency": "USD",
      "warnPct": 80,
      "pausePct": 95,
      "stopPct": 100,
      "currentSpend": 42.50,
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ]
}
```

---

#### `GET /api/cost/budgets/:id`

Get a budget by ID.

**Response (200):** Budget object.

---

#### `GET /api/cost/budgets/agent/:agentId`

Get a budget by agent ID.

**Response (200):** Budget object.

---

#### `POST /api/cost/budgets`

Create a budget. Each agent can have only one budget (409 if exists).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | Yes | Agent to budget |
| `monthlyLimit` | number | Yes | Monthly spend limit |
| `currency` | string | No | Currency code. Default: `"USD"` |
| `warnPct` | number | No | Warning threshold % |
| `pausePct` | number | No | Pause threshold % |
| `stopPct` | number | No | Stop threshold % |

**Response (201):** Created budget.

**Response (409):** Budget already exists for this agent.

---

#### `PATCH /api/cost/budgets/:id`

Update a budget.

**Request Body:** Same fields as create, all optional (except `agentId`).

**Response (200):** Updated budget.

---

#### `DELETE /api/cost/budgets/:id`

Delete a budget.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "budget-1" }
}
```

---

#### `POST /api/cost/budgets/:id/reset`

Reset a monthly budget (zero out current spend).

**Response (200):** Updated budget.

---

#### `POST /api/cost/usage`

Log token/cost usage.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | Yes | Agent that incurred the cost |
| `taskId` | string | No | Associated task |
| `inputTokens` | number | No | Input token count |
| `outputTokens` | number | No | Output token count |
| `costUsd` | number | No | Cost in USD |
| `model` | string | No | Model name (e.g., `"claude-opus-4-7"`) |
| `provider` | string | No | Provider (e.g., `"anthropic"`) |

**Response (201):** Usage record.

---

#### `GET /api/cost/usage`

List usage records. Requires at least one of `agentId` or `taskId`.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `agentId` | string | — | Filter by agent |
| `taskId` | string | — | Filter by task |
| `limit` | number | 1–500 | Max records |

**Response (200):** Array of usage records.

**Response (422):** If neither `agentId` nor `taskId` is provided.

---

#### `GET /api/cost/reports`

Cost reports with optional filtering.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Report for specific agent |
| `goalId` | string | Report for specific goal |
| `since` | string | Start date filter |
| `until` | string | End date filter |

**Response (200):**

When no filters:
```json
{
  "ok": true,
  "data": {
    "totalSpend": 150.75,
    "byGoal": [...],
    "budgets": [...]
  }
}
```

When `agentId` is specified:
```json
{
  "ok": true,
  "data": {
    "agentId": "agent-1",
    "totalSpend": 42.50,
    "budget": { ... },
    "usage": [...]
  }
}
```

When `goalId` is specified:
```json
{
  "ok": true,
  "data": {
    "goalId": "goal-1",
    "totalCost": 25.00,
    "totalTokens": 50000
  }
}
```

---

#### `GET /api/cost/reports/agent/:agentId/period`

Spend by period for a specific agent.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `since` | string | Start date |
| `until` | string | End date |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    { "period": "2026-05-01", "cost": 12.50 },
    { "period": "2026-05-02", "cost": 8.75 }
  ]
}
```

---

### Adapters

Adapter configuration management. Adapters are CLI tool integrations (Claude, Codex, etc.).

#### `GET /api/adapters`

List adapters with pagination.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `enabled` | boolean | — | Filter by enabled status |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "adapter-1",
      "type": "claude",
      "name": "Claude Code",
      "classPath": "./adapters/claude.js",
      "config": { "model": "opus" },
      "enabled": true,
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ],
  "total": 1
}
```

---

#### `GET /api/adapters/loaded`

List currently loaded adapters from the runtime registry.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    { "type": "claude", "loaded": true, "health": "ok" }
  ]
}
```

---

#### `GET /api/adapters/:id`

Get an adapter by ID.

**Response (200):** Adapter object.

---

#### `POST /api/adapters`

Create an adapter configuration. Returns 409 if `type` already exists.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | string | Yes | 1–100 chars | Unique adapter type identifier |
| `name` | string | No | max 200 chars | Display name |
| `classPath` | string | No | — | Path to adapter class module |
| `config` | object | No | — | Adapter-specific configuration |
| `enabled` | boolean | No | — | Whether adapter is enabled |

**Response (201):** Created adapter.

---

#### `PATCH /api/adapters/:id`

Update an adapter.

**Request Body:** Same fields as create, except `type` is not updatable.

**Response (200):** Updated adapter.

---

#### `DELETE /api/adapters/:id`

Delete an adapter. Also unloads it from the runtime registry.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "adapter-1" }
}
```

---

#### `POST /api/adapters/:id/load`

Load an adapter into the runtime registry.

**Response (200):**

```json
{
  "ok": true,
  "data": { "loaded": true, "type": "claude" }
}
```

**Response (422):** Adapter load error (e.g., classPath not found).

---

#### `POST /api/adapters/:id/unload`

Unload an adapter from the runtime registry.

**Response (200):**

```json
{
  "ok": true,
  "data": { "unloaded": true, "type": "claude" }
}
```

---

#### `POST /api/adapters/:id/health-check`

Run a health check on an adapter.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "type": "claude",
    "healthy": true,
    "execValid": true,
    "latencyMs": 12
  }
}
```

---

### Adapter Registry

Package management for adapters — install, update, uninstall from remote or local sources.

#### `GET /api/adapter-registry/search`

Search for adapters (local + optional remote).

**Query Parameters:**

| Param | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `q` | string | Yes | min 1 char | Search query |
| `remote` | boolean | No | — | Include remote registry |
| `limit` | number | No | 1–100 | Max results |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "name": "adapter-claude",
      "version": "1.0.0",
      "description": "Claude Code adapter",
      "source": "remote"
    }
  ]
}
```

---

#### `GET /api/adapter-registry/installed`

List installed adapter packages.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `source` | string | — | Filter by source |

**Response (200):**

```json
{
  "ok": true,
  "data": [...],
  "total": 3
}
```

---

#### `GET /api/adapter-registry/featured`

Get featured adapters from the remote registry.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max results |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "name": "adapter-codex",
      "version": "2.1.0",
      "description": "OpenAI Codex adapter",
      "downloads": 1500
    }
  ]
}
```

---

#### `GET /api/adapter-registry/updates`

Check for updates on all installed adapters.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "name": "adapter-claude",
      "current": "1.0.0",
      "latest": "1.2.0",
      "updateAvailable": true
    }
  ]
}
```

---

#### `GET /api/adapter-registry/scan`

Scan local adapters directory for unregistered adapters.

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "name": "my-custom-adapter",
      "path": "/adapters/custom/index.js",
      "registered": false
    }
  ]
}
```

---

#### `GET /api/adapter-registry/package/:name`

Get installed package details.

**Response (200):** Package object.

---

#### `POST /api/adapter-registry/install`

Install an adapter from the remote registry.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name |
| `version` | string | No | Specific version |
| `autoLoad` | boolean | No | Auto-load after install |

**Response (201):** Installed package.

**Response (422):** Install error.

---

#### `POST /api/adapter-registry/install-file`

Install an adapter from a local file.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filePath` | string | Yes | Path to adapter file/directory |
| `name` | string | No | Package name |
| `autoLoad` | boolean | No | Auto-load after install |

**Response (201):** Installed package.

---

#### `POST /api/adapter-registry/register-local`

Register a locally discovered adapter.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discovered` | object | Yes | Discovery result from `/scan` |

**Response (201):** Registered package.

---

#### `POST /api/adapter-registry/uninstall`

Uninstall an adapter.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name |
| `removeFiles` | boolean | No | Remove files from disk |

**Response (200):** Uninstall result.

---

#### `POST /api/adapter-registry/update`

Update an adapter to a new version.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name |
| `version` | string | No | Target version |

**Response (200):** Update result.

---

### Skills

Skill management — reusable agent capabilities.

#### `GET /api/skills`

List skills with pagination and filtering.

**Query Parameters:**

| Param | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `offset` | number | min: 0 | Pagination offset |
| `limit` | number | 1–100 | Items per page |
| `tag` | string | — | Filter by single tag |
| `tags` | string | — | Filter by comma-separated tags |
| `search` | string | — | Full-text search |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "skill-1",
      "name": "code-review",
      "description": "Review code for bugs and improvements",
      "content": "...",
      "tags": { "category": "quality", "difficulty": "intermediate" },
      "createdAt": 1716900000000,
      "updatedAt": 1716900000000
    }
  ]
}
```

---

#### `GET /api/skills/tags`

List all unique tags across all skills.

**Response (200):**

```json
{
  "ok": true,
  "data": ["quality", "security", "testing", "intermediate", "advanced"]
}
```

---

#### `GET /api/skills/:id`

Get a single skill.

**Response (200):** Skill object.

---

#### `POST /api/skills`

Create a new skill. Returns 409 if name already exists.

**Request Body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | Yes | 1–200 chars | Skill name (unique) |
| `description` | string | No | max 2000 chars | Skill description |
| `content` | string | Yes | min 1 char | Skill content/instructions |
| `tags` | object | No | — | Key-value tag pairs |

**Response (201):** Created skill.

**Example:**

```bash
curl -X POST http://localhost:3967/api/skills \
  -H "Authorization: Bearer tok_a1b2c3d4e5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "code-review",
    "description": "Review code for bugs and improvements",
    "content": "You are a code reviewer...",
    "tags": {"category": "quality"}
  }'
```

---

#### `PATCH /api/skills/:id`

Update a skill.

**Request Body:** Same fields as create, all optional.

**Response (200):** Updated skill.

---

#### `DELETE /api/skills/:id`

Delete a skill.

**Response (200):**

```json
{
  "ok": true,
  "data": { "deleted": true, "id": "skill-1" }
}
```

---

## Pagination

List endpoints return arrays directly (not wrapped in `{items, total}`). Use `offset` and `limit` query parameters for pagination.

**Note:** Some endpoints (Schedules, Squads, Adapters, Adapter Registry) include a `total` field in the response alongside the `data` array.

## Rate Limiting

No rate limiting is currently implemented.

## CORS

CORS is enabled for all origins (`*`). All cross-origin requests are allowed.

## Source Files

| File | Purpose |
|------|---------|
| `src/main/api/app.js` | App setup, middleware, route mounting |
| `src/main/api/server.js` | HTTP server creation |
| `src/main/api/middleware/auth.js` | Bearer token auth middleware |
| `src/main/api/middleware/validate.js` | Request validation middleware |
| `src/main/api/routes/health.js` | Health check |
| `src/main/api/routes/auth.js` | Authentication |
| `src/main/api/routes/agents.js` | Agent CRUD |
| `src/main/api/routes/goals.js` | Goal CRUD |
| `src/main/api/routes/tasks.js` | Task CRUD |
| `src/main/api/routes/logs.js` | Log management |
| `src/main/api/routes/stats.js` | Dashboard stats |
| `src/main/api/routes/settings.js` | Settings |
| `src/main/api/routes/schedules.js` | Schedule CRUD |
| `src/main/api/routes/squads.js` | Squad management |
| `src/main/api/routes/cost.js` | Cost/budget management |
| `src/main/api/routes/adapters.js` | Adapter config CRUD |
| `src/main/api/routes/adapter-registry.js` | Adapter package management |
| `src/main/api/routes/skills.js` | Skill CRUD |
