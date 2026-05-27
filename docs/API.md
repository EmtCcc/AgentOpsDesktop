# API Reference

AgentOpsDesktop exposes IPC channels between the Electron main process and renderer, and communicates with the Paperclip control plane via REST.

## IPC Channels

All IPC uses Electron's `ipcMain` / `ipcRenderer` bridge. Channels are namespaced by domain.

### Agent Lifecycle

#### `agent:spawn`

Spawn a CLI agent for a given task.

**Request** (Renderer → Main):
```typescript
{
  taskId: string;          // Paperclip task ID
  agentType: 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor' | 'custom';
  command?: string;        // Override default command
  args?: string[];         // Additional CLI arguments
  cwd?: string;            // Working directory
  env?: Record<string, string>;  // Environment variables
}
```

**Response** (Main → Renderer):
```typescript
{
  pid: number;             // Process ID
  sessionId: string;       // Internal session identifier
}
```

#### `agent:output`

Stream agent stdout/stderr to the renderer.

**Payload** (Main → Renderer):
```typescript
{
  sessionId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}
```

#### `agent:status`

Agent lifecycle events.

**Payload** (Main → Renderer):
```typescript
{
  sessionId: string;
  status: 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';
  exitCode?: number;
  error?: string;
}
```

#### `agent:kill`

Terminate a running agent.

**Request** (Renderer → Main):
```typescript
{
  sessionId: string;
  signal?: 'SIGTERM' | 'SIGKILL';  // Default: SIGTERM
}
```

### Task Management

#### `task:update`

Update task state. Bidirectional — UI changes propagate to Paperclip, Paperclip webhooks propagate to UI.

**Payload**:
```typescript
{
  taskId: string;
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  assigneeAgentId?: string;
  metadata?: Record<string, unknown>;
}
```

### Governance

#### `governance:approve`

Respond to an approval gate.

**Request** (Renderer → Main):
```typescript
{
  gateId: string;
  decision: 'approve' | 'reject' | 'rollback';
  comment?: string;
}
```

## Paperclip REST API

AgentOpsDesktop communicates with the Paperclip control plane for goal/task CRUD and governance. See the [Paperclip API documentation](https://paperclip.dev/docs/api) for full reference.

### Key Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/companies/{id}/goals` | List company goals |
| `POST` | `/api/companies/{id}/goals` | Create a goal |
| `PATCH` | `/api/goals/{id}` | Update goal status |
| `GET` | `/api/projects/{id}/issues` | List project issues/tasks |
| `POST` | `/api/issues` | Create an issue |
| `PATCH` | `/api/issues/{id}` | Update issue (status, assignee, etc.) |
| `POST` | `/api/issues/{id}/checkout` | Claim an issue |
| `POST` | `/api/issues/{id}/comments` | Post a comment |
| `POST` | `/api/issues/{id}/interactions` | Create interaction (approval, question) |

### Authentication

All Paperclip API requests require a bearer token passed via the `Authorization` header. The token is configured in the application settings and stored in the OS keychain.

## Agent CLI Protocols

Each supported agent has a runtime adapter that handles:

| Agent | Communication | Notes |
|-------|--------------|-------|
| Claude Code | `stdin`/`stdout` JSON lines | Supports tool use, streaming |
| Codex | `stdin`/`stdout` | OpenAI Codex CLI |
| Gemini CLI | `stdin`/`stdout` | Google Gemini CLI |
| OpenCode | `stdin`/`stdout` | Open-source coding agent |
| Cursor | Background process | IDE-integrated agent |
| Custom | Configurable | User-defined command + args |

### Adapter Interface

```typescript
interface AgentAdapter {
  type: string;
  spawn(config: SpawnConfig): Promise<AgentSession>;
  send(session: AgentSession, input: string): Promise<void>;
  kill(session: AgentSession, signal?: string): Promise<void>;
  onOutput(session: AgentSession, handler: (data: OutputChunk) => void): void;
  onStatus(session: AgentSession, handler: (status: AgentStatus) => void): void;
}
```
