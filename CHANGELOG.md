# Changelog

All notable changes to AgentOps Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-28

### Added
- Electron desktop app with SQLite database (better-sqlite3)
- Main process IPC layer with RBAC auth and middleware
- Renderer UI shell (vanilla JS SPA)
- Agent, task, goal CRUD with repository pattern
- Agent runtime (CLI process management) and task orchestrator (DAG workflows)
- HTTP API (Hono) alongside IPC
- electron-builder config: macOS DMG (arm64/x64), Windows NSIS, Linux AppImage
- CI workflows: lint, test, e2e, build (macOS/Windows/Linux matrix)
- Release workflow with Apple code signing, notarization, and multi-platform publish
- Smoke test script for release validation
- API documentation generation
- Comprehensive docs suite (architecture, design system, threat model, security review)
- Playwright e2e test suite
- Auto-updater (electron-updater + GitHub releases)

### Changed
- Migrated from single `db.js` to modular repository pattern (`src/main/db/repositories/`)
- Upgraded better-sqlite3 to ^12.10.0 for Electron 41 compatibility
