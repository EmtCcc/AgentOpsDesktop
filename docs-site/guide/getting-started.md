# Getting Started

AgentOps Desktop is a local-first app for orchestrating multiple AI coding agents from one place. No cloud account needed — everything runs on your machine.

## Prerequisites

- **Node.js** >= 20
- **macOS** (Windows/Linux support planned)
- At least one CLI agent installed:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
  - [Codex](https://github.com/openai/codex)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli)

## Install & Run

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

Use `npm run dev` to launch with DevTools enabled for debugging.

## Core Workflow

AgentOps follows a four-step loop: **connect → define → run → review**.

### 1. Connect an Agent

Open **Settings → Agents** and add a CLI agent by providing its executable path and working directory. Click **Test Connection** to verify it's reachable.

```bash
# Example: connecting Claude Code
Executable: /usr/local/bin/claude
Working Dir: /path/to/your/project
```

### 2. Create a Goal and Tasks

Create a **Goal** (a high-level objective like "Build a TODO API"), then break it into **Tasks**. Assign each task to a connected agent.

- Multiple tasks on one agent run **serially**
- Tasks on different agents run **in parallel**
- A default limit of 3 parallel agents prevents resource contention

### 3. Run and Monitor

Click **Start** to launch all tasks under a Goal. The Monitor panel shows:

- Agent status (idle / running / error / offline)
- Real-time stdout/stderr logs
- Task progress (`pending → running → done` or `failed`)

### 4. Review and Confirm

When tasks finish, review the summary — changed files, diffs, and any errors. Click **Confirm Delivery** to mark the Goal complete.

## Tips

- Adjust max parallel agents in **Settings** if your machine handles more or fewer
- Tasks have configurable timeouts — stalled agents are automatically marked failed
- Logs are raw output today; structured parsing is planned

## Development

```bash
npm run dev            # Run with DevTools open
npm run lint           # Lint source files
npm test               # Run unit tests (Vitest)
npm run test:e2e       # Run E2E tests (Playwright)
npm run test:e2e:chromium  # E2E tests (Chromium only)
```

## Project Structure

```
AgentOpsDesktop/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.js       # App entry — window, IPC, in-memory stores
│   │   ├── preload.js     # contextBridge — exposes window.agentOps
│   │   ├── agent-engine.js    # Agent lifecycle, resource monitoring, crash recovery
│   │   ├── adapter-registry.js # Adapter registration and loading
│   │   └── ...
│   ├── renderer/          # UI layer (static HTML placeholder)
│   └── shared/            # Shared types (planned)
├── docs/                  # Project documentation
├── tests/                 # Unit + E2E tests
└── scripts/               # Build and CI scripts
```

## Next Steps

- [Architecture Overview](/architecture/overview) — understand the system design
- [API Reference](/api/reference) — IPC channels and data shapes
- [Adapter Guide](/adapters/guide) — build custom agent adapters
- [Skill Guide](/skills/guide) — register skills for agents
