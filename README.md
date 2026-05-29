# AgentOps Desktop

Local-first desktop application for orchestrating multiple AI agents into a unified, manageable team.

AgentOps Desktop connects CLI agents (Claude Code, Codex, Gemini CLI, OpenCode, and others) from a single Electron app. Define goals, decompose tasks, assign to agents, and execute in parallel — all without leaving your desktop.

**Tagline:** *Operational control for autonomous agents.*

## Status

**v0.1.0** — Initial public release. The app is functional with a full feature set covering agent management, task orchestration, squad coordination, cost control, scheduling, and a plugin system.

See [ROADMAP.md](ROADMAP.md) for the milestone plan and [CHANGELOG.md](CHANGELOG.md) for release history.

## Features

- **Agent registry** — Add, configure, and manage CLI agent connections with health checks
- **Task orchestration** — DAG-based multi-agent parallel execution with dependency resolution
- **Squad management** — Group agents into squads for coordinated workflows
- **Cost control** — Budget management, spending limits, and cost tracking per agent/task
- **Auto-scheduling** — Cron-based scheduling engine for recurring task execution
- **Plugin system** — Custom agent adapter registry with a generic CLI adapter
- **Skill reuse** — Share and reuse agent capabilities across tasks
- **Message bus** — Inter-agent communication with persistence
- **Shared workspace** — Common context store for agent collaboration
- **RBAC** — Role-based access control (admin/operator/viewer)
- **HTTP API** — Full REST API (Hono) alongside Electron IPC
- **Auto-updater** — Seamless updates via electron-updater + GitHub Releases
- **Health monitoring** — Metrics, alerting, and crash tracking
- **Group chat** — Multi-agent conversation orchestration with strategy-based turn management
- **Shared context** — DAG-scoped key-value blackboard for agent collaboration
- **Governance** — Approval gates for task-level policy enforcement
- **Telemetry** — Usage statistics, export, and data management

## Quick Start

### Prerequisites

- Node.js >= 20
- macOS (Windows and Linux support planned)
- At least one CLI agent installed (e.g. [Claude Code](https://docs.anthropic.com/en/docs/claude-code))

### Install and Run

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

### Development

```bash
npm run dev       # Run with DevTools open
npm run lint      # Lint source files
npm test          # Run unit tests (Vitest)
npm run test:e2e  # Run E2E tests (Playwright)
```

### Build

```bash
npm run build        # Build macOS DMG
npm run build:dir    # Build unpacked directory
```

## Project Structure

```
AgentOpsDesktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.js             # App entry — window, IPC, lifecycle
│   │   ├── preload.js           # contextBridge — exposes window.agentOps
│   │   ├── agent-engine.js      # Agent lifecycle engine
│   │   ├── agent-runtime.js     # CLI agent spawn/kill via child_process
│   │   ├── task-orchestrator.js # DAG-based multi-agent orchestration
│   │   ├── group-chat-engine.js # Multi-agent group chat orchestration
│   │   ├── workspace-manager.js # Shared workspace for agents
│   │   ├── scheduler.js         # Cron-based auto-scheduling
│   │   ├── cost-guard.js        # Budget management and cost tracking
│   │   ├── adapter-registry.js  # Plugin system for custom adapters
│   │   ├── monitor.js           # Health metrics, alerting, crash tracking
│   │   ├── logger.js            # Structured JSONL logging
│   │   ├── store.js             # JSON file-based persistence
│   │   ├── db/                  # SQLite (better-sqlite3) with migrations
│   │   │   ├── schema.js        # Full schema (v10, includes DAG tables)
│   │   │   └── repositories/    # Agent, goal, task, log, settings repos
│   │   ├── repositories/        # Extended repos (schedule, squad, cost, etc.)
│   │   ├── ipc/                 # 20 IPC controllers + middleware (auth, RBAC)
│   │   ├── api/                 # Hono REST API (13 route files)
│   │   └── message-bus/         # Inter-agent messaging with persistence
│   ├── renderer/
│   │   ├── app.js               # Main React application
│   │   ├── pages/               # Agents, Tasks, Squads, Logs, Settings
│   │   ├── styles/              # Design system CSS (tokens, components)
│   │   └── index.html           # Renderer entry with CSP
│   └── shared/
│       └── types.js             # Shared type definitions
├── skills/                      # Example skills (code-review, file-analyzer)
├── docs/                        # Architecture, API, security, design docs
├── docs-site/                   # VitePress documentation site
├── designs/                     # Logo and design assets
├── tests/
│   ├── unit/                    # Vitest unit tests
│   └── e2e/                     # Playwright E2E tests
└── scripts/                     # Build and CI scripts
```

## Architecture

The app follows a standard Electron main/renderer split with a layered architecture:

- **Main process** (`src/main/`) — Owns all Node.js capabilities: agent process management, SQLite database, IPC handlers, HTTP API, task orchestration, scheduling, and health monitoring.
- **Renderer** (`src/renderer/`) — React SPA with pages for agents, tasks, squads, logs, and settings. Uses a custom design system with dark-mode-first aesthetic.
- **Preload** (`src/main/preload.js`) — Bridges main and renderer via `contextBridge`, exposing a typed `window.agentOps` API.
- **Database** — SQLite (better-sqlite3) with WAL mode, migration system, and repository pattern.
- **HTTP API** — Hono-based REST API running alongside IPC for external integrations.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## IPC API

The renderer communicates with the main process through these namespaces via `window.agentOps`:

| Namespace      | Methods                                                    |
|----------------|------------------------------------------------------------|
| `agents`       | `list`, `create`, `update`, `delete`, `healthCheck`        |
| `goals`        | `list`, `create`, `update`, `delete`                       |
| `tasks`        | `list`, `create`, `update`, `delete`, `output`, `handoff`  |
| `logs`         | `list`, `append`, `onNew`                                  |
| `orchestrator` | `run`, `status`, `cancel`                                  |
| `workspaces`   | `list`, `create`, `read`, `write`                          |
| `schedules`    | `list`, `create`, `update`, `delete`                       |
| `squads`       | `list`, `create`, `update`, `delete`                       |
| `cost`         | `summary`, `limits`, `reset`                               |
| `adapters`     | `list`, `register`, `remove`                               |
| `skills`       | `list`, `register`, `invoke`                               |
| `stats`        | `summary`                                                  |
| `monitor`      | `health`                                                   |
| `chat`         | `list`, `get`, `create`, `update`, `delete`, `start`, `pause`, `resume`, `stop`, `sendMessage`, `listMessages`, `addParticipant`, `removeParticipant`, `getState` |
| `messageBus`   | `publish`, `subscribe`, `unsubscribe`, `request`, `replay`, `stats` |
| `sharedContext` | `set`, `get`, `getMany`, `list`, `delete`                 |
| `governance`   | `approve`, `listPending`, `register`                       |
| `system`       | `healthCheck`, `listRoutes`                                |
| `telemetry`    | `getStats`, `setEnabled`, `exportData`, `clearData`        |

See [docs/API.md](docs/API.md) for full reference.

## Documentation

- [Getting Started](docs-site/guide/getting-started.md) — Setup and core workflow walkthrough
- [Architecture](docs-site/architecture/overview.md) — System design and data model
- [API Reference](docs-site/api/reference.md) — IPC and REST API reference
- [Adapter Guide](docs-site/adapters/guide.md) — Building custom agent adapters
- [Skill Guide](docs-site/skills/guide.md) — Creating and sharing skills
- [Contributing](CONTRIBUTING.md) — Setup, conventions, PR process
- [Security](SECURITY.md) — Vulnerability reporting and security architecture
- [Roadmap](ROADMAP.md) — Milestones and phase plan

## License

Proprietary
