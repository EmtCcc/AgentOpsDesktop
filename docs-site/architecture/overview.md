# Architecture Overview

> **This document describes the target architecture for the MVP release.**
> The current implementation (v0.1, Foundation phase) uses plain JavaScript, in-memory stores, and a static HTML renderer.

## Design Principles

| Principle | Meaning |
|-----------|---------|
| **Local-first** | All data stored on the user's machine, no cloud dependency |
| **Real-time by default** | Logs and status changes push instantly, no polling |
| **Agent-agnostic** | Any CLI agent can be connected via configuration, no vendor lock-in |
| **MVP does minimal loop** | Goal → decompose → multi-agent execution → result aggregation → human confirmation |

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Desktop App                  │
│                                                         │
│  ┌───────────────────────┐   ┌────────────────────────┐ │
│  │     Renderer Process  │   │     Main Process       │ │
│  │                       │   │                        │ │
│  │  React + TypeScript   │   │  ┌──────────────────┐  │ │
│  │  ┌─────────────────┐  │   │  │   IPC Handlers   │  │ │
│  │  │  Zustand Stores  │  │   │  └────────┬─────────┘  │ │
│  │  └────────┬────────┘  │   │           │            │ │
│  │           │           │   │  ┌────────┴─────────┐  │ │
│  │  ┌────────┴────────┐  │   │  │  Agent Runtime   │  │ │
│  │  │  React Views    │  │   │  │  (child_process) │  │ │
│  │  │  - Agent Panel  │◄─┤IPC├─┤  ┌──────────────┐ │  │ │
│  │  │  - Task Board   │  │   │  │  │ Process Pool │ │  │ │
│  │  │  - Log Viewer   │  │   │  │  └──────────────┘ │  │ │
│  │  │  - Goal Board   │  │   │  └──────────────────┘  │ │
│  │  └─────────────────┘  │   │                        │ │
│  │                       │   │  ┌──────────────────┐  │ │
│  │  xterm.js (planned)   │   │  │   SQLite (WAL)   │  │ │
│  └───────────────────────┘   │  └──────────────────┘  │ │
│                              └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                    spawn / stdin+stdout
                              │
                    ┌─────────▼─────────┐
                    │   CLI Agents      │
                    │  ┌──────────────┐  │
                    │  │ Claude Code  │  │
                    │  │ Codex        │  │
                    │  │ Gemini CLI   │  │
                    │  │ OpenCode     │  │
                    │  │ Custom ...   │  │
                    │  └──────────────┘  │
                    └───────────────────┘
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Desktop Shell** | Electron 42 | Cross-platform, mature IPC, native menus |
| **Main Process** | Node.js (CommonJS) | Electron runtime; LTS track |
| **Renderer** | React + TypeScript (planned) | Complex interactive UI |
| **State Management** | Zustand (planned) | Lightweight, subscription-native |
| **Terminal** | xterm.js (planned) | Browser terminal emulation |
| **Process Management** | child_process / node-pty (planned) | Agent process spawning |
| **Database** | better-sqlite3 (planned) | Sync API, single-file, crash recovery |
| **Build** | electron-builder 25 | Platform installers, auto-update |
| **Testing** | Vitest + Playwright | Unit + E2E coverage |

## Data Model

SQLite database: `~/.agentops-desktop/data.db` (WAL mode)

### Entity Relationships

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  goals   │ 1───N │    tasks     │ N───1 │  agents  │
│          │       │              │       │          │
│ id (PK)  │       │ id (PK)      │       │ id (PK)  │
│ title    │       │ goal_id (FK) │       │ name     │
│ desc     │       │ agent_id(FK) │       │ exec_path│
│ status   │       │ title        │       │ work_dir │
│ created  │       │ description  │       │ type     │
│ updated  │       │ status       │       │ config   │
└──────────┘       │ output_summary│      │ status   │
                   │ started_at   │       │ created  │
                   │ completed_at │       │ updated  │
                   │ created_at   │       └──────────┘
                   │ updated_at   │
                   └──────┬───────┘
                          │ 1
                          │ N
                   ┌──────┴───────┐
                   │  task_logs   │
                   │              │
                   │ id (PK)      │
                   │ task_id (FK) │
                   │ stream       │
                   │ content      │
                   │ timestamp    │
                   └──────────────┘
```

## IPC Protocol

All IPC handlers go through `IpcRouter` with automatic validation and error handling. Returns are unified:

```typescript
// Success
{ ok: true, data: T }

// Failure
{ ok: false, error: { code: string, message: string, field?: string } }
```

Error codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `FORBIDDEN` (403), `INTERNAL_ERROR` (500).

## Agent Lifecycle

```
  Configure Agent     Health Check       Assign Task
       │                   │                  │
       ▼                   ▼                  ▼
   ┌────────┐         ┌─────────┐       ┌──────────┐
   │ idle   │────────►│ offline │       │ assigned │
   └────────┘  fail   └─────────┘       └────┬─────┘
       │                                      │
       │ pass                                 │ task:start
       ▼                                      ▼
   ┌────────┐                            ┌──────────┐
   │ idle   │◄───────────────────────────│ running  │
   └────────┘          exit              └────┬─────┘
                                              │
                                     ┌────────┼────────┐
                                     ▼        ▼        ▼
                                 ┌──────┐ ┌──────┐ ┌───────┐
                                 │ done │ │failed│ │blocked│
                                 └──────┘ └──────┘ └───────┘
```

## Security Boundaries

| Boundary | Measure |
|----------|---------|
| **Preload isolation** | contextBridge exposes minimal API; renderer cannot access Node.js |
| **Input validation** | IPC handlers validate all parameter types and lengths |
| **SQL injection** | better-sqlite3 parameterized queries; no string concatenation |
| **Path traversal** | executable_path and working_directory validated against allowed ranges |
| **Process isolation** | Agent processes run at current user privilege, no escalation |

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Electron main process | ✅ Implemented | Window creation, app lifecycle |
| IPC router + validation | ✅ Implemented | `IpcRouter` class + schema validation |
| Agent controller | ✅ Implemented | spawn/kill/status/list |
| Task controller | ✅ Implemented | CRUD + status updates (in-memory) |
| Governance controller | ✅ Implemented | approve/list/register (placeholder) |
| Monitoring module | ✅ Implemented | Health checks, metrics, alerts |
| Structured logging | ✅ Implemented | JSONL file output + console |
| Adapter registry | ✅ Implemented | Dynamic register/load/unload |
| SQLite data layer | ⏳ Planned | Currently uses in-memory Map |
| React renderer | ⏳ Planned | Currently static HTML |
| PTY process management | ⏳ Planned | Currently uses child_process |

## Deployment Model

```
Developer                   User
  │                           │
  ├─ npm run dev              │
  │  (Electron + DevTools)    │
  │                           │
  ├─ npm run build            │
  │  ├─ esbuild (main)        │
  │  └─ (renderer build)      │
  │                           │
  ├─ electron-builder         │
  │  ├─ .dmg (macOS)          ├─ Download & install
  │  ├─ .exe (Windows)        ├─ Launch app
  │  └─ .AppImage (Linux)     ├─ Configure agents
  │                           └─ Start working
  └─ GitHub Releases
     + electron-updater
        (auto-update)
```

**Data directories:**
- macOS: `~/Library/Application Support/agentops-desktop/`
- Windows: `%APPDATA%/agentops-desktop/`
- Linux: `~/.config/agentops-desktop/`
