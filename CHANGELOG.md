# Changelog

All notable changes to AgentOps Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Test: verify git commit gate via CHANGELOG.md update (CMPAAA-470, 2026-05-29)

## [0.1.0] - 2026-05-28

### Added

#### Core Platform
- Electron 41 desktop app with React 19 renderer
- SQLite database (better-sqlite3) with WAL mode, migration system (v10), and repository pattern
- Main process IPC layer with 16 controllers, RBAC auth, and validation middleware
- Hono-based HTTP REST API (13 route files) alongside Electron IPC
- Structured JSONL logging system
- JSON file-based persistence store (`~/.agentops/`)

#### Agent Management
- Agent registry with CRUD operations and configuration management
- Agent lifecycle engine for spawn, monitor, and control
- Agent runtime for CLI process management via child_process
- Agent health checks (probe on demand and on launch)

#### Task Orchestration
- DAG-based multi-agent parallel task orchestrator
- Task output and handoff IPC channels
- Goal decomposition with task assignment
- Dependency graph resolution and tracking

#### Team Coordination
- Squad management for grouping agents into coordinated teams
- Shared workspace manager for agent collaboration
- Message bus for inter-agent communication with persistence
- Skill reuse system for sharing agent capabilities

#### Operations
- Cost control and budget management system with spending limits
- Auto-scheduling engine with cron expression parser
- Health monitoring with metrics, alerting, and crash tracking
- Role-based access control (admin/operator/viewer)

#### Plugin System
- Custom agent adapter registry
- Generic CLI adapter for connecting any command-line agent
- Adapter development framework

#### UI
- React pages: Agents, Tasks, Squads, Logs, Settings
- Dark-mode-first design system with CSS custom properties
- Responsive sidebar navigation

#### Infrastructure
- electron-builder config: macOS DMG (arm64/x64), Windows NSIS, Linux AppImage
- CI workflows: lint, test, e2e, build (macOS/Windows/Linux matrix)
- Release workflow with Apple code signing, notarization, and multi-platform publish
- Auto-updater via electron-updater + GitHub Releases
- Smoke test script for release validation
- Playwright E2E test suite

#### Documentation
- VitePress documentation site with guide, architecture, API, and extension docs
- Architecture overview, API reference, design system, threat model
- Security review, accessibility audit, UX audit
- Competitive analysis (phases 1-3)
- Brand identity guidelines
- Contributing guide, security policy, release process

### Changed
- Migrated from single `db.js` to modular repository pattern (`src/main/db/repositories/`)
- Upgraded better-sqlite3 to ^12.10.0 for Electron 41 compatibility
- Migrated renderer from vanilla JS to React SPA
