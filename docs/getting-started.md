# Getting Started with AgentOps Desktop

AgentOps Desktop lets you connect, orchestrate, and monitor multiple AI agents from a single desktop app. No cloud account required — everything runs locally.

## Prerequisites

- macOS (Windows and Linux support coming later)
- Node.js 20+
- At least one CLI agent installed (e.g. [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli))

## Install

```bash
git clone https://github.com/<your-org>/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

## Core Workflow

AgentOps Desktop follows a simple loop: **connect agents → define tasks → run & monitor → review results**.

### Step 1 — Connect an Agent

Open **Settings → Agents** and add a CLI agent:

| Field | Example |
|-------|---------|
| **Name** | `claude-code` |
| Executable path | `/usr/local/bin/claude` |
| Working directory | `/Users/you/projects/my-app` |

Click **Test Connection** to verify the agent is reachable. A green badge means it's ready.

### Step 2 — Create a Goal and Tasks

Go to the **Task Board** and create a **Goal** — a high-level objective like "Implement a TODO API".

Break the Goal into **Tasks**:

1. "Design the database schema"
2. "Build CRUD endpoints"

Each task gets assigned to a connected agent. You can assign multiple tasks to the same agent (runs serially) or spread them across agents (runs in parallel).

### Step 3 — Run and Monitor

Click **Start** on a Goal to kick off all its tasks. The **Monitor** panel shows:

- **Status** — which agents are running, idle, blocked, or failed
- **Live Logs** — real-time stdout/stderr streaming per task
- **Progress** — tasks move through `pending → running → done` (or `failed`)

You can let tasks run in the background while you do other work. The status bar will alert you if something needs attention.

### Step 4 — Review and Confirm Delivery

When all tasks in a Goal complete, the **Summary** panel shows:

- Changed files and diff summaries
- Per-task output previews
- Any warnings or errors encountered

Review the output, then click **Confirm Delivery** to mark the Goal as done.

## Tips

- **Max parallel agents**: Defaults to 3. Adjust in Settings if your machine can handle more or fewer.
- **Timeouts**: Each task has a configurable timeout. If an agent stalls, the task is marked failed and you're notified.
- **Raw output first**: Agent logs are shown as-is. Structured parsing will come in a future release.

## What's Next

- [Vision & Roadmap](VISION.md) — where AgentOps Desktop is headed
- [MVP Scope](MVP-SCOPE.md) — detailed feature specs and acceptance criteria
- [Design System](DESIGN-SYSTEM.md) — UI components and tokens
