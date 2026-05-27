'use strict';

/**
 * Generate OpenAPI 3.0 spec and Swagger UI HTML for AgentOps Desktop IPC API.
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

// ── Route definitions (mirrors src/main/ipc/index.js) ──

const routes = [
  // Auth (public)
  {
    channel: 'auth:login',
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Create a session',
    description: 'Creates a new authenticated session and returns a token.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Session token' },
        expiresAt: { type: 'number', description: 'Token expiration timestamp (ms)' },
      },
    },
  },
  {
    channel: 'auth:status',
    method: 'get',
    path: '/auth/status',
    tag: 'Auth',
    summary: 'Check session validity',
    description: 'Returns the current session info or invalid status.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        token: { type: 'string' },
        expiresAt: { type: 'number' },
        createdAt: { type: 'number' },
      },
    },
  },
  {
    channel: 'auth:logout',
    method: 'post',
    path: '/auth/logout',
    tag: 'Auth',
    summary: 'Destroy session',
    description: 'Destroys the current authenticated session.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    },
  },
  {
    channel: 'auth:rotate',
    method: 'post',
    path: '/auth/rotate',
    tag: 'Auth',
    summary: 'Rotate session token',
    description: 'Rotates the current session token and returns a new one.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        expiresAt: { type: 'number' },
      },
    },
  },

  // Monitoring (public)
  {
    channel: 'monitor:health',
    method: 'get',
    path: '/monitor/health',
    tag: 'Monitoring',
    summary: 'System health check',
    description: 'Returns application health status, version, platform info, and memory usage.',
    auth: false,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
        version: { type: 'string' },
        platform: { type: 'string' },
        arch: { type: 'string' },
        nodeVersion: { type: 'string' },
        uptime: { type: 'number' },
        memory: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            free: { type: 'number' },
            usage: { type: 'object' },
          },
        },
        timestamp: { type: 'number' },
      },
    },
  },

  // Agents — Config CRUD
  {
    channel: 'agents:list',
    method: 'get',
    path: '/agents',
    tag: 'Agents',
    summary: 'List agent configs',
    description: 'Lists all registered agent configurations with pagination and optional status filter.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset' },
        limit: { type: 'number', description: 'Max items to return' },
        status: { type: 'string', enum: ['idle', 'running', 'error'] },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Agent' },
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
      properties: { id: { type: 'string' } },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
  },
  {
    channel: 'agents:create',
    method: 'post',
    path: '/agents',
    tag: 'Agents',
    summary: 'Create agent config',
    description: 'Registers a new agent configuration.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
        command: { type: 'string', maxLength: 1000 },
        execPath: { type: 'string', maxLength: 1000 },
        cwd: { type: 'string', maxLength: 500 },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
  },
  {
    channel: 'agents:update',
    method: 'patch',
    path: '/agents/{id}',
    tag: 'Agents',
    summary: 'Update agent config',
    description: 'Updates fields on an existing agent configuration.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string' },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
            status: { type: 'string', enum: ['idle', 'running', 'error'] },
            command: { type: 'string' },
            execPath: { type: 'string' },
            cwd: { type: 'string' },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Agent' },
  },
  {
    channel: 'agents:delete',
    method: 'delete',
    path: '/agents/{id}',
    tag: 'Agents',
    summary: 'Delete agent config',
    description: 'Removes an agent configuration.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        id: { type: 'string' },
      },
    },
  },
  {
    channel: 'agents:health-check',
    method: 'post',
    path: '/agents/{id}/health-check',
    tag: 'Agents',
    summary: 'Validate agent executable',
    description: 'Checks whether the agent executable exists and is runnable.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        execValid: { type: 'boolean' },
        processAlive: { type: 'boolean' },
        status: { type: 'string' },
      },
    },
  },

  // Agents — Live process management
  {
    channel: 'agents:spawn',
    method: 'post',
    path: '/agents/spawn',
    tag: 'Agent Processes',
    summary: 'Spawn agent process',
    description: 'Spawns a new CLI agent process and returns session info.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['execPath'],
      properties: {
        execPath: { type: 'string', minLength: 1 },
        name: { type: 'string', maxLength: 200 },
        args: { type: 'array', items: { type: 'string' } },
        cwd: { type: 'string' },
        env: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        execPath: { type: 'string' },
        status: { type: 'string', enum: ['spawning', 'running'] },
        pid: { type: 'number' },
        startedAt: { type: 'number' },
      },
    },
  },
  {
    channel: 'agents:status',
    method: 'get',
    path: '/agents/processes/{id}',
    tag: 'Agent Processes',
    summary: 'Get agent session status',
    description: 'Returns the current status of a live agent process.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['spawning', 'running', 'stopped', 'error'] },
        pid: { type: 'number' },
        exitCode: { type: 'number', nullable: true },
        error: { type: 'string', nullable: true },
        startedAt: { type: 'number' },
        endedAt: { type: 'number', nullable: true },
        logCount: { type: 'number' },
      },
    },
  },
  {
    channel: 'agents:kill',
    method: 'post',
    path: '/agents/processes/{id}/kill',
    tag: 'Agent Processes',
    summary: 'Kill agent process',
    description: 'Sends a signal to terminate a live agent process. Defaults to SIGTERM, escalates to SIGKILL after 5s.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        signal: { type: 'string', description: 'Signal to send (default: SIGTERM)' },
      },
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['stopped'] },
      },
    },
  },

  // Goals
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
        offset: { type: 'number' },
        limit: { type: 'number' },
        status: { type: 'string', enum: ['active', 'completed', 'archived'] },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Goal' },
    },
  },
  {
    channel: 'goals:get',
    method: 'get',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Get goal',
    description: 'Returns a single goal by ID.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
  },
  {
    channel: 'goals:create',
    method: 'post',
    path: '/goals',
    tag: 'Goals',
    summary: 'Create goal',
    description: 'Creates a new goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 5000 },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
  },
  {
    channel: 'goals:update',
    method: 'patch',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Update goal',
    description: 'Updates fields on an existing goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string' },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'archived'] },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Goal' },
  },
  {
    channel: 'goals:delete',
    method: 'delete',
    path: '/goals/{id}',
    tag: 'Goals',
    summary: 'Delete goal',
    description: 'Removes a goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        id: { type: 'string' },
      },
    },
  },

  // Tasks
  {
    channel: 'tasks:list',
    method: 'get',
    path: '/tasks',
    tag: 'Tasks',
    summary: 'List tasks',
    description: 'Lists all tasks with pagination and optional filters.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number' },
        limit: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'running', 'done', 'failed'] },
        goalId: { type: 'string' },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    responseSchema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Task' },
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
      properties: { id: { type: 'string' } },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
  },
  {
    channel: 'tasks:create',
    method: 'post',
    path: '/tasks',
    tag: 'Tasks',
    summary: 'Create task',
    description: 'Creates a new task. Optionally links to a parent goal.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 5000 },
        goalId: { type: 'string' },
        assigneeAgentId: { type: 'string' },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
  },
  {
    channel: 'tasks:update',
    method: 'patch',
    path: '/tasks/{id}',
    tag: 'Tasks',
    summary: 'Update task',
    description: 'Updates fields on an existing task.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string' },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'done', 'failed'] },
            goalId: { type: 'string' },
            assigneeAgentId: { type: 'string' },
          },
        },
      },
    },
    responseSchema: { $ref: '#/components/schemas/Task' },
  },
  {
    channel: 'tasks:delete',
    method: 'delete',
    path: '/tasks/{id}',
    tag: 'Tasks',
    summary: 'Delete task',
    description: 'Removes a task.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    responseSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        id: { type: 'string' },
      },
    },
  },

  // Logs
  {
    channel: 'logs:list',
    method: 'get',
    path: '/logs',
    tag: 'Logs',
    summary: 'List log entries',
    description: 'Lists log entries. Filter by agentId for session-specific logs.',
    auth: true,
    requestSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    responseSchema: {
      type: 'array',
      items: { $ref: '#/components/schemas/LogEntry' },
    },
  },
  {
    channel: 'logs:append',
    method: 'post',
    path: '/logs',
    tag: 'Logs',
    summary: 'Append log entry',
    description: 'Appends a new log entry to the global log buffer.',
    auth: true,
    requestSchema: {
      type: 'object',
      required: ['message'],
      properties: {
        agentId: { type: 'string' },
        message: { type: 'string' },
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
        stream: { type: 'string', enum: ['stdout', 'stderr'] },
      },
    },
    responseSchema: { $ref: '#/components/schemas/LogEntry' },
  },

  // Stats
  {
    channel: 'stats:summary',
    method: 'get',
    path: '/stats/summary',
    tag: 'Stats',
    summary: 'Dashboard stats',
    description: 'Returns aggregated counts for agents and tasks by status.',
    auth: true,
    requestSchema: null,
    responseSchema: {
      type: 'object',
      properties: {
        agents: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            running: { type: 'number' },
            idle: { type: 'number' },
            error: { type: 'number' },
            stopped: { type: 'number' },
          },
        },
        tasks: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            pending: { type: 'number' },
            running: { type: 'number' },
            done: { type: 'number' },
            failed: { type: 'number' },
          },
        },
      },
    },
  },
];

// ── OpenAPI spec generation ──

function schemaToOpenAPI(schema) {
  if (!schema) return undefined;
  const out = { ...schema };
  if (out.nullable === undefined && out.type) {
    // keep as-is
  }
  return out;
}

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
    };

    // Auth
    if (route.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Parameters (path params from {id} patterns)
    const pathParams = [...route.path.matchAll(/\{(\w+)\}/g)];
    if (pathParams.length > 0) {
      operation.parameters = pathParams.map((m) => ({
        name: m[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }));
    }

    // Request body
    if (route.requestSchema) {
      // Extract query params for GET requests
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

    // Response
    operation.responses = {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: route.responseSchema || { type: 'object' },
          },
        },
      },
    };

    if (route.auth) {
      operation.responses['401'] = { description: 'Unauthorized — invalid or missing token' };
    }
    if (route.requestSchema) {
      operation.responses['422'] = { description: 'Validation error' };
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
        'IPC API for AgentOps Desktop — an Electron application for managing AI agent sessions, goals, tasks, and logs.\n\n' +
        '**Transport**: Electron IPC (ipcMain.handle / ipcRenderer.invoke)\n' +
        '**Auth**: Bearer token via session management\n\n' +
        'This spec documents the IPC channel interface. Each operation maps to an IPC channel ' +
        '(listed in `x-ipc-channel`). Call via `window.api.invoke(channel, payload)` from the renderer.',
      version: '0.1.0',
      contact: { name: 'AgentOps Team' },
      license: { name: 'UNLICENSED' },
    },
    servers: [
      {
        url: 'ipc://localhost',
        description: 'Electron IPC transport',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Session management (login, logout, token rotation)' },
      { name: 'Monitoring', description: 'Health checks and system diagnostics' },
      { name: 'Agents', description: 'Agent configuration CRUD' },
      { name: 'Agent Processes', description: 'Live agent process management (spawn, kill, status)' },
      { name: 'Goals', description: 'Goal management' },
      { name: 'Tasks', description: 'Task management with goal linking' },
      { name: 'Logs', description: 'Log entry management' },
      { name: 'Stats', description: 'Aggregated dashboard statistics' },
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
            name: { type: 'string', example: 'my-claude-agent' },
            type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
            status: { type: 'string', enum: ['idle', 'running', 'error', 'spawning', 'stopped'] },
            command: { type: 'string', nullable: true },
            execPath: { type: 'string', nullable: true },
            cwd: { type: 'string', nullable: true },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' },
          },
        },
        Goal: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'goal-1' },
            title: { type: 'string', example: 'Ship MVP' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'completed', 'archived'] },
            taskIds: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'task-1' },
            title: { type: 'string', example: 'Implement auth' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'running', 'done', 'failed'] },
            goalId: { type: 'string', nullable: true },
            assigneeAgentId: { type: 'string', nullable: true },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' },
          },
        },
        LogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            agentId: { type: 'string', nullable: true },
            message: { type: 'string' },
            level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
            stream: { type: 'string', enum: ['stdout', 'stderr'] },
            timestamp: { type: 'number' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                status: { type: 'number' },
                field: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths: buildPaths(routes),
  };
}

// ── YAML serialization (minimal, no dependency) ──

function toYAML(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  let out = '';

  if (obj === null || obj === undefined) return `${pad}null\n`;
  if (typeof obj === 'boolean') return `${pad}${obj}\n`;
  if (typeof obj === 'number') return `${pad}${obj}\n`;
  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      // Use YAML literal block scalar for multiline strings
      const lines = obj.split('\n');
      let result = `${pad}|\n`;
      for (const line of lines) {
        result += `${pad}  ${line}\n`;
      }
      return result;
    }
    if (obj.includes(':') || obj.includes('#') || obj.includes('"') || obj.includes("'") || obj.includes('{') || obj.includes('[') || obj === '' || /^\d/.test(obj) || /^(true|false|null|yes|no|on|off)$/i.test(obj)) {
      return `${pad}"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
    }
    return `${pad}${obj}\n`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]\n`;
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        out += `${pad}-\n`;
        out += toYAML(item, indent + 2);
      } else {
        out += `${pad}- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`;
      }
    }
    return out;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
        out += `${pad}${key}:\n`;
        out += toYAML(value, indent + 1);
      } else if (Array.isArray(value) && value.length > 0) {
        out += `${pad}${key}:\n`;
        out += toYAML(value, indent + 1);
      } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
        out += `${pad}${key}: {}\n`;
      } else {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        out += `${pad}${key}: ${valStr}\n`;
      }
    }
    return out;
  }

  return `${pad}${JSON.stringify(obj)}\n`;
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
    <span class="badge">IPC API</span>
    <span class="transport">Transport: <code>window.api.invoke(channel, payload)</code></span>
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
  const yamlContent = toYAML(spec);
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
}

main();
