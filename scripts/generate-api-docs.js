'use strict';

/**
 * Generate OpenAPI 3.0 spec and Swagger UI HTML for AgentOps Desktop.
 *
 * Covers both transport layers:
 *   - Electron IPC (ipcMain.handle / ipcRenderer.invoke)
 *   - HTTP REST API (Hono on configurable port, default 3967)
 *
 * Usage:
 *   node scripts/generate-api-docs.js
 *
 * Outputs:
 *   docs/openapi.yaml   — OpenAPI 3.0 specification
 *   docs/api-docs.html   — Self-contained Swagger UI page
 */

const fs = require('fs');
const path = require('path');

// ── IPC Route definitions ──

const ipcRoutes = [
  // ─── Auth (public) ───
  {
    channel: 'auth:login',
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Create a session',
    description:
      'Creates a new authenticated session with the requested role and returns a bearer token. ' +
      'Roles: `admin` (full access), `operator` (agent/task ops), `viewer` (read-only). ' +
      'If no role is specified, defaults to `operator`.',
    auth: false,
    requestSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['admin', 'operator', 'viewer'], description: 'Session role (default: operator)' },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Bearer token for subsequent requests', example: 'tok_a1b2c3d4e5' },
        role: { type: 'string', enum: ['admin', 'operator', 'viewer'], example: 'operator' },
        expiresAt: { type: 'number', description: 'Token expiration timestamp (ms since epoch)', example: 1717000000000 },
      },
    },
    exampleResponse: { token: 'tok_a1b2c3d4e5', role: 'operator', expiresAt: 1717000000000 },
  },
  {
    channel: 'auth:status',
    method: 'get',
    path: '/auth/status',
    tag: 'Auth',
    summary: 'Check session validity',
    description: 'Returns the current session info if the token is still valid, otherwise `{ isValid: false }`.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean', example: true },
        token: { type: 'string', example: 'tok_a1b2c3d4e5' },
        role: { type: 'string', example: 'operator' },
        expiresAt: { type: 'number', example: 1717000000000 },
        createdAt: { type: 'number', example: 1716900000000 },
      },
    },
    exampleResponse: { isValid: true, token: 'tok_a1b2c3d4e5', role: 'operator', expiresAt: 1717000000000, createdAt: 1716900000000 },
  },
  {
    channel: 'auth:logout',
    method: 'post',
    path: '/auth/logout',
    tag: 'Auth',
    summary: 'Destroy session',
    description: 'Destroys the current authenticated session and invalidates the token.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true } },
    },
    exampleResponse: { ok: true },
  },
  {
    channel: 'auth:rotate',
    method: 'post',
    path: '/auth/rotate',
    tag: 'Auth',
    summary: 'Rotate session token',
    description: 'Rotates the current session token. The old token is immediately invalidated and a fresh one is returned.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'tok_f6g7h8i9j0' },
        role: { type: 'string', example: 'operator' },
        expiresAt: { type: 'number', example: 1717100000000 },
      },
    },
    exampleResponse: { token: 'tok_f6g7h8i9j0', role: 'operator', expiresAt: 1717100000000 },
  },

  // ─── Health (public HTTP, no auth) ───
  {
    channel: 'health:check',
    method: 'get',
    path: '/health',
    tag: 'Monitoring',
    summary: 'Public health check',
    description:
      'Public endpoint (no auth required) returning application health status including uptime, memory, ' +
      'system info, IPC metrics, renderer stats, DB connectivity, and active alerts. ' +
      'Returns HTTP 200 for ok/degraded, 503 for unhealthy.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'], example: 'ok' },
        version: { type: 'string', example: '1.0.0' },
        ts: { type: 'string', format: 'date-time', example: '2026-05-28T12:00:00.000Z' },
        uptimeMs: { type: 'number', example: 3600000 },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number', example: 120000000 },
            heapUsed: { type: 'number', example: 60000000 },
            heapTotal: { type: 'number', example: 100000000 },
            external: { type: 'number', example: 5000000 },
          },
        },
        system: {
          type: 'object',
          properties: {
            totalMem: { type: 'number', example: 17179869184 },
            freeMem: { type: 'number', example: 8589934592 },
            loadAvg: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, example: [1.5, 1.2, 1.0] },
            cpus: { type: 'number', example: 8 },
          },
        },
        ipc: {
          type: 'object',
          properties: {
            calls: { type: 'number', example: 1523 },
            errors: { type: 'number', example: 2 },
            avgLatencyMs: { type: 'number', example: 4.2 },
          },
        },
        renderer: {
          type: 'object',
          properties: {
            crashes: { type: 'number', example: 0 },
            unresponsive: { type: 'number', example: 0 },
          },
        },
        app: {
          type: 'object',
          properties: {
            startedAt: { type: 'number', example: 1716900000000 },
            uncaughtExceptions: { type: 'number', example: 0 },
            unhandledRejections: { type: 'number', example: 0 },
          },
        },
        db: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            error: { type: 'string', description: 'Present only when ok is false' },
          },
        },
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'high_heap' },
              severity: { type: 'string', enum: ['warn', 'error'] },
              detail: { type: 'string' },
            },
          },
          example: [],
        },
        uptime: {
          type: 'object',
          properties: {
            uptimePercent: { type: 'number', example: 99.95, description: 'Percentage of time in ok or degraded status' },
            totalUptimeMs: { type: 'number', example: 86400000 },
            totalDowntimeMs: { type: 'number', example: 43200 },
            breakdown: {
              type: 'object',
              properties: {
                okMs: { type: 'number' },
                degradedMs: { type: 'number' },
                unhealthyMs: { type: 'number' },
              },
            },
            lastStatusChange: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
            lastStatusChangeAt: { type: 'string', format: 'date-time' },
            transitions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  at: { type: 'string', format: 'date-time' },
                },
              },
              maxItems: 10,
            },
          },
        },
      },
    },
    extraResponses: {
      503: {
        description: 'Unhealthy — error-level alerts detected (e.g. DB unreachable, high IPC error rate)',
      },
    },
  },

  // ─── Monitoring (IPC) ───
  {
    channel: 'monitor:health',
    method: 'get',
    path: '/monitor/health',
    tag: 'Monitoring',
    summary: 'System health check',
    description:
      'Returns application health status including uptime, memory usage, system info, ' +
      'IPC call metrics, renderer crash counts, and process-level error counters.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded', 'down'], example: 'ok' },
        ts: { type: 'string', format: 'date-time', example: '2026-05-28T12:00:00.000Z' },
        uptimeMs: { type: 'number', example: 3600000 },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number', description: 'Resident Set Size in bytes', example: 120000000 },
            heapUsed: { type: 'number', example: 60000000 },
            heapTotal: { type: 'number', example: 100000000 },
            external: { type: 'number', example: 5000000 },
          },
        },
        system: {
          type: 'object',
          properties: {
            totalMem: { type: 'number', example: 17179869184 },
            freeMem: { type: 'number', example: 8589934592 },
            loadAvg: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, example: [1.5, 1.2, 1.0] },
            cpus: { type: 'number', example: 8 },
          },
        },
        ipc: {
          type: 'object',
          properties: {
            calls: { type: 'number', example: 1523 },
            errors: { type: 'number', example: 2 },
            avgLatencyMs: { type: 'number', example: 4.2 },
          },
        },
        renderer: {
          type: 'object',
          properties: {
            crashes: { type: 'number', example: 0 },
            unresponsive: { type: 'number', example: 0 },
          },
        },
        app: {
          type: 'object',
          properties: {
            startedAt: { type: 'number', example: 1716900000000 },
            uncaughtExceptions: { type: 'number', example: 0 },
            unhandledRejections: { type: 'number', example: 0 },
          },
        },
      },
    },
  },

  // ─── Agents — Config CRUD ───
  {
    channel: 'agents:list',
    method: 'get',
    path: '/agents',
    tag: 'Agents',
    summary: 'List agent configs',
    description:
      'Lists all registered agent configurations with pagination and optional status filter. ' +
      'Returns a paginated result with `items` array and total count.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset', example: 0 },
        limit: { type: 'number', description: 'Max items to return (default: 50)', example: 20 },
        status: { type: 'string', enum: ['idle', 'running', 'spawning', 'error', 'stopped'], description: 'Filter by agent status' },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'status'], description: 'Sort field' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
        total: { type: 'number', example: 5 },
      },
    },
    exampleResponse: {
      items: [
        { id: 'agent-1', name: 'claude-dev', type: 'claude', status: 'idle', execPath: '/usr/local/bin/claude', cwd: '/project', createdAt: 1716900000000, updatedAt: 1716900000000 },
      ],
      total: 1,
    },
  },
  {
    channel: 'agents:get',
    method: 'get',
    path: '/agents/{id}',
    tag: 'Agents',
    summary: 'Get agent config',
    description: 'Returns a single agent configuration by ID.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Agent ID', example: 'agent-1' } },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
    exampleResponse: { id: 'agent-1', name: 'claude-dev', type: 'claude', status: 'idle', execPath: '/usr/local/bin/claude', cwd: '/project', createdAt: 1716900000000, updatedAt: 1716900000000 },
  },
  {
    channel: 'agents:create',
    method: 'post',
    path: '/agents',
    tag: 'Agents',
    summary: 'Create agent config',
    description: 'Registers a new agent configuration. The agent type determines the CLI adapter used to spawn it.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200, example: 'claude-dev' },
        type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'], example: 'claude' },
        command: { type: 'string', maxLength: 1000, example: 'claude --print' },
        execPath: { type: 'string', maxLength: 1000, example: '/usr/local/bin/claude' },
        cwd: { type: 'string', maxLength: 500, example: '/project' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
    exampleResponse: { id: 'agent-2', name: 'claude-dev', type: 'claude', status: 'idle', execPath: '/usr/local/bin/claude', cwd: '/project', createdAt: 1716900000000, updatedAt: 1716900000000 },
  },
  {
    channel: 'agents:update',
    method: 'patch',
    path: '/agents/{id}',
    tag: 'Agents',
    summary: 'Update agent config',
    description: 'Updates fields on an existing agent configuration. Only provided fields are changed.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string', example: 'agent-1' },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'claude-prod' },
            type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
            status: { type: 'string', enum: ['idle', 'running', 'error', 'stopped'] },
            command: { type: 'string' },
            execPath: { type: 'string' },
            cwd: { type: 'string' },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
    exampleResponse: { id: 'agent-1', name: 'claude-prod', type: 'claude', status: 'idle', execPath: '/usr/local/bin/claude', cwd: '/project', createdAt: 1716900000000, updatedAt: 1717000000000 },
  },
  {
    channel: 'agents:delete',
    method: 'delete',
    path: '/agents/{id}',
    tag: 'Agents',
    summary: 'Delete agent config',
    description: 'Removes an agent configuration. Does not kill running processes — use `agents:kill` first if needed.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'agent-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', example: 'agent-1' },
      },
    },
    exampleResponse: { deleted: true, id: 'agent-1' },
  },
  {
    channel: 'agents:health-check',
    method: 'post',
    path: '/agents/{id}/health-check',
    tag: 'Agents',
    summary: 'Validate agent executable',
    description:
      'Checks whether the agent executable exists on disk and whether any spawned process is still alive. ' +
      'Useful for diagnosing `error` status agents.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'agent-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        execValid: { type: 'boolean', description: 'Whether the executable path exists and is accessible', example: true },
        processAlive: { type: 'boolean', description: 'Whether a spawned process is still running', example: false },
        status: { type: 'string', example: 'idle' },
      },
    },
    exampleResponse: { ok: true, execValid: true, processAlive: false, status: 'idle' },
  },

  // ─── Agents — Live process management ───
  {
    channel: 'agents:spawn',
    method: 'post',
    path: '/agents/spawn',
    tag: 'Agent Processes',
    summary: 'Spawn agent process',
    description:
      'Spawns a new CLI agent process using the configured adapter. ' +
      'The process runs in the background; use `agents:status` to poll its state.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['execPath'],
      properties: {
        execPath: { type: 'string', minLength: 1, example: '/usr/local/bin/claude' },
        name: { type: 'string', maxLength: 200, example: 'my-agent' },
        args: { type: 'array', items: { type: 'string' }, example: ['--print', '--model', 'opus'] },
        cwd: { type: 'string', example: '/project' },
        env: { type: 'object', additionalProperties: { type: 'string' }, example: { NODE_ENV: 'production' } },
        resourceLimits: {
          type: 'object',
          properties: {
            maxMemoryMB: { type: 'number', description: 'Max memory in MB', example: 512 },
            maxCpuPercent: { type: 'number', description: 'Max CPU usage %', example: 80 },
            timeoutMs: { type: 'number', description: 'Process timeout in ms', example: 600000 },
          },
        },
        recovery: {
          type: 'object',
          properties: {
            maxRetries: { type: 'number', example: 3 },
            backoffMs: { type: 'number', example: 1000 },
          },
        },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
        name: { type: 'string', example: 'my-agent' },
        execPath: { type: 'string', example: '/usr/local/bin/claude' },
        status: { type: 'string', enum: ['spawning', 'running'], example: 'running' },
        pid: { type: 'number', example: 12345 },
        startedAt: { type: 'number', example: 1717000000000 },
      },
    },
    exampleResponse: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'my-agent', execPath: '/usr/local/bin/claude', status: 'running', pid: 12345, startedAt: 1717000000000 },
  },
  {
    channel: 'agents:status',
    method: 'get',
    path: '/agents/processes/{id}',
    tag: 'Agent Processes',
    summary: 'Get agent session status',
    description:
      'Returns the current status of a live agent process including PID, exit code, ' +
      'resource usage, and retry count.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        name: { type: 'string', example: 'my-agent' },
        status: { type: 'string', enum: ['spawning', 'running', 'stopped', 'error'], example: 'running' },
        pid: { type: 'number', example: 12345 },
        exitCode: { type: 'number', nullable: true, example: null },
        error: { type: 'string', nullable: true, example: null },
        startedAt: { type: 'number', example: 1717000000000 },
        endedAt: { type: 'number', nullable: true, example: null },
        logCount: { type: 'number', example: 42 },
        resourceUsage: {
          type: 'object',
          nullable: true,
          properties: {
            memoryMB: { type: 'number', example: 128 },
            cpuPercent: { type: 'number', example: 15.2 },
          },
        },
        resourceLimits: {
          type: 'object',
          nullable: true,
          properties: {
            maxMemoryMB: { type: 'number', example: 512 },
            maxCpuPercent: { type: 'number', example: 80 },
            timeoutMs: { type: 'number', example: 600000 },
          },
        },
        retryCount: { type: 'number', example: 0 },
      },
    },
    exampleResponse: {
      id: '550e8400-e29b-41d4-a716-446655440000', name: 'my-agent', status: 'running', pid: 12345,
      exitCode: null, error: null, startedAt: 1717000000000, endedAt: null, logCount: 42,
      resourceUsage: { memoryMB: 128, cpuPercent: 15.2 }, retryCount: 0,
    },
  },
  {
    channel: 'agents:kill',
    method: 'post',
    path: '/agents/processes/{id}/kill',
    tag: 'Agent Processes',
    summary: 'Kill agent process',
    description: 'Sends SIGTERM to the agent process. If it does not exit within 5 seconds, escalates to SIGKILL.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        signal: { type: 'string', description: 'Signal to send (default: SIGTERM)', example: 'SIGTERM' },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        status: { type: 'string', enum: ['terminated'], example: 'terminated' },
      },
    },
    exampleResponse: { id: '550e8400-e29b-41d4-a716-446655440000', status: 'terminated' },
  },

  // ─── Goals ───
  {
    channel: 'goals:list',
    method: 'get',
    path: '/goals',
    tag: 'Goals',
    summary: 'List goals',
    description: 'Lists all goals with pagination and optional status filter.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', example: 0 },
        limit: { type: 'number', example: 20 },
        status: { type: 'string', enum: ['active', 'completed', 'archived'] },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/Goal' } },
        total: { type: 'number', example: 3 },
      },
    },
    exampleResponse: {
      items: [
        { id: 'goal-1', title: 'Ship MVP', description: 'Launch the minimum viable product', status: 'active', taskIds: ['task-1', 'task-2'], createdAt: 1716900000000, updatedAt: 1716900000000 },
      ],
      total: 1,
    },
  },
  {
    channel: 'goals:get',
    method: 'get',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Get goal',
    description: 'Returns a single goal by ID, including its linked task IDs.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'goal-1' } },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
    exampleResponse: { id: 'goal-1', title: 'Ship MVP', description: 'Launch the minimum viable product', status: 'active', taskIds: ['task-1', 'task-2'], createdAt: 1716900000000, updatedAt: 1716900000000 },
  },
  {
    channel: 'goals:create',
    method: 'post',
    path: '/goals',
    tag: 'Goals',
    summary: 'Create goal',
    description: 'Creates a new goal. Goals group related tasks together for tracking progress.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500, example: 'Ship MVP' },
        description: { type: 'string', maxLength: 5000, example: 'Launch the minimum viable product by end of quarter' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
    exampleResponse: { id: 'goal-2', title: 'Ship MVP', description: 'Launch the minimum viable product by end of quarter', status: 'active', taskIds: [], createdAt: 1717000000000, updatedAt: 1717000000000 },
  },
  {
    channel: 'goals:update',
    method: 'patch',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Update goal',
    description: 'Updates fields on an existing goal. Only provided fields are changed.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string', example: 'goal-1' },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Ship MVP v2' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'archived'], example: 'completed' },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
    exampleResponse: { id: 'goal-1', title: 'Ship MVP v2', description: 'Launch the minimum viable product', status: 'completed', taskIds: ['task-1', 'task-2'], createdAt: 1716900000000, updatedAt: 1717000000000 },
  },
  {
    channel: 'goals:delete',
    method: 'delete',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Delete goal',
    description: 'Removes a goal. Linked tasks are unlinked but not deleted.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'goal-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', example: 'goal-1' },
      },
    },
    exampleResponse: { deleted: true, id: 'goal-1' },
  },

  // ─── Tasks ───
  {
    channel: 'tasks:list',
    method: 'get',
    path: '/tasks',
    tag: 'Tasks',
    summary: 'List tasks',
    description: 'Lists all tasks with pagination and optional filters. Filter by status or parent goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', example: 0 },
        limit: { type: 'number', example: 20 },
        status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
        goalId: { type: 'string', description: 'Filter tasks by parent goal' },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
        total: { type: 'number', example: 10 },
      },
    },
    exampleResponse: {
      items: [
        { id: 'task-1', title: 'Implement auth', description: 'Add JWT-based auth flow', status: 'done', goalId: 'goal-1', assigneeAgentId: 'agent-1', createdAt: 1716900000000, updatedAt: 1716950000000 },
      ],
      total: 1,
    },
  },
  {
    channel: 'tasks:get',
    method: 'get',
    path: '/tasks/{id}',
    tag: 'Tasks',
    summary: 'Get task',
    description: 'Returns a single task by ID.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'task-1' } },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
    exampleResponse: { id: 'task-1', title: 'Implement auth', description: 'Add JWT-based auth flow', status: 'done', goalId: 'goal-1', assigneeAgentId: 'agent-1', createdAt: 1716900000000, updatedAt: 1716950000000 },
  },
  {
    channel: 'tasks:create',
    method: 'post',
    path: '/tasks',
    tag: 'Tasks',
    summary: 'Create task',
    description: 'Creates a new task. Optionally links to a parent goal and assigns an agent.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500, example: 'Implement auth' },
        description: { type: 'string', maxLength: 5000, example: 'Add JWT-based auth flow with refresh tokens' },
        goalId: { type: 'string', example: 'goal-1' },
        assigneeAgentId: { type: 'string', example: 'agent-1' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
    exampleResponse: { id: 'task-2', title: 'Implement auth', description: 'Add JWT-based auth flow with refresh tokens', status: 'pending', goalId: 'goal-1', assigneeAgentId: 'agent-1', createdAt: 1717000000000, updatedAt: 1717000000000 },
  },
  {
    channel: 'tasks:update',
    method: 'patch',
    path: '/tasks/{id}',
    tag: 'Tasks',
    summary: 'Update task',
    description: 'Updates fields on an existing task. Use to change status, reassign, or re-link to a different goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string', example: 'task-1' },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'], example: 'running' },
            goalId: { type: 'string' },
            assigneeAgentId: { type: 'string' },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
    exampleResponse: { id: 'task-1', title: 'Implement auth', description: 'Add JWT-based auth flow', status: 'running', goalId: 'goal-1', assigneeAgentId: 'agent-1', createdAt: 1716900000000, updatedAt: 1717000000000 },
  },
  {
    channel: 'tasks:delete',
    method: 'delete',
    path: '/tasks/{id}',
    tag: 'Tasks',
    summary: 'Delete task',
    description: 'Removes a task. Does not affect the parent goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'task-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', example: 'task-1' },
      },
    },
    exampleResponse: { deleted: true, id: 'task-1' },
  },

  // ─── Orchestrator (DAG) ───
  {
    channel: 'orchestrator:list',
    method: 'get',
    path: '/orchestrator',
    tag: 'Orchestrator',
    summary: 'List DAGs',
    description: 'Lists all DAG (Directed Acyclic Graph) workflow definitions with pagination and status filter.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', example: 0 },
        limit: { type: 'number', example: 20 },
        status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'paused'] },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/Dag' } },
        total: { type: 'number', example: 2 },
      },
    },
    exampleResponse: {
      items: [
        { id: 'dag-1', name: 'deploy-pipeline', description: 'CI/CD deployment workflow', status: 'pending', taskCount: 4, createdAt: 1716900000000, updatedAt: 1716900000000 },
      ],
      total: 1,
    },
  },
  {
    channel: 'orchestrator:get',
    method: 'get',
    path: '/orchestrator/{id}',
    tag: 'Orchestrator',
    summary: 'Get DAG with tasks',
    description: 'Returns the full DAG definition including all task nodes, edges, and current execution state.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: { $ref: '#/components/schemas/DagFull' },
    exampleResponse: {
      id: 'dag-1', name: 'deploy-pipeline', description: 'CI/CD deployment workflow', status: 'pending',
      tasks: [
        { id: 'dag-task-1', title: 'Build', taskType: 'agent', status: 'pending' },
        { id: 'dag-task-2', title: 'Test', taskType: 'agent', status: 'pending' },
      ],
      edges: [{ from: 'dag-task-1', to: 'dag-task-2' }],
      maxParallel: 2, retryMax: 3, onFailure: 'fail-fast',
      createdAt: 1716900000000, updatedAt: 1716900000000,
    },
  },
  {
    channel: 'orchestrator:create',
    method: 'post',
    path: '/orchestrator',
    tag: 'Orchestrator',
    summary: 'Create DAG',
    description:
      'Creates a new DAG workflow definition. Tasks define the work items; edges define execution order. ' +
      'Task types: `agent` (runs via agent adapter), `noop` (placeholder), `manual` (requires human completion).',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['name', 'tasks'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200, example: 'deploy-pipeline' },
        description: { type: 'string', maxLength: 2000, example: 'CI/CD deployment workflow' },
        tasks: {
          type: 'array',
          description: 'Task nodes in the DAG',
          items: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string', example: 'Build' },
              taskType: { type: 'string', enum: ['agent', 'noop', 'manual'], example: 'agent' },
              agentId: { type: 'string', description: 'Agent to execute this task (for agent type)' },
              config: { type: 'object', description: 'Task-specific configuration' },
            },
          },
        },
        edges: {
          type: 'array',
          description: 'Dependency edges between tasks',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source task title or index' },
              to: { type: 'string', description: 'Target task title or index' },
            },
          },
        },
        maxParallel: { type: 'number', min: 1, max: 32, description: 'Max concurrent task execution', example: 2 },
        retryMax: { type: 'number', min: 0, max: 10, description: 'Max retries per failed task', example: 3 },
        retryBackoffMs: { type: 'number', min: 100, max: 60000, description: 'Initial retry backoff in ms', example: 1000 },
        retryBackoffMult: { type: 'number', min: 1, max: 10, description: 'Backoff multiplier', example: 2 },
        retryMaxBackoffMs: { type: 'number', min: 1000, max: 300000, description: 'Max backoff cap in ms', example: 30000 },
        onFailure: { type: 'string', enum: ['fail-fast', 'best-effort'], description: 'Failure strategy', example: 'fail-fast' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/DagFull' },
    exampleResponse: {
      id: 'dag-2', name: 'deploy-pipeline', status: 'pending',
      tasks: [{ id: 'dt-1', title: 'Build', taskType: 'agent', status: 'pending' }],
      edges: [], maxParallel: 2, retryMax: 3, onFailure: 'fail-fast',
      createdAt: 1717000000000, updatedAt: 1717000000000,
    },
  },
  {
    channel: 'orchestrator:start',
    method: 'post',
    path: '/orchestrator/{id}/start',
    tag: 'Orchestrator',
    summary: 'Start DAG execution',
    description: 'Begins executing the DAG. Tasks without dependencies start immediately; others wait for predecessors.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        dagId: { type: 'string', example: 'dag-1' },
      },
    },
    exampleResponse: { ok: true, dagId: 'dag-1' },
  },
  {
    channel: 'orchestrator:pause',
    method: 'post',
    path: '/orchestrator/{id}/pause',
    tag: 'Orchestrator',
    summary: 'Pause DAG execution',
    description: 'Pauses the DAG. Running tasks continue to completion; no new tasks are started.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        dagId: { type: 'string', example: 'dag-1' },
      },
    },
    exampleResponse: { ok: true, dagId: 'dag-1' },
  },
  {
    channel: 'orchestrator:resume',
    method: 'post',
    path: '/orchestrator/{id}/resume',
    tag: 'Orchestrator',
    summary: 'Resume DAG execution',
    description: 'Resumes a paused DAG. Queued tasks begin executing according to their dependencies.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        dagId: { type: 'string', example: 'dag-1' },
      },
    },
    exampleResponse: { ok: true, dagId: 'dag-1' },
  },
  {
    channel: 'orchestrator:cancel',
    method: 'post',
    path: '/orchestrator/{id}/cancel',
    tag: 'Orchestrator',
    summary: 'Cancel DAG execution',
    description: 'Cancels the DAG. Running tasks are killed; pending tasks are marked cancelled.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        dagId: { type: 'string', example: 'dag-1' },
      },
    },
    exampleResponse: { ok: true, dagId: 'dag-1' },
  },
  {
    channel: 'orchestrator:progress',
    method: 'get',
    path: '/orchestrator/{id}/progress',
    tag: 'Orchestrator',
    summary: 'Get DAG progress',
    description: 'Returns the current execution progress of a DAG including task-level status counts.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', example: 'dag-1' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 4 },
        pending: { type: 'number', example: 1 },
        running: { type: 'number', example: 1 },
        succeeded: { type: 'number', example: 1 },
        failed: { type: 'number', example: 0 },
        cancelled: { type: 'number', example: 0 },
        percent: { type: 'number', description: 'Completion percentage', example: 50 },
      },
    },
    exampleResponse: { total: 4, pending: 1, running: 1, succeeded: 1, failed: 0, cancelled: 0, percent: 50 },
  },
  {
    channel: 'orchestrator:task:get',
    method: 'get',
    path: '/orchestrator/{dagId}/tasks/{taskId}',
    tag: 'Orchestrator',
    summary: 'Get DAG task detail',
    description: 'Returns the detail of a single task within a DAG, including its output if completed.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['dagId', 'taskId'],
      properties: {
        dagId: { type: 'string', example: 'dag-1' },
        taskId: { type: 'string', example: 'dag-task-1' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/DagTask' },
    exampleResponse: { id: 'dag-task-1', title: 'Build', taskType: 'agent', status: 'succeeded', output: { exitCode: 0 }, startedAt: 1717000000000, endedAt: 1717000060000 },
  },
  {
    channel: 'orchestrator:task:complete',
    method: 'post',
    path: '/orchestrator/{dagId}/tasks/{taskId}/complete',
    tag: 'Orchestrator',
    summary: 'Complete manual task',
    description: 'Marks a manual-type task as complete or failed. Only applicable to tasks with `taskType: manual`.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['dagId', 'taskId', 'success'],
      properties: {
        dagId: { type: 'string', example: 'dag-1' },
        taskId: { type: 'string', example: 'dag-task-1' },
        output: { type: 'object', description: 'Task output data', example: { result: 'approved' } },
        success: { type: 'boolean', example: true },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
    exampleResponse: { ok: true },
  },

  // ─── Logs ───
  {
    channel: 'logs:list',
    method: 'get',
    path: '/logs',
    tag: 'Logs',
    summary: 'List log entries',
    description: 'Lists log entries. Filter by agentId for session-specific logs or taskId for task-specific logs.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Filter by agent session ID' },
        taskId: { type: 'string', description: 'Filter by task ID' },
        limit: { type: 'number', description: 'Max entries to return (default: 100)', example: 50 },
        offset: { type: 'number', example: 0 },
      },
    },
    responseSchema: {
      type: 'array',
      items: { $ref: '#/components/schemas/LogEntry' },
    },
    exampleResponse: [
      { id: 'log-1', agentId: 'agent-1', taskId: null, message: 'Agent started successfully', level: 'info', stream: 'stdout', timestamp: 1717000000000 },
    ],
  },
  {
    channel: 'logs:append',
    method: 'post',
    path: '/logs',
    tag: 'Logs',
    summary: 'Append log entry',
    description: 'Appends a new log entry to the global log buffer. The entry is also broadcast to subscribed renderers.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['message'],
      properties: {
        agentId: { type: 'string', example: 'agent-1' },
        taskId: { type: 'string', example: 'task-1' },
        message: { type: 'string', example: 'Processing batch 3/10' },
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], example: 'info' },
        stream: { type: 'string', enum: ['stdout', 'stderr'], example: 'stdout' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/LogEntry' },
    exampleResponse: { id: 'log-2', agentId: 'agent-1', taskId: 'task-1', message: 'Processing batch 3/10', level: 'info', stream: 'stdout', timestamp: 1717000000000 },
  },

  // ─── Stats ───
  {
    channel: 'stats:summary',
    method: 'get',
    path: '/stats/summary',
    tag: 'Stats',
    summary: 'Dashboard stats',
    description: 'Returns aggregated counts for agents and tasks by status. Used to populate the dashboard overview.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        agents: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 5 },
            running: { type: 'number', example: 2 },
            idle: { type: 'number', example: 2 },
            error: { type: 'number', example: 1 },
            stopped: { type: 'number', example: 0 },
          },
        },
        tasks: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 12 },
            pending: { type: 'number', example: 3 },
            assigned: { type: 'number', example: 2 },
            running: { type: 'number', example: 3 },
            done: { type: 'number', example: 3 },
            failed: { type: 'number', example: 1 },
            blocked: { type: 'number', example: 0 },
          },
        },
      },
    },
    exampleResponse: {
      agents: { total: 5, running: 2, idle: 2, error: 1, stopped: 0 },
      tasks: { total: 12, pending: 3, assigned: 2, running: 3, done: 3, failed: 1, blocked: 0 },
    },
  },

  // ─── Settings ───
  {
    channel: 'settings:get',
    method: 'get',
    path: '/settings',
    tag: 'Settings',
    summary: 'Get all settings',
    description: 'Returns the full application settings object.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark', 'system'], example: 'dark' },
        logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], example: 'info' },
        autoStartAgents: { type: 'boolean', example: false },
        maxConcurrentAgents: { type: 'number', example: 4 },
      },
    },
    exampleResponse: { theme: 'dark', logLevel: 'info', autoStartAgents: false, maxConcurrentAgents: 4 },
  },
  {
    channel: 'settings:update',
    method: 'patch',
    path: '/settings',
    tag: 'Settings',
    summary: 'Update settings',
    description: 'Updates application settings. Merges provided keys into existing settings.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['settings'],
      properties: {
        settings: {
          type: 'object',
          description: 'Settings key-value pairs to update',
          example: { theme: 'light', logLevel: 'debug' },
        },
      },
    },
    responseSchema: {
      type: 'object',
      description: 'Updated full settings object',
    },
    exampleResponse: { theme: 'light', logLevel: 'debug', autoStartAgents: false, maxConcurrentAgents: 4 },
  },

  // ─── Updates ───
  {
    channel: 'update:check',
    method: 'post',
    path: '/update/check',
    tag: 'Updates',
    summary: 'Check for updates',
    description: 'Triggers an update check against the configured update server.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true } },
    },
    exampleResponse: { ok: true },
  },
  {
    channel: 'update:download',
    method: 'post',
    path: '/update/download',
    tag: 'Updates',
    summary: 'Download update',
    description: 'Downloads the available update. Progress is reported via renderer events.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true } },
    },
    exampleResponse: { ok: true },
  },
  {
    channel: 'update:install',
    method: 'post',
    path: '/update/install',
    tag: 'Updates',
    summary: 'Install update and restart',
    description: 'Installs the downloaded update and restarts the application.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true } },
    },
    exampleResponse: { ok: true },
  },
];

// ── OpenAPI spec generation ──

function buildPaths(routes) {
  const paths = {};

  for (const route of routes) {
    const pathKey = route.path;
    if (!paths[pathKey]) paths[pathKey] = {};

    const operation = {
      summary: route.summary,
      description: route.description,
      operationId: route.channel.replace(/:/g, '_'),
      tags: [route.tag],
      'x-ipc-channel': route.channel,
      'x-transport': 'ipc',
    };

    if (route.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Path params
    const pathParams = [...route.path.matchAll(/\{(\w+)\}/g)];
    if (pathParams.length > 0) {
      operation.parameters = pathParams.map((m) => ({
        name: m[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }));
    }

    // Request body / query params
    if (route.requestSchema) {
      if (route.method === 'get' && route.requestSchema.properties) {
        const queryParams = Object.entries(route.requestSchema.properties)
          .filter(([name]) => !pathParams.some((m) => m[1] === name))
          .map(([name, prop]) => ({
            name,
            in: 'query',
            required: (route.requestSchema.required || []).includes(name),
            schema: prop,
          }));
        if (queryParams.length > 0) {
          operation.parameters = [...(operation.parameters || []), ...queryParams];
        }
      } else {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: route.requestSchema,
            },
          },
        };
      }
    }

    // Responses
    const responseContent = {
      schema: route.responseSchema || { type: 'object' },
    };
    if (route.exampleResponse) {
      responseContent.examples = {
        default: {
          summary: 'Success',
          value: route.exampleResponse,
        },
      };
    }

    operation.responses = {
      200: {
        description: 'Success',
        content: { 'application/json': responseContent },
      },
    };

    if (route.auth) {
      operation.responses['401'] = { description: 'Unauthorized — invalid or missing token' };
    }
    if (route.requestSchema) {
      operation.responses['422'] = { description: 'Validation error' };
    }
    if (route.extraResponses) {
      for (const [code, resp] of Object.entries(route.extraResponses)) {
        operation.responses[code] = resp;
      }
    }

    paths[pathKey][route.method] = operation;
  }

  return paths;
}

function buildSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'AgentOps Desktop API',
      description:
        'API for AgentOps Desktop — an Electron application for managing AI agent sessions, goals, tasks, and DAG workflows.\n\n' +
        '**Transport layers:**\n' +
        '- **Electron IPC** — primary interface for the renderer process via `window.agentOps.*`\n' +
        '- **HTTP REST** — secondary interface on port 3967 for external tools and scripts\n\n' +
        '**Authentication:** Bearer token obtained from `POST /auth/login`. Include as `Authorization: Bearer <token>` for HTTP, ' +
        'or pass `_auth: { token }` in the IPC payload.\n\n' +
        'Each IPC operation maps to a channel (listed in `x-ipc-channel`). The HTTP API mirrors the same operations at REST paths.',
      version: '0.1.0',
      contact: { name: 'AgentOps Team' },
      license: { name: 'UNLICENSED' },
    },
    servers: [
      {
        url: 'http://localhost:3967',
        description: 'HTTP REST API (Hono)',
      },
      {
        url: 'ipc://localhost',
        description: 'Electron IPC transport',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Session management — login, logout, token rotation, status check' },
      { name: 'Monitoring', description: 'Health checks and system diagnostics' },
      { name: 'Agents', description: 'Agent configuration CRUD — register, update, delete agent configs' },
      { name: 'Agent Processes', description: 'Live agent process management — spawn, kill, poll status' },
      { name: 'Goals', description: 'Goal management — group tasks under strategic objectives' },
      { name: 'Tasks', description: 'Task management — create, assign, track work items linked to goals' },
      { name: 'Orchestrator', description: 'DAG workflow engine — define, execute, and monitor multi-step workflows' },
      { name: 'Logs', description: 'Log entry management — append and query agent/task logs' },
      { name: 'Stats', description: 'Aggregated dashboard statistics' },
      { name: 'Settings', description: 'Application settings management' },
      { name: 'Updates', description: 'Application auto-update lifecycle' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Session token obtained from POST /auth/login',
        },
      },
      schemas: {
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'agent-1' },
            name: { type: 'string', example: 'claude-dev' },
            type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'], example: 'claude' },
            status: { type: 'string', enum: ['idle', 'running', 'spawning', 'error', 'stopped'], example: 'idle' },
            command: { type: 'string', nullable: true, example: 'claude --print' },
            execPath: { type: 'string', nullable: true, example: '/usr/local/bin/claude' },
            cwd: { type: 'string', nullable: true, example: '/project' },
            createdAt: { type: 'number', example: 1716900000000 },
            updatedAt: { type: 'number', example: 1716900000000 },
          },
        },
        Goal: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'goal-1' },
            title: { type: 'string', example: 'Ship MVP' },
            description: { type: 'string', nullable: true, example: 'Launch the minimum viable product' },
            status: { type: 'string', enum: ['active', 'completed', 'archived'], example: 'active' },
            taskIds: { type: 'array', items: { type: 'string' }, example: ['task-1', 'task-2'] },
            createdAt: { type: 'number', example: 1716900000000 },
            updatedAt: { type: 'number', example: 1716900000000 },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'task-1' },
            title: { type: 'string', example: 'Implement auth' },
            description: { type: 'string', nullable: true, example: 'Add JWT-based auth flow' },
            status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'], example: 'pending' },
            goalId: { type: 'string', nullable: true, example: 'goal-1' },
            assigneeAgentId: { type: 'string', nullable: true, example: 'agent-1' },
            createdAt: { type: 'number', example: 1716900000000 },
            updatedAt: { type: 'number', example: 1716900000000 },
          },
        },
        Dag: {
          type: 'object',
          description: 'DAG workflow summary (without task details)',
          properties: {
            id: { type: 'string', example: 'dag-1' },
            name: { type: 'string', example: 'deploy-pipeline' },
            description: { type: 'string', nullable: true, example: 'CI/CD deployment workflow' },
            status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'paused'], example: 'pending' },
            taskCount: { type: 'number', example: 4 },
            createdAt: { type: 'number', example: 1716900000000 },
            updatedAt: { type: 'number', example: 1716900000000 },
          },
        },
        DagFull: {
          type: 'object',
          description: 'Full DAG definition with task nodes, edges, and configuration',
          properties: {
            id: { type: 'string', example: 'dag-1' },
            name: { type: 'string', example: 'deploy-pipeline' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'paused'] },
            tasks: { type: 'array', items: { $ref: '#/components/schemas/DagTask' } },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                },
              },
            },
            maxParallel: { type: 'number', example: 2 },
            retryMax: { type: 'number', example: 3 },
            retryBackoffMs: { type: 'number', example: 1000 },
            retryBackoffMult: { type: 'number', example: 2 },
            retryMaxBackoffMs: { type: 'number', example: 30000 },
            onFailure: { type: 'string', enum: ['fail-fast', 'best-effort'] },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' },
          },
        },
        DagTask: {
          type: 'object',
          description: 'A single task node within a DAG',
          properties: {
            id: { type: 'string', example: 'dag-task-1' },
            title: { type: 'string', example: 'Build' },
            taskType: { type: 'string', enum: ['agent', 'noop', 'manual'], example: 'agent' },
            status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled'], example: 'pending' },
            agentId: { type: 'string', nullable: true },
            output: { type: 'object', nullable: true },
            startedAt: { type: 'number', nullable: true },
            endedAt: { type: 'number', nullable: true },
          },
        },
        LogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'log-1' },
            agentId: { type: 'string', nullable: true, example: 'agent-1' },
            taskId: { type: 'string', nullable: true },
            message: { type: 'string', example: 'Agent started successfully' },
            level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], example: 'info' },
            stream: { type: 'string', enum: ['stdout', 'stderr'], example: 'stdout' },
            timestamp: { type: 'number', example: 1717000000000 },
          },
        },
        Error: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'name is required' },
                status: { type: 'number', example: 422 },
                field: { type: 'string', example: 'name' },
              },
            },
          },
        },
      },
    },
    paths: buildPaths(ipcRoutes),
  };
}

// ── YAML serialization (minimal, no dependency) ──

function needsQuoting(s) {
  return s === '' || /[-:#'"{}[\],&*?|>!%@`]/.test(s) || /^\d/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s);
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return JSON.stringify(value);
  if (!value.includes('\n')) {
    return needsQuoting(value) ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
  }
  return value;
}

function writeValue(key, value, pad) {
  if (value === null || value === undefined) return `${pad}${key}: null\n`;
  if (typeof value !== 'object') {
    const formatted = formatScalar(value);
    if (typeof value === 'string' && value.includes('\n')) {
      let out = `${pad}${key}:\n`;
      for (const line of value.split('\n')) {
        out += `${pad}  ${line}\n`;
      }
      return out;
    }
    return `${pad}${key}: ${formatted}\n`;
  }
  let out = `${pad}${key}:\n`;
  out += serialize(value, pad + '  ');
  return out;
}

function serialize(obj, pad) {
  if (obj === null || obj === undefined) return `${pad}null\n`;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]\n`;
    let out = '';
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item).filter(([, v]) => v !== undefined);
        if (entries.length === 0) {
          out += `${pad}- {}\n`;
        } else {
          const [firstKey, firstVal] = entries[0];
          const formatted = formatScalar(firstVal);
          if (typeof firstVal === 'string' && firstVal.includes('\n')) {
            out += `${pad}- ${firstKey}:\n`;
            for (const line of firstVal.split('\n')) {
              out += `${pad}    ${line}\n`;
            }
          } else {
            out += `${pad}- ${firstKey}: ${formatted}\n`;
          }
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            const f = formatScalar(v);
            if (typeof v === 'string' && v.includes('\n')) {
              out += `${pad}  ${k}:\n`;
              for (const line of v.split('\n')) {
                out += `${pad}      ${line}\n`;
              }
            } else {
              out += `${pad}  ${k}: ${f}\n`;
            }
          }
        }
      } else if (typeof item === 'object' && item !== null) {
        out += `${pad}-\n`;
        out += serialize(item, pad + '  ');
      } else {
        out += `${pad}- ${formatScalar(item)}\n`;
      }
    }
    return out;
  }

  let out = '';
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    out += writeValue(key, value, pad);
  }
  return out;
}

// ── HTML generation ──

function buildHTML(specJSON) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentOps Desktop — API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1117; }
    .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #e6edf3; }
    .swagger-ui .info .description p { color: #b1bac4; }
    .swagger-ui .scheme-container { background: #161b22; box-shadow: none; }
    .swagger-ui .opblock-tag { color: #e6edf3; border-bottom-color: #30363d; }
    .swagger-ui .opblock .opblock-summary-description { color: #b1bac4; }
    .swagger-ui .model-box { background: #161b22; }
    .swagger-ui .topbar { display: none; }
    .header {
      background: linear-gradient(135deg, #1a1040 0%, #0d1117 100%);
      padding: 24px 40px;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header h1 { color: #e6edf3; font-size: 20px; font-weight: 600; }
    .header .badge {
      background: #238636;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .header .transport {
      color: #8b949e;
      font-size: 13px;
      margin-left: auto;
    }
    .header code {
      background: #1c2128;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #79c0ff;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AgentOps Desktop</h1>
    <span class="badge">IPC + HTTP</span>
    <span class="transport">HTTP: <code>http://localhost:3967</code> &nbsp;|&nbsp; IPC: <code>window.agentOps.*</code></span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    const spec = ${specJSON};
    SwaggerUIBundle({
      spec,
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 2,
      docExpansion: 'list',
      syntaxHighlight: { theme: 'monokai' },
    });
  </script>
</body>
</html>`;
}

// ── Main ──

function main() {
  const docsDir = path.resolve(__dirname, '..', 'docs');

  // Generate spec
  const spec = buildSpec();
  const yamlContent = serialize(spec, '');
  const specPath = path.join(docsDir, 'openapi.yaml');
  fs.writeFileSync(specPath, yamlContent, 'utf8');
  console.log(`Generated: ${specPath}`);

  // Generate HTML with embedded spec
  const specJSON = JSON.stringify(spec, null, 2);
  const htmlContent = buildHTML(specJSON);
  const htmlPath = path.join(docsDir, 'api-docs.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`Generated: ${htmlPath}`);

  // Summary
  const pathCount = Object.keys(spec.paths).length;
  const opCount = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
  console.log(`\nSpec: ${pathCount} paths, ${opCount} operations, ${Object.keys(spec.components.schemas).length} schemas`);
  console.log('Tags:', spec.tags.map((t) => t.name).join(', '));
}

main();
