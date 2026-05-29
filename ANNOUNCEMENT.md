# AgentOps Desktop v0.1.0 — Public Launch Announcement

## Short version (social media / GitHub Release tagline)

> AgentOps Desktop v0.1.0 is here. Local-first multi-agent orchestration for developers. Connect Claude Code, Codex, Gemini CLI, or any CLI agent — define goals, run tasks in parallel, monitor everything from one desktop app.
>
> 🔗 https://github.com/EmtCcc/AgentOpsDesktop

## Medium version (GitHub Release body / blog intro)

We're releasing AgentOps Desktop v0.1.0 — a local-first desktop application for orchestrating multiple AI coding agents from a single control surface.

If you're running Claude Code for one task, Codex for another, and Gemini CLI for a third, you're context-switching between terminals, losing track of what's running where, and managing costs with spreadsheets. AgentOps Desktop fixes that.

**What it does:**

- **Connect any CLI agent** through a unified adapter system. Claude Code, Codex, Gemini CLI, OpenCode — if it runs in a terminal, AgentOps can manage it.
- **Define goals, decompose tasks.** Break high-level objectives into tasks with dependencies. The DAG-based orchestrator runs them in parallel across agents.
- **Monitor everything.** Live logs, agent status, cost tracking, health alerts — all in one dashboard.
- **Control costs.** Set budget limits per agent and per task. The cost guard prevents overruns before they happen.
- **Schedule recurring work.** Cron-based scheduling for tasks that need to run on a regular cadence.
- **Share capabilities.** Define reusable skills and share them across agents and tasks.

**What makes it different:**

- **Local-first.** All data stays on your machine. No cloud account, no latency, full privacy.
- **Agent-agnostic.** Not locked to any single AI provider. Connect whatever agents work best for your workflow.
- **Governance built in.** RBAC, approval gates, cost guards, and audit trails keep multi-agent workflows under control.

**Get started:**

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

Or download the macOS DMG from the [releases page](https://github.com/EmtCcc/AgentOpsDesktop/releases).

**Documentation:** [agentops.dev](https://agentops.dev) (coming soon) or browse the `docs-site/` directory in the repo.

## Long version (blog post / detailed announcement)

### The problem

AI coding agents are powerful, but managing multiple agents is a manual, fragmented experience. Each agent lives in its own terminal. There's no unified view of what's running, what's spending money, and what's actually done. If you're orchestrating a multi-agent workflow — say, having one agent write code, another review it, and a third deploy it — you're doing it by hand, terminal by terminal.

### The solution

AgentOps Desktop gives you a single control surface for your entire agent fleet. It's an Electron desktop app that connects to any CLI agent through a unified adapter system. You define goals, break them into tasks with dependencies, assign them to agents, and let the DAG-based orchestrator run them in parallel.

While agents work, you monitor everything from one dashboard: live stdout/stderr logs, agent status, task progress, cost tracking, and health alerts. When something needs attention, you get alerted. When something finishes, you see the results.

### Core capabilities

**Agent management.** Add, configure, and manage agent connections. Health checks verify agent availability on launch and on demand. The agent lifecycle engine handles spawn, monitor, pause, resume, and kill.

**Task orchestration.** The DAG-based orchestrator resolves dependency chains and runs independent tasks in parallel across multiple agents. Task handoff lets agents pass context to each other mid-workflow.

**Squad coordination.** Group agents into squads for coordinated workflows. Assign tasks to squads and let the system distribute work.

**Cost control.** Set budget limits per agent and per task. The cost guard tracks spending in real-time and prevents overruns. Get alerts when approaching limits.

**Auto-scheduling.** Schedule recurring tasks with cron expressions. The scheduling engine handles timing, retries, and status reporting.

**Plugin system.** The adapter registry lets you connect any CLI agent. The generic CLI adapter works out of the box for most agents. Build custom adapters for specialized integrations.

**Skill reuse.** Define reusable capabilities as skills. Share them across tasks and agents. Avoid duplication and maintain consistency across workflows.

**Full API.** Every operation is available via both Electron IPC and a Hono-based HTTP REST API. Build custom integrations, automate workflows with scripts, or connect external tools.

**Governance.** Role-based access control (admin/operator/viewer), approval gates, cost guards, and audit trails. Keep multi-agent workflows under control, especially in team environments.

### Architecture

AgentOps Desktop is built with:

- **Electron 41** for the desktop shell
- **React 19** for the renderer UI
- **SQLite** (better-sqlite3) with WAL mode for local persistence
- **Hono** for the HTTP REST API
- **Vitest** and **Playwright** for testing

All data stays on your machine. There's no cloud dependency, no account creation, no telemetry. The app runs entirely locally.

### What's next

v0.1.0 delivers the core platform. Planned for future releases:

- **Visual workflow builder** — Drag-and-drop agent-to-agent handoff definitions
- **Workflow templates** — Pre-built patterns for common workflows (code review, deploy, research)
- **Template marketplace** — Community-shared agent configs and workflow presets
- **Light theme** — Light mode support for the design system
- **Windows and Linux builds** — Cross-platform release artifacts

### Get involved

- **Try it:** Clone the repo and run `npm install && npm start`, or download the DMG from the releases page.
- **Report issues:** [GitHub Issues](https://github.com/EmtCcc/AgentOpsDesktop/issues)
- **Contribute:** See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.
- **Security:** See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

*AgentOps Desktop is open to contributions. If you're building multi-agent workflows, we'd love to hear what works and what doesn't.*
