# AgentOps Desktop — Roadmap

> Last updated: 2026-05-29
> Current phase: **M4 — Orchestration** (features from M5 also delivered)

## Overview

AgentOps Desktop is a local-first Electron app that gives developers a single control surface for managing multiple AI coding agents. The roadmap is organized into 5 milestones aligned with the product vision.

## M1: Foundation ✅

**Goal:** Establish a working desktop shell with agent registry and real-time status feed.

**Status:** Complete. All deliverables shipped in v0.1.0.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Electron shell | ✅ | Cross-platform desktop app with sidebar navigation |
| Agent registry | ✅ | Full CRUD with configuration management |
| Agent health check | ✅ | Probe on demand and on app launch |
| Real-time status dashboard | ✅ | Agent status grid with live updates |
| Local persistence | ✅ | SQLite (WAL mode) with migration system |
| IPC contract | ✅ | 16 controllers with typed channels |
| CI/CD pipeline | ✅ | Lint, test, build, deploy workflows |

---

## M2: Observability ✅

**Goal:** Surface agent activity, task flows, and health metrics in a unified timeline.

**Status:** Complete. All deliverables shipped in v0.1.0.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Task timeline | ✅ | Chronological view of agent actions per goal |
| Activity log | ✅ | Per-agent log with filtering and search |
| Alerting | ✅ | Configurable thresholds for failure, stall, timeout |
| Log export | ✅ | Structured JSONL logging with query support |

---

## M3: Control Plane ✅

**Goal:** Enable direct operator actions — pause, resume, reassign, and configure agents from the UI.

**Status:** Complete. All deliverables shipped in v0.1.0.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Agent control actions | ✅ | Pause, resume, kill, restart via agent engine |
| Task reassignment | ✅ | Task handoff between agents |
| Agent config editor | ✅ | Edit prompts, tools, permissions per agent |
| RBAC | ✅ | Role-based access control (admin/operator/viewer) |

---

## M4: Orchestration ✅

**Goal:** Support multi-agent workflows with dependency graphs, handoffs, and shared context.

**Status:** Complete. All deliverables shipped in v0.1.0.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Visual workflow builder | ⏳ | Planned for post-v0.1 UI enhancement |
| Shared context store | ✅ | Workspace manager for agent collaboration |
| Dependency graph | ✅ | DAG-based orchestrator with resolution tracking |
| Workflow templates | ⏳ | Planned — skill system provides foundation |

---

## M5: Ecosystem (Partial)

**Goal:** Open the platform — plugin system, community templates, and integration APIs.

**Status:** Core infrastructure delivered. Community features planned for v0.2.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Plugin SDK | ✅ | Adapter registry with custom adapter framework |
| Integration API | ✅ | HTTP REST API (Hono) for external integrations |
| Template marketplace | ⏳ | Planned for v0.2 |
| Public docs site | ✅ | VitePress site built and ready for deployment |

---

## Phase Map to MVP Scope

The MVP (defined in `docs/MVP-SCOPE.md`) spans M1 through partial M3:

- **M1** delivers: Agent Runtime Connection + basic UI framework ✅
- **M2** delivers: Real-time Monitoring and Logs ✅
- **M3 (partial)** delivers: Task Board with Assignment + result aggregation ✅

**MVP is complete.** A user can: configure agents → create goals/tasks → assign and execute → monitor logs → confirm delivery.

---

## Next Steps (v0.2)

| Priority | Deliverable | Description |
|----------|-------------|-------------|
| High | Visual workflow builder | Drag-and-drop agent-to-agent handoff definitions |
| High | Workflow templates | Pre-built patterns: code review, deploy, research |
| High | Template marketplace | Community-shared agent configs and workflow presets |
| Medium | Light theme | Light mode support for the design system |
| Medium | Windows/Linux builds | Cross-platform release artifacts |
| Low | Sound effects | UI audio cues (opt-in, < 300ms) |

---

## Current Status

- **Active milestone:** M4 — Orchestration (mostly complete)
- **Code state:** v0.1.0 ready for release. Core platform, orchestration, and plugin system delivered.
- **Next focus:** Visual workflow builder, community features, cross-platform builds
