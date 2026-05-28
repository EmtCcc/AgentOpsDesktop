# Phase 3 Roadmap — UI Migration / Differentiation / Ecosystem / Quality (v0.2 → v1.0)

> Last updated: 2026-05-29
> Based on: Phase 1 (market analysis) + Phase 2 (CLI/squad/communication) + Phase 3 (UI/differentiation/ecosystem/quality)
> Dependencies: Phase 2 issues (CMPAAA-317 ~ CMPAAA-333)

---

## Vision

AgentOps Desktop v1.0 = **"The only desktop-native multi-agent orchestrator with built-in governance, live terminal monitoring, and DAG-based workflow execution."**

---

## Release Milestones

### v0.2 — Foundation Hardening (Weeks 1-4)

**Theme**: Close critical infrastructure gaps before feature work.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-337 | Coverage reporting (c8/vitest) | P1 | S | Quality |
| CMPAAA-338 | Adapter test harness template | P1 | M | Quality |
| CMPAAA-339 | Skills directory creation + 3 example skills | P1 | S | Ecosystem |
| CMPAAA-340 | License selection (MIT recommended) | P1 | S | Ecosystem |
| CMPAAA-341 | SAST integration (CodeQL or Semgrep) | P2 | M | Quality |

**Exit criteria**: Coverage ≥ 50%, skills directory exists with examples, license decided, adapter tests runnable.

---

### v0.3 — UI Modernization (Weeks 5-12)

**Theme**: Migrate from vanilla JS monolith to React component architecture.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-342 | React + Vite scaffold with design system tokens | P0 | M | UI |
| CMPAAA-343 | Dashboard page (React): agent cards + live log stream + task kanban | P0 | L | UI |
| CMPAAA-344 | Agents page (React): CRUD + modal + status indicators | P0 | M | UI |
| CMPAAA-345 | Tasks page (React): kanban board + drag-drop | P0 | M | UI |
| CMPAAA-346 | Logs page (React): real-time filterable viewer | P1 | M | UI |
| CMPAAA-347 | Squads page (React): batch ops + member management | P1 | M | UI |
| CMPAAA-348 | Settings page (React): adapter config + budget management | P1 | M | UI |
| CMPAAA-349 | Activity timeline component | P1 | M | UI |
| CMPAAA-350 | Workflow page (React): DAG visual editor | P2 | L | UI |

**Exit criteria**: All pages migrated to React, `app.js` monolith eliminated, component tests for all pages.

---

### v0.4 — Differentiation Features (Weeks 13-18)

**Theme**: Build features no competitor has.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-351 | Token-level cost tracking (per-message input/output tokens) | P1 | M | Differentiation |
| CMPAAA-352 | Cost dashboard: per-agent, per-task, per-day token usage | P1 | M | Differentiation |
| CMPAAA-353 | Budget pause-on-overage (hard system cutoff, not just policy) | P1 | M | Differentiation |
| CMPAAA-354 | System tray integration (Electron Tray) | P1 | S | UI |
| CMPAAA-355 | OS notifications (agent completion, errors, budget alerts) | P2 | S | UI |
| CMPAAA-356 | MCP integration for Claude Code adapter | P1 | M | Differentiation |

**Exit criteria**: Token costs visible per-message, budget hard-stops working, system tray active, MCP config injectable.

---

### v0.5 — Ecosystem Growth (Weeks 19-22)

**Theme**: Make AgentOps extensible and community-friendly.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-357 | Adapter contribution guide + template | P1 | S | Ecosystem |
| CMPAAA-358 | Skill import/export format (compatible with Paperclip SKILL.md) | P1 | M | Ecosystem |
| CMPAAA-359 | 3 example projects: basic multi-agent, squad workflow, DAG pipeline | P1 | M | Ecosystem |
| CMPAAA-360 | Community adapter registry (npm or local) | P2 | L | Ecosystem |
| CMPAAA-361 | Adapter hot-reload testing in CI | P2 | S | Quality |

**Exit criteria**: External contributor can build + test + ship an adapter in < 1 hour, skills portable across ecosystems.

---

### v0.6 — Quality & Polish (Weeks 23-26)

**Theme**: Harden for production use.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-362 | E2E test expansion: 10+ specs covering all pages | P1 | M | Quality |
| CMPAAA-363 | Performance benchmark regression tracking | P2 | M | Quality |
| CMPAAA-364 | Snapshot testing for UI components | P2 | S | Quality |
| CMPAAA-365 | Accessibility audit remediation | P2 | M | Quality |
| CMPAAA-366 | Cross-platform build verification (macOS, Windows, Linux) | P1 | M | Quality |

**Exit criteria**: E2E coverage all pages, perf benchmarks stable, a11y audit passes, all platforms build + run.

---

### v1.0 — General Availability (Weeks 27-30)

**Theme**: Ship-ready product.

| Issue | Title | Priority | Effort | Pillar |
|-------|-------|----------|--------|--------|
| CMPAAA-367 | Public launch: README, changelog, release notes | P0 | S | Ecosystem |
| CMPAAA-368 | Auto-update mechanism (electron-updater) | P0 | M | Quality |
| CMPAAA-369 | Telemetry opt-in (anonymous usage stats) | P1 | M | Quality |
| CMPAAA-370 | Landing page / marketing site | P1 | M | Ecosystem |
| CMPAAA-371 | Documentation site (Docusaurus or VitePress) | P1 | M | Ecosystem |

**Exit criteria**: Auto-update works, telemetry opt-in, public docs site live, launch-ready.

---

## Implementation Order

```
v0.2 Foundation (Weeks 1-4)
  ├── CMPAAA-337: Coverage reporting
  ├── CMPAAA-338: Adapter test harness
  ├── CMPAAA-339: Skills directory + examples
  ├── CMPAAA-340: License selection
  └── CMPAAA-341: SAST integration

v0.3 UI Migration (Weeks 5-12)
  ├── CMPAAA-342: React scaffold
  ├── CMPAAA-343: Dashboard (React)
  ├── CMPAAA-344: Agents (React)
  ├── CMPAAA-345: Tasks (React)
  ├── CMPAAA-346: Logs (React)
  ├── CMPAAA-347: Squads (React)
  ├── CMPAAA-348: Settings (React)
  ├── CMPAAA-349: Activity timeline
  └── CMPAAA-350: Workflow editor

v0.4 Differentiation (Weeks 13-18)
  ├── CMPAAA-351: Token cost tracking
  ├── CMPAAA-352: Cost dashboard
  ├── CMPAAA-353: Budget hard-stop
  ├── CMPAAA-354: System tray
  ├── CMPAAA-355: OS notifications
  └── CMPAAA-356: MCP integration

v0.5 Ecosystem (Weeks 19-22)
  ├── CMPAAA-357: Adapter guide + template
  ├── CMPAAA-358: Skill import/export
  ├── CMPAAA-359: Example projects
  ├── CMPAAA-360: Community registry
  └── CMPAAA-361: Hot-reload CI testing

v0.6 Quality (Weeks 23-26)
  ├── CMPAAA-362: E2E expansion
  ├── CMPAAA-363: Perf benchmarks
  ├── CMPAAA-364: Snapshot tests
  ├── CMPAAA-365: A11y remediation
  └── CMPAAA-366: Cross-platform build

v1.0 GA (Weeks 27-30)
  ├── CMPAAA-367: Public launch
  ├── CMPAAA-368: Auto-update
  ├── CMPAAA-369: Telemetry
  ├── CMPAAA-370: Marketing site
  └── CMPAAA-371: Docs site
```

---

## Success Metrics

| Metric | v0.2 | v0.3 | v0.4 | v0.5 | v0.6 | v1.0 |
|--------|------|------|------|------|------|------|
| **Test coverage** | 50% | 55% | 60% | 65% | 70% | 70%+ |
| **Supported CLI providers** | 5+ | 5+ | 5+ | 7+ | 7+ | 7+ |
| **UI pages (React)** | 0 | 7 | 7 | 7 | 7 | 7 |
| **Skills in directory** | 3 | 3 | 5 | 10+ | 10+ | 15+ |
| **E2E specs** | 3 | 5 | 7 | 8 | 10+ | 10+ |
| **Community adapters** | 0 | 0 | 0 | 2+ | 3+ | 5+ |
| **Cost tracking granularity** | Goal-level | Goal-level | Per-message | Per-message | Per-message | Per-message |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **React migration breaks existing functionality** | Critical | Incremental page-by-page migration; keep vanilla JS pages working until React equivalents pass E2E |
| **Scope creep in UI migration** | High | Hard-scope: migrate existing pages only. No new features during v0.3 |
| **Community adoption slow** | Medium | Focus on developer experience: adapter template, clear docs, example projects |
| **Competitor ships desktop + governance** | High | Ship v0.4 (differentiation) before competitors close the gap |
| **Electron performance concerns** | Medium | Monitor memory/CPU; consider Tauri migration for v2.0 if Electron overhead is problematic |

---

## Dependencies Across Phases

```
Phase 1 (CMPAAA-282~285) ─── DONE
    │
    ▼
Phase 2 (CMPAAA-317~333) ─── In Progress
    │
    ├──► Phase 2.1 CLI Adapters (CMPAAA-317~322)
    │       │
    │       ▼
    │    CMPAAA-356 MCP integration (depends on Claude adapter)
    │    CMPAAA-338 Adapter test harness (depends on adapter interface)
    │
    ├──► Phase 2.2 Squad Intelligence (CMPAAA-323~328)
    │       │
    │       ▼
    │    CMPAAA-347 Squads page React migration
    │
    └──► Phase 2.3 Communication (CMPAAA-329~333)
            │
            ▼
         CMPAAA-350 Workflow page (depends on DAG orchestrator)
         CMPAAA-349 Activity timeline (depends on MessageBus)
```

---

## Strategic Positioning Summary

| Release | Tagline | Market Signal |
|---------|---------|---------------|
| **v0.2** | "Foundation" | Internal quality milestone |
| **v0.3** | "Modern UI" | "AgentOps looks professional now" |
| **v0.4** | "Cost Intelligence" | "I can see exactly what each agent costs me" |
| **v0.5** | "Extensible" | "I can build and share my own adapters" |
| **v0.6** | "Production-ready" | "I trust this for my daily workflow" |
| **v1.0** | "GA" | "The multi-agent desktop orchestrator" |
