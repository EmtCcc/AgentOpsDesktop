# Technology Stack — AgentOps Desktop

## Summary

AgentOps Desktop is a cross-platform Electron application for orchestrating AI coding agents. The stack prioritizes **local-first operation**, **developer familiarity**, and **rapid iteration** — shipping a working control surface without premature infrastructure.

---

## Core Runtime

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Desktop Shell** | Electron | ^42.3.0 | Mature cross-platform desktop framework; native IPC, system tray, menus. Chromium renderer ensures consistent UI. |
| **Main Process** | Node.js (CommonJS) | 20 (CI) | Electron's main process runtime; LTS track. CommonJS for current simplicity. |
| **Renderer** | React + TypeScript | TBD | Planned per architecture doc. Complex interactive UI (task board, log viewer) benefits from component model. Not yet installed. |

### Why Electron over Tauri?

Tauri was considered (see VISION.md) but Electron was selected for:
- **Mature ecosystem**: electron-builder, electron-updater, Playwright support
- **Native IPC**: robust main↔renderer communication without Rust bridge complexity
- **Team familiarity**: web-native developers can ship without Rust knowledge
- **PTY support**: Node.js `node-pty` for spawning CLI agents in terminal-like environments

Tradeoff: larger binary size (~80MB vs ~5MB for Tauri). Acceptable for a desktop dev tool.

---

## Language & Type System

| Aspect | Current | Planned |
|--------|---------|---------|
| Main process | JavaScript (CommonJS) | TypeScript |
| Renderer | Not yet scaffolded | TypeScript + React |
| Shared types | None | TypeScript interfaces for IPC contracts |
| Config files | JavaScript | TypeScript (e.g., `playwright.config.ts`) |

**Decision**: Start in JS for velocity, migrate to TypeScript incrementally. The `routes.ts` file already demonstrates the target pattern. IPC type contracts defined in `docs/API.md` will drive the TypeScript migration.

---

## Frontend (Renderer)

| Technology | Purpose | Status |
|-----------|---------|--------|
| **React** | Component model for complex UI | Planned — not yet installed |
| **TypeScript** | Type safety for IPC contracts and state | Planned |
| **React Router** | Client-side routing | Planned — route map defined in `src/renderer/routes.ts` |
| **Lucide Icons** | Icon library (stroke-based) | Planned per design system |
| **Inter + JetBrains Mono** | Typography | Specified in design system |
| **CSS Custom Properties** | Design tokens | Specified in design system |

### UI Architecture

- **Dark theme default** (`#0D1117` background) — cockpit instrument panel aesthetic
- **Sidebar navigation** (240px, collapsible)
- **CSS Grid** for dashboard layouts
- **No component library** — custom components for information density

---

## Agent Runtime

| Technology | Purpose |
|-----------|---------|
| **Node.js `child_process`** | Spawn and manage CLI agent processes |
| **`node-pty`** (planned) | PTY-based agent spawning for full terminal emulation |
| **IPC bridge** | Electron `ipcMain.handle` / `ipcRenderer.invoke` for renderer↔main communication |

### Supported Agents

| Agent | Protocol | Status |
|-------|----------|--------|
| Claude Code | stdin/stdout JSON lines | Planned |
| Codex CLI | stdin/stdout | Planned |
| Gemini CLI | stdin/stdout | Planned |
| OpenCode | stdin/stdout | Planned |
| Custom | Configurable command + args | Planned |

---

## Data & State

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **In-process state** | JavaScript `Map` objects | Current implementation — zero-dependency, fast iteration |
| **Local persistence** | SQLite (planned) | Local-first principle; no external database dependency |
| **External state** | Paperclip REST API | Goal/task CRUD, governance, audit trails |

### Current Data Stores (Main Process)

- `agents` — Map of agent configurations and status
- `goals` — Map of goals with associated task IDs
- `tasks` — Map of tasks with status and goal associations
- `logs` — Array of log entries (capped at 10,000)

---

## Testing

| Tool | Purpose | Scope |
|------|---------|-------|
| **Jest** | Unit and integration tests | `npm test` |
| **Playwright** | E2E browser testing | Renderer UI across Chromium, Firefox, WebKit, mobile |
| **ESLint** | Code quality | `npm run lint` |

### Playwright Configuration

- Tests renderer HTML/CSS across 5 browser engines (desktop + mobile)
- Electron-specific E2E via debug port connection
- CI: 2 retries, single worker, HTML report
- Traces, screenshots, and video captured on failure

---

## Build & CI/CD

| Tool | Purpose |
|------|---------|
| **GitHub Actions** | CI pipeline (lint + test on push/PR to main) |
| **Node.js 20** | CI runtime |
| **electron-builder** (planned) | Platform-specific installers (macOS, Windows, Linux) |
| **electron-updater** (planned) | Auto-update for installed applications |

### CI Pipeline

```yaml
lint → test (parallel, ubuntu-latest, Node 20)
```

---

## External Integrations

| Service | Protocol | Auth | Purpose |
|---------|----------|------|---------|
| **Paperclip Control Plane** | REST API | Bearer token (OS keychain) | Goal/task CRUD, governance workflows, audit logging |

---

## Design System Dependencies

| Dependency | Purpose |
|-----------|---------|
| **Inter** (Google Fonts) | UI typography |
| **JetBrains Mono** | Code/logs/terminal typography |
| **Lucide Icons** | Consistent stroke-based iconography |
| **CSS Custom Properties** | Design tokens (colors, spacing, typography, motion) |

---

## Decision Log

| Decision | Context | Rationale |
|----------|---------|-----------|
| Electron over Tauri | Cross-platform desktop shell | Mature ecosystem, native IPC, no Rust requirement |
| CommonJS over ESM | Main process module system | Electron compatibility; migrate to ESM later |
| In-memory state over SQLite (MVP) | Data persistence | Zero-dependency velocity; SQLite for persistence phase |
| React over vanilla JS | Renderer UI framework | Component model for complex interactive UI |
| Dark theme only (v1) | Design direction | Developer tool aesthetic; light theme deferred |
| No component library | UI implementation | Full control over information density and layout |
| Paperclip as governance layer | Goal/task management | Existing control plane; avoid building from scratch |
| Local-first architecture | Data ownership | Privacy, latency, no cloud dependency for core flows |

---

## Dependencies Summary

### Production (Planned)

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `node-pty` | PTY-based agent spawning |
| `better-sqlite3` | Local data persistence |
| `xterm` / `@xterm/xterm` | Terminal emulator for agent output |

### Development

| Package | Purpose |
|---------|---------|
| `electron` ^42.3.0 | Desktop shell |
| `typescript` | Type system |
| `@playwright/test` | E2E testing |
| `jest` | Unit testing |
| `eslint` | Linting |
| `electron-builder` | Build/packaging |

---

*Last updated: 2026-05-28. Review when adding new major dependencies or changing architectural layers.*
