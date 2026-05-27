# AgentOps Desktop

Local-first desktop application for orchestrating multiple AI agents into a unified, manageable team.

AgentOps Desktop connects CLI agents (Claude Code, Codex, Gemini CLI, OpenCode, and others) from a single Electron app. Define goals, decompose tasks, assign to agents, and monitor execution — all without leaving your desktop.

## Status

**Phase: Foundation (v0.1)** — The project is in early development. The Electron shell runs, IPC handlers are wired, and a basic renderer is in place. React UI, SQLite persistence, and agent runtime integration are planned but not yet implemented.

See [ROADMAP.md](ROADMAP.md) for the full milestone plan.

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
npm run dev     # Run with DevTools open
npm run lint    # Lint source files
npm test        # Run unit tests (Vitest)
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
│   ├── main/              # Electron main process
│   │   ├── index.js       # App entry — window, IPC handlers, in-memory stores
│   │   ├── preload.js     # contextBridge — exposes window.agentOps to renderer
│   │   ├── agent-runtime.js  # CLI agent spawn/kill/log via child_process
│   │   ├── store.js       # JSON file-based persistence (~/.agentops/data.json)
│   │   ├── logger.js      # Structured JSONL logging
│   │   ├── monitor.js     # Health metrics, alerting, crash tracking
│   │   └── ipc/           # Scaffolding for structured IPC (not yet wired)
│   ├── renderer/
│   │   └── index.html     # Renderer entry — placeholder welcome page
│   └── shared/            # (planned) Shared types and constants
├── assets/                # Icons and static assets
├── docs/                  # Architecture, API, guides
├── tests/
│   ├── unit/              # Vitest unit tests
│   └── e2e/               # Playwright E2E tests
└── scripts/               # (planned) Build and CI scripts
```

## Architecture

The app follows a standard Electron main/renderer split:

- **Main process** (`src/main/`) — owns all Node.js capabilities: IPC handlers, agent process management, file-based data store, logging, and health monitoring.
- **Renderer** (`src/renderer/`) — the UI layer. Currently a static HTML placeholder; will become a React SPA.
- **Preload** (`src/main/preload.js`) — bridges main and renderer via `contextBridge`, exposing a typed `window.agentOps` API.

Data currently lives in `~/.agentops/data.json` (JSON file store). The target architecture calls for SQLite with WAL mode — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## IPC API

The renderer communicates with the main process through these channels via `window.agentOps`:

| Namespace   | Methods                                         |
|-------------|------------------------------------------------|
| `agents`    | `list`, `create`, `update`, `delete`, `healthCheck` |
| `goals`     | `list`, `create`, `update`, `delete`           |
| `tasks`     | `list`, `create`, `update`, `delete`           |
| `logs`      | `list`, `append`, `onNew`                      |
| `stats`     | `summary`                                      |
| `monitor`   | `health`                                       |

See [docs/API.md](docs/API.md) for full reference.

## Documentation

- [Getting Started](docs/getting-started.md) — Setup and core workflow walkthrough
- [Architecture](docs/ARCHITECTURE.md) — Target system design, data model, IPC protocol
- [API Reference](docs/API.md) — IPC channels and Paperclip REST API
- [Contributing](CONTRIBUTING.md) — Setup, conventions, PR process
- [Roadmap](ROADMAP.md) — Milestones and phase plan

## License

Proprietary
