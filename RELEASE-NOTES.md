# AgentOps Desktop v0.1.0 — Release Notes

**Release date:** 2026-05-28
**Platform:** macOS (arm64, x64)

## What is AgentOps Desktop?

AgentOps Desktop is a local-first desktop application for orchestrating multiple AI coding agents from a single control surface. Connect Claude Code, Codex, Gemini CLI, OpenCode, or any CLI agent — define goals, decompose tasks, assign to agents, execute in parallel, and monitor results, all without leaving your desktop.

## Highlights

### Multi-agent orchestration

Define high-level goals, break them into tasks with dependencies, and let the DAG-based orchestrator run them in parallel across multiple agents. The orchestrator resolves dependency chains automatically and tracks execution status in real-time.

### Squad management

Group agents into squads for coordinated workflows. Assign tasks to squads instead of individual agents, and let the system distribute work across the team.

### Cost control

Set budget limits per agent and per task. The cost guard tracks spending in real-time and prevents overruns before they happen.

### Auto-scheduling

Schedule recurring tasks with cron expressions. The scheduling engine handles execution timing, retry logic, and status reporting.

### Plugin system

Connect any CLI agent through the adapter registry. The generic CLI adapter works out of the box; build custom adapters for specialized integrations.

### Skill reuse

Define reusable skills that encode agent capabilities. Share skills across tasks and agents to avoid duplication and maintain consistency.

### Full REST API

Every operation is available via both Electron IPC and a Hono-based HTTP REST API. Build integrations, automate workflows, or connect external tools.

## Installation

### Download

Download the macOS DMG from the [GitHub Releases](https://github.com/EmtCcc/AgentOpsDesktop/releases) page.

### Build from source

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm run build
```

### Development

```bash
npm install
npm start          # Launch the app
npm run dev        # Launch with DevTools
npm test           # Run unit tests
npm run test:e2e   # Run E2E tests
```

## System requirements

- macOS 12+ (Monterey or later)
- Node.js >= 20 (for building from source)
- At least one CLI agent installed

## What's included

- Agent registry with health checks
- DAG-based task orchestrator
- Squad management
- Cost control and budget management
- Cron-based auto-scheduling
- Plugin adapter system
- Skill reuse system
- Message bus for inter-agent communication
- Shared workspace for agent collaboration
- RBAC (admin/operator/viewer roles)
- HTTP REST API
- Auto-updater
- Health monitoring and alerting
- Structured JSONL logging
- SQLite persistence with migration system
- Dark-mode-first React UI
- VitePress documentation site

## Known limitations

- macOS only in this release. Windows and Linux builds are configured but not yet tested.
- Visual workflow builder is planned for a future release.
- Template marketplace is planned for v0.2.
- Light theme is planned for post-v0.1.

## Documentation

- [Getting Started](docs-site/guide/getting-started.md)
- [Architecture Overview](docs-site/architecture/overview.md)
- [API Reference](docs-site/api/reference.md)
- [Adapter Development Guide](docs-site/adapters/guide.md)
- [Skill Development Guide](docs-site/skills/guide.md)

## Feedback

- [GitHub Issues](https://github.com/EmtCcc/AgentOpsDesktop/issues)
- [Security reports](SECURITY.md)
