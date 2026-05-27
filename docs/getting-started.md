# Getting Started

AgentOps Desktop is a local-first app for orchestrating multiple AI coding agents from one place. No cloud account needed — everything runs on your machine.

## Prerequisites

- macOS (Windows/Linux support planned)
- Node.js 20+
- At least one CLI agent installed — [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), or [Gemini CLI](https://github.com/google-gemini/gemini-cli)

## Install & Run

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

Use `npm run dev` to launch with DevTools enabled.

## Core Workflow

AgentOps follows a four-step loop: **connect → define → run → review**.

### 1. Connect an Agent

Open **Settings → Agents** and add a CLI agent by providing its executable path and working directory. Click **Test Connection** to verify it's reachable.

### 2. Create a Goal and Tasks

Create a **Goal** (a high-level objective like "Build a TODO API"), then break it into **Tasks**. Assign each task to a connected agent — multiple tasks on one agent run serially; tasks on different agents run in parallel.

### 3. Run and Monitor

Click **Start** to launch all tasks under a Goal. The Monitor panel shows agent status, real-time stdout/stderr logs, and task progress (`pending → running → done` or `failed`). A default limit of 3 parallel agents prevents resource contention.

### 4. Review and Confirm

When tasks finish, review the summary — changed files, diffs, and any errors. Click **Confirm Delivery** to mark the Goal complete.

## Tips

- Adjust max parallel agents in **Settings** if your machine handles more or fewer.
- Tasks have configurable timeouts. Stalled agents are automatically marked failed.
- Logs are raw output today; structured parsing is planned.

## Further Reading

- [API Reference](API.md) — IPC channels and agent runtime
- [Architecture](ARCHITECTURE.md) — system design and data model
- [Roadmap](../ROADMAP.md) — milestones and phase progression
