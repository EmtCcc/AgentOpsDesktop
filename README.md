# AgentOpsDesktop

Local-first desktop application for orchestrating multiple AI agents into a unified, manageable, governable team.

AgentOpsDesktop combines:

- **Multica** agent lifecycle management — task assignment, progress tracking, skill reuse, runtime management
- **Paperclip** goal governance — company/project goals, org structure, budget, approvals, audit logs
- **golutra** desktop multi-agent UX — CLI compatibility, parallel execution, visual monitoring, background terminals, workflow templates

## Vision

Connect Claude Code, Codex, Gemini CLI, OpenCode, Cursor, and any CLI agent — all from one desktop app. Create goals, decompose tasks, assign to different agents for parallel execution. Monitor logs, status, cost, blockers, and delivery results in real time. Approve, pause, take over, or roll back when needed.

Turn "one person + multiple AI tools" chaos into "one person commanding an AI team" workflow.

## Project Structure

```
AgentOpsDesktop/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # UI (React)
│   ├── agents/         # Agent runtime adapters
│   ├── paperclip/      # Paperclip governance integration
│   └── shared/         # Shared types and utilities
├── assets/             # Static assets (icons, images)
├── docs/               # Architecture, API reference, guides
├── tests/              # Test suites
└── scripts/            # Build, CI, and dev scripts
```

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

### Install

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
```

### Run

```bash
npm start
```

### Development

```bash
npm run dev    # Run with dev flags
npm run lint   # Lint source files
npm test       # Run tests
```

### Build

```bash
npm run build
```

## Key Features (Planned)

| Feature | Status |
|---------|--------|
| Multi-agent CLI connection | Planned |
| Task board with agent assignment | Planned |
| Parallel execution & background terminals | Planned |
| Real-time log streaming | Planned |
| Budget / cost control | Planned |
| Approval gates & audit trail | Planned |
| Workflow templates | Planned |
| Cross-platform (Windows / macOS / Linux) | Planned |

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) — System design, components, data flow
- [API Reference](docs/API.md) — IPC channels, Paperclip REST API, agent protocols
- [Contributing Guide](CONTRIBUTING.md) — Setup, conventions, PR process

## License

Proprietary
