# AgentOps Desktop — Roadmap

> Last updated: 2026-05-28
> Current phase: **M1 — Foundation**

## Overview

AgentOps Desktop is a local-first Electron app that gives developers a single control surface for managing multiple AI coding agents. The roadmap is organized into 5 milestones aligned with the product vision.

---

## M1: Foundation (Sprint 1-2)

**Goal:** Establish a working desktop shell with agent registry and real-time status feed.

**Exit criteria:** App launches, user can add/remove agents, see agent status in real-time, data persists across restarts.

| Deliverable | Description |
|-------------|-------------|
| Electron shell | Cross-platform desktop app with sidebar navigation, header, status bar |
| Agent registry | Add, edit, delete agent configs (name, executable path, working directory, type) |
| Agent health check | Probe agent executable availability on demand and on app launch |
| Real-time status dashboard | Agent status grid: idle / running / error / offline with live updates |
| Local persistence | SQLite (WAL mode) for agent configs and status history |
| IPC contract | Type-safe request/response and push channels between main and renderer |
| CI/CD pipeline | Lint, test, build on every PR; branch protection enabled |

**Key risks:** Electron security posture (F-003), subprocess execution safety (F-004).

---

## M2: Observability (Sprint 3-4)

**Goal:** Surface agent activity, task flows, and health metrics in a unified timeline.

**Exit criteria:** User can see what each agent did, filter/search logs, get alerted on failures, export data.

| Deliverable | Description |
|-------------|-------------|
| Task timeline | Chronological view of agent actions, tool calls, and outcomes per goal |
| Activity log | Per-agent log with stream filtering (stdout/stderr/system) and search |
| Alerting | Configurable thresholds for agent failure, stall, and timeout |
| Log export | Export task logs as JSON or CSV for external analysis |

---

## M3: Control Plane (Sprint 5-6)

**Goal:** Enable direct operator actions — pause, resume, reassign, and configure agents from the UI.

**Exit criteria:** User can control running agents, reassign tasks, edit agent configs live, enforce access control.

| Deliverable | Description |
|-------------|-------------|
| Agent control actions | Pause, resume, kill, restart running agents |
| Task reassignment | Move tasks between agents without losing context |
| Agent config editor | Edit prompts, tools, permissions, env vars per agent |
| RBAC | Role-based access control for multi-operator environments |

---

## M4: Orchestration (Sprint 7-8)

**Goal:** Support multi-agent workflows with dependency graphs, handoffs, and shared context.

**Exit criteria:** User can build visual workflows, agents share context, dependency chains resolve correctly.

| Deliverable | Description |
|-------------|-------------|
| Visual workflow builder | Drag-and-drop agent-to-agent handoff definitions |
| Shared context store | Agents read/write to a common workspace |
| Dependency graph | Visualize which agents block which, with resolution tracking |
| Workflow templates | Pre-built patterns: code review, deploy, research |

---

## M5: Ecosystem (Sprint 9-10)

**Goal:** Open the platform — plugin system, community templates, and integration APIs.

**Exit criteria:** Third parties can build plugins, integrations connect to CI/CD and ticketing, community can share templates.

| Deliverable | Description |
|-------------|-------------|
| Plugin SDK | Custom panels, data sources, and actions |
| Integration API | Connect to external CI/CD, monitoring, and ticketing systems |
| Template marketplace | Community-shared agent configs and workflow presets |
| Public docs site | Tutorials, API reference, contribution guide |

---

## Phase Map to MVP Scope

The MVP (defined in `docs/MVP-SCOPE.md`) spans M1 through partial M3:

- **M1** delivers: Agent Runtime Connection + basic UI framework
- **M2** delivers: Real-time Monitoring and Logs
- **M3 (partial)** delivers: Task Board with Assignment + result aggregation

MVP is complete when a user can: configure agents -> create goals/tasks -> assign and execute -> monitor logs -> confirm delivery.

---

## Current Status

- **Active milestone:** M1 — Foundation
- **Blockers:** Design assets pending (CMPAA-27)
- **Code state:** Day 0 scaffolding — Electron main process, IPC router, renderer HTML/CSS, empty test dirs
