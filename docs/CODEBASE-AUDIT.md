# Codebase Audit — AgentOpsDesktop

**Date**: 2026-05-28
**Auditor**: Engineer
**Version**: 0.1.0
**Previous audit**: Day 0 (empty repo)

## Summary

AgentOps Desktop is an **Electron 42 desktop app** for multi-agent orchestration. The project has a fully scaffolded main process with IPC handlers, structured logging, health monitoring, and a production-quality CSS design system — but **no React renderer, no persistent storage, and zero unit tests**. The codebase is split between a working inline implementation in `index.js` and an unwired structured router/controller layer under `src/main/ipc/`.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌──────────────┐  IPC  ┌────────────────────────┐  │
│  │   Renderer    │◄─────►│    Main Process        │  │
│  │  (static HTML │  ^    │  index.js (entry)      │  │
│  │   + CSS)      │  │    │  ├─ IPC handlers       │  │
│  │               │  │    │  ├─ In-memory stores   │  │
│  │  preload.js   │  │    │  ├─ logger.js          │  │
│  │  (contextBridge)  │    │  ├─ monitor.js         │  │
│  └──────────────┘       │  └─ ipc/ (unused)       │  │
│                          │    ├─ router.js          │  │
│                          │    ├─ middleware/         │  │
│                          │    └─ controllers/       │  │
│                          └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. Renderer calls `window.agentOps.<namespace>.<method>()` (exposed via `preload.js`)
2. Preload forwards via `ipcRenderer.invoke(channel, args)`
3. Main process handles via `ipcMain.handle(channel, handler)` in `index.js`
4. In-memory `Map` stores for agents, goals, tasks; array for logs
5. `logs:new` pushed to renderer via `webContents.send()` (the only push channel)

### IPC Channels (Active)

| Channel | Method | Description |
|---------|--------|-------------|
| `agents:list` | invoke | List all agents |
| `agents:create` | invoke | Create agent |
| `agents:update` | invoke | Update agent by id |
| `agents:delete` | invoke | Delete agent by id |
| `agents:health-check` | invoke | Randomized health check (10% fail rate) |
| `goals:list` | invoke | List all goals |
| `goals:create` | invoke | Create goal |
| `goals:update` | invoke | Update goal by id |
| `goals:delete` | invoke | Delete goal by id |
| `tasks:list` | invoke | List all tasks |
| `tasks:create` | invoke | Create task (links to goal if goalId provided) |
| `tasks:update` | invoke | Update task by id |
| `tasks:delete` | invoke | Delete task by id |
| `logs:list` | invoke | List logs with optional agentId filter, default limit 200 |
| `logs:append` | invoke | Append log entry, broadcasts `logs:new` to renderer |
| `stats:summary` | invoke | Aggregate agent/task counts by status |
| `monitor:health` | invoke | System health (memory, CPU, IPC metrics, alerts) |

### Unwired Module: `src/main/ipc/`

The router + controller pattern exists but is **not imported** by `index.js`. These modules duplicate the inline handlers with added validation:

| Module | Purpose |
|--------|---------|
| `ipc/router.js` | `IpcRouter` class — registers channels with schema validation and error wrapping |
| `ipc/middleware/validate.js` | Type, required, enum, minLength/maxLength, pattern, custom validators |
| `ipc/controllers/agent.controller.js` | Agent CRUD + healthCheck with validation schemas |
| `ipc/controllers/goal.controller.js` | Goal CRUD with validation schemas |
| `ipc/controllers/task.controller.js` | Task CRUD with validation schemas (imports goal.controller for linking) |
| `ipc/controllers/system.controller.js` | healthCheck + listRoutes (depends on router instance) |

**Key issue**: `task.controller.js` line 9 does `require('./goal.controller')` and calls `goals.get()` / `goals.set()` directly on the controller's exported `store` — this is a **module-level coupling** that only works because `goal.controller.js` exports its internal `Map` as `goalController.store`.

## Tech Stack

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Runtime | Electron | ^42.3.0 | Installed |
| Build | electron-builder | ^25.1.8 | Installed |
| Auto-update | electron-updater | ^6.3.9 | Installed |
| Persistence | better-sqlite3 | ^11.9.1 | Installed but **unused** |
| UUID | uuid | ^11.1.0 | Installed but **unused** |
| Unit tests | Vitest | ^2.1.8 | Configured, no test files |
| E2E tests | Playwright | ^1.52.0 | 2 spec files against static harness |
| Linting | ESLint | ^9.14.0 | Flat config, recommended rules |
| Language | JavaScript (CJS) | — | Main process |
| Language | TypeScript | — | Tests and routes.ts only |
| UI framework | Static HTML + CSS | — | React planned, not installed |
| State management | In-memory Maps | — | Zustand planned, not installed |
| Terminal | — | — | node-pty / xterm planned, not installed |

## File Inventory

| Path | Lines | Purpose |
|------|-------|---------|
| `src/main/index.js` | 210 | Entry point: window creation, all IPC handlers, in-memory stores |
| `src/main/preload.js` | 46 | contextBridge API surface |
| `src/main/logger.js` | 57 | Structured JSON logger (daily .jsonl files) |
| `src/main/monitor.js` | 171 | IPC metrics, renderer crash tracking, health alerts, periodic loop |
| `src/main/ipc/router.js` | 73 | IpcRouter class (unused) |
| `src/main/ipc/middleware/validate.js` | 95 | Validation framework (unused) |
| `src/main/ipc/controllers/agent.controller.js` | 64 | Agent controller (unused) |
| `src/main/ipc/controllers/goal.controller.js` | 50 | Goal controller (unused) |
| `src/main/ipc/controllers/task.controller.js` | 63 | Task controller (unused) |
| `src/main/ipc/controllers/system.controller.js` | 40 | System controller (unused) |
| `src/renderer/index.html` | 91 | Static HTML shell with inline CSS |
| `src/renderer/styles/tokens.css` | 90 | Design tokens (colors, typography, spacing) |
| `src/renderer/styles/base.css` | 111 | CSS reset and global styles |
| `src/renderer/styles/layout.css` | 226 | App shell grid layout |
| `src/renderer/styles/components.css` | 300 | Buttons, cards, badges, tables, empty states |
| `src/renderer/styles/pages.css` | 274 | Dashboard, agent list, task board, settings |
| `src/renderer/routes.ts` | 125 | Route definitions (TypeScript, not consumed) |
| `src/renderer/redirects.json` | — | URL redirect map |
| `tests/e2e/cross-browser.spec.ts` | 174 | 10 tests: CSS vars, layout, typography, components, a11y |
| `tests/e2e/performance.spec.ts` | 170 | 8 tests: LCP, CLS, bundle size, memory, 60fps |
| `tests/e2e/design-system-harness.html` | — | Static test harness page |
| `tests/e2e/fixtures/app.fixture.ts` | — | Playwright fixture |

## Tech Debt Hotspots

### Critical

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| TD-1 | **Duplicate IPC implementations** | `index.js` vs `src/main/ipc/` | Two code paths for the same logic. The router/controllers are dead code until wired in. Any bug fix must be applied in both places or one drifts. |
| TD-2 | **No persistence layer** | `index.js:85-88` | All data in `Map`/array — lost on restart. `better-sqlite3` is installed but unused. |
| TD-3 | **No React renderer** | `src/renderer/` | Static HTML shell. All docs describe React + Zustand architecture. The design system CSS is ready but has no components consuming it. |
| TD-4 | **Randomized health check** | `index.js:118` | `Math.random() > 0.1` for agent health. Placeholder that will produce false alarms in real usage. |
| TD-5 | **Logs array unbounded growth** | `index.js:184` | `splice(0, logs.length - 10000)` caps at 10K but runs on every append — O(n) per log write. |

### Moderate

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| TD-6 | **Routes.ts not consumed** | `src/renderer/routes.ts` | TypeScript route definitions exist but no router is installed. Dead code. |
| TD-7 | **No TypeScript in main process** | `src/main/` | All main process code is CJS JavaScript. No type checking. |
| TD-8 | **Goal controller store export** | `goal.controller.js:47` | `goalController.store = goals` — exposes internal Map. `task.controller.js` imports and mutates it directly. |
| TD-9 | **logger.js silent failures** | `logger.js:22` | `catch {}` on mkdirSync — if log dir creation fails, all logging silently fails. |
| TD-10 | **monitor.js no external alerting** | `monitor.js:106-117` | Alerts log but don't notify anyone. No webhook, no UI toast, no event emission. |

### Minor

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| TD-11 | **CI actions not SHA-pinned** | `ci.yml` | Uses `@v4` tags instead of commit SHAs — supply chain risk. |
| TD-12 | **No `shared/` module** | `src/shared/.gitkeep` | Placeholder exists but no shared types/utilities between main and renderer. |
| TD-13 | **Assets empty** | `assets/.gitkeep` | No app icon — electron-builder build will fail without `assets/icon.icns`. |

## Test Coverage

| Category | Tests | Coverage | Notes |
|----------|-------|----------|-------|
| Unit tests | 0 | 0% | Vitest configured, no `.test.js` files exist |
| E2E: cross-browser | 10 | N/A | Tests run against static HTML harness, not the Electron app |
| E2E: performance | 8 | N/A | Same — static harness only |
| E2E: Electron app | 0 | 0% | No Playwright tests launch the actual Electron process |
| Integration tests | 0 | 0% | No IPC handler tests |

**Critical gap**: Zero test coverage on all main process code (IPC handlers, logger, monitor). The E2E tests validate CSS design tokens on a static HTML page, not the running application.

## Security Posture

Per existing `SECURITY-REVIEW.md` and `THREAT-MODEL.md`, the identified findings are:

| Finding | Severity | Status |
|---------|----------|--------|
| Electron `contextIsolation: true` + `nodeIntegration: false` | — | Correctly configured |
| No CSP in `index.html` | High | **Mitigated**: `index.html:6` has CSP meta tag |
| No input sanitization on IPC handlers | High | Open — user-supplied data flows directly into stores |
| CI actions not SHA-pinned | Medium | Open |
| No dependency audit (npm audit / Dependabot) | Medium | Open |
| Subprocess execution risk (agent:spawn) | Critical | Planned but not implemented yet |
| No encryption at rest | Medium | Open — in-memory only, moot until SQLite is wired |

## Documentation Inventory

19 docs in `docs/` + 3 root-level docs. All written pre-implementation. Key gaps:

- `ARCHITECTURE.md` describes SQLite schema with 4 tables — **code uses in-memory Maps**
- `API.md` describes `agent:spawn`, `agent:output`, `governance:approve` — **none implemented**
- `DESIGN-SYSTEM.md` + `DESIGN-SPEC.md` — **CSS is implemented, React components are not**
- `TECH-STACK.md` lists React, Zustand, node-pty, better-sqlite3, xterm — **none installed except better-sqlite3**

## Recommendations

### Immediate (unblocks Phase 1)

1. **Wire in the IPC router** — Replace inline handlers in `index.js` with `IpcRouter` + controllers. Eliminates TD-1, adds validation.
2. **Add unit tests for IPC handlers** — Vitest is ready. Test each controller method. Target: agent CRUD, task-goal linking, log append/broadcast.
3. **Create `assets/icon.icns`** — Build will fail without it (TD-13).
4. **Wire better-sqlite3** — Replace in-memory Maps with SQLite. Eliminates TD-2.

### Short-term (Phase 2)

5. **Install React + Zustand** — Wire up the renderer with the design system CSS that's already built.
6. **Add Electron E2E tests** — Use Playwright's Electron support to test the actual app, not just a static harness.
7. **Add `npm audit` to CI** — Dependabot or manual audit step.

### Medium-term

8. **TypeScript migration for main process** — Eliminates TD-7, catches type errors at build time.
9. **External alerting in monitor** — Webhook or IPC push to renderer for real-time alerts (TD-10).

## Conclusion

The project has strong foundations — well-structured CSS design system, comprehensive monitoring/logging, clean Electron security defaults, and thorough pre-implementation documentation. The core debt is the **gap between documentation and implementation**: docs describe a React + SQLite + node-pty app, but the code is static HTML + in-memory Maps. The critical path is: wire the existing router/controllers → add SQLite persistence → install React → build actual features.
