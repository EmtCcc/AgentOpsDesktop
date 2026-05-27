# Architecture

## Overview

AgentOpsDesktop is a cross-platform Electron desktop application that orchestrates multiple AI coding agents. It acts as a control plane: users create goals and tasks, assign them to agents, monitor execution, and govern delivery through approvals and audit trails.

## System Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Desktop Shell** | Window management, native menus, system tray, notifications | Electron |
| **Renderer (UI)** | Task board, agent dashboard, log viewer, workflow editor | React + TypeScript |
| **Main Process** | IPC bridge, process lifecycle, file system access, tray | Electron main |
| **Agent Runtime** | Spawn, manage, and communicate with CLI agents | Node.js child_process / PTY |
| **Paperclip Client** | Goal/task CRUD, governance workflows, audit logging | REST API client |
| **Multica Adapter** | Agent lifecycle, skill registry, runtime management | Plugin adapter |
| **Terminal Emulator** | Background terminals per agent, log streaming | xterm.js |
| **Workflow Engine** | Template parsing, step sequencing, conditional branching | State machine |

## Data Flow

```
User (UI)
   │
   ▼
┌──────────────┐     IPC      ┌──────────────┐
│   Renderer   │ ◄──────────► │ Main Process │
│  (React UI)  │              │              │
└──────────────┘              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌──────────┐    ┌──────────────┐   ┌───────────┐
            │  Agent   │    │  Paperclip   │   │ Workflow  │
            │ Runtime  │    │   Client     │   │  Engine   │
            └────┬─────┘    └──────┬───────┘   └───────────┘
                 │                 │
                 ▼                 ▼
          ┌──────────┐    ┌──────────────┐
          │ CLI      │    │  Paperclip   │
          │ Agents   │    │   Server     │
          │ (Claude, │    │  (governance)│
          │  Codex,  │    └──────────────┘
          │  Gemini) │
          └──────────┘
```

### Primary Flows

**Task Assignment**
1. User creates a goal on the task board
2. Goal is decomposed into tasks
3. User assigns tasks to agents (or auto-assigns)
4. Agent Runtime spawns the appropriate CLI agent
5. Agent executes; logs stream to the terminal panel
6. Results are captured and reported back to the task board

**Governance**
1. Paperclip Client syncs goals and tasks with the control plane
2. Approval gates pause execution at defined checkpoints
3. User reviews output and approves / rejects / rolls back
4. All actions are recorded in the audit log

**Workflow Execution**
1. User selects or creates a workflow template
2. Workflow Engine parses steps and dependencies
3. Steps are dispatched to agents in order (or parallel where allowed)
4. Conditional branching handles success/failure paths
5. Final output is aggregated and presented

## API Boundaries

### External APIs

| API | Purpose | Auth |
|-----|---------|------|
| Paperclip Control Plane | Goal/task CRUD, governance, audit | Token-based |
| Agent CLI Protocols | stdin/stdout communication with agents | Process-level |

### Internal APIs (IPC)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `agent:spawn` | Renderer → Main | Start an agent for a task |
| `agent:output` | Main → Renderer | Stream agent stdout/stderr |
| `agent:status` | Main → Renderer | Agent lifecycle events |
| `task:update` | Bidirectional | Task state changes |
| `governance:approve` | Renderer → Main | Approval gate responses |

## Deployment Model

- **Build**: Electron builder (electron-builder) produces platform-specific installers
- **Test**: Vitest for unit/integration, Playwright for E2E
- **Deploy**: Users download platform installers from releases; auto-update via electron-updater

## Key Decisions

| Decision | Context | Rationale |
|----------|---------|-----------|
| Electron | Need cross-platform desktop with native capabilities | Mature ecosystem, shared web skills, native IPC |
| React | Complex interactive UI (task board, log viewer) | Large ecosystem, team familiarity |
| PTY-based agent spawning | Agents expect terminal-like environments | Preserves full CLI agent behavior |
| Paperclip as governance layer | Need goals, approvals, audit without building from scratch | Existing control plane API |
| Local-first | Users should own their data, work offline | Privacy, latency, no cloud dependency for core flows |
