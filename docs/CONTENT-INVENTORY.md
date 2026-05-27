# Content Inventory — AgentOps Desktop

> Generated: 2026-05-28 | Source: CONTENT-AUDIT.md, DESIGN-AUDIT-LIVE.md, source tree scan
> Supersedes: Day 0 inventory (scaffold-only state)

---

## Summary

| Category | Total | Ship As-Is | Needs Work | Planned | Deprecated |
|----------|-------|------------|------------|---------|------------|
| App pages | 5 | 3 | 2 | 0 | 0 |
| App page elements | 62 | 48 | 12 | 2 | 0 |
| Documentation files | 26 | 22 | 3 | 0 | 1 |
| Media assets | 0 | 0 | 0 | 7 | 0 |
| CSS style files | 5 | 5 | 0 | 0 | 0 |
| JS source modules | 14 | 14 | 0 | 0 | 0 |
| Config files | 6 | 6 | 0 | 0 | 0 |

---

## 1. Application Pages

| Page | Route | Content Type | Quality | Migration Status | Priority | Action |
|------|-------|-------------|---------|-----------------|----------|--------|
| Dashboard | `/` | Operational dashboard | Good | Ship with fixes | **P1** | Add onboarding, fix empty states |
| Agents | `/agents` | CRUD management | Good | Ship with fixes | **P0** | Add delete confirmation, fix modal labels |
| Tasks | `/tasks` | Kanban board | Fair | Ship with fixes | **P1** | Implement drag-drop or remove kanban affordance |
| Logs | `/logs` | Real-time log viewer | Good | Ship with fixes | **P0** | Fix word-break, add text search |
| Settings | `/settings` | Configuration | Poor | Needs rework | **P0** | Wire to IPC persistence, add save mechanism |

---

## 2. Page Element Inventory

### 2.1 Dashboard (`/`)

| Element | Content | Type | Quality | Migration Priority | Action |
|---------|---------|------|---------|-------------------|--------|
| Page title | "Dashboard" | Heading | Good | Ship | — |
| Page description | "Agent operations overview" | Subtitle | Good | Ship | — |
| Stat: Agents | `0` (dynamic) | Metric | Good | Ship | Add aria-live region |
| Stat: Tasks | `0` (dynamic) | Metric | Good | Ship | Add aria-live region |
| Stat: Running | `0` (dynamic) | Metric | Good | Ship | Add aria-live region |
| Stat: Errors | `0` (dynamic) | Metric | Good | Ship | Add aria-live region |
| Recent activity | "No recent activity" | Empty state | Fair | **Rewrite** | Add actionable guidance |
| Quick action: Add agent | "Add agent" | Button | Good | Ship | Add aria-label |
| Quick action: Create task | "Create task" | Button | Good | Ship | Add aria-label |
| Quick action: View settings | "View settings" | Button | Fair | **Fix** | Change icon from barChart to gear |

### 2.2 Agents (`/agents`)

| Element | Content | Type | Quality | Migration Priority | Action |
|---------|---------|------|---------|-------------------|--------|
| Page title | "Agents" | Heading | Good | Ship | — |
| Page description | "Manage connected CLI agents" | Subtitle | Good | Ship | — |
| Empty state title | "No agents configured" | Empty state | Good | Ship | — |
| Empty state desc | "Add a CLI agent to start orchestrating tasks." | Guidance | Good | Ship | — |
| Modal: title | "Add agent" | Modal heading | Good | Ship | — |
| Modal: name label | "Agent name" | Form label | Good | Ship | Add `for`/`id` linking |
| Modal: name placeholder | "e.g. Claude Code" | Placeholder | Good | Ship | — |
| Modal: type label | "Type" | Form label | Fair | **Rewrite** | Change to "Agent type" |
| Modal: type options | Claude Code, Codex, Gemini CLI, OpenCode, Cursor, Custom | Select | Good | Ship | Add descriptions per type |
| Modal: path label | "Executable path" | Form label | Good | Ship | Add `for`/`id` linking |
| Modal: path placeholder | "/usr/local/bin/claude" | Placeholder | Good | Ship | — |
| Modal: cwd label | "Working directory" | Form label | Good | Ship | Add `for`/`id` linking |
| Modal: cwd placeholder | "/path/to/project" | Placeholder | Good | Ship | — |
| Agent row: status | Status dot + badge | Visual | Good | Ship | Capitalize badge text |
| Agent row: actions | Health check, Remove | Icon buttons | Fair | **Fix** | Add delete confirmation dialog |

### 2.3 Tasks (`/tasks`)

| Element | Content | Type | Quality | Migration Priority | Action |
|---------|---------|------|---------|-------------------|--------|
| Page title | "Tasks" | Heading | Good | Ship | — |
| Page description | "Track goals and task assignments" | Subtitle | Good | Ship | — |
| Column: Pending | "Pending" + count | Kanban header | Good | Ship | — |
| Column: Running | "Running" + count | Kanban header | Good | Ship | — |
| Column: Done | "Done" + count | Kanban header | Good | Ship | — |
| Column: Failed | "Failed" + count | Kanban header | Good | Ship | — |
| Empty column | "No tasks" | Empty state | Fair | **Rewrite** | Add dashed border + icon |
| Modal: title | "New task" | Modal heading | Good | Ship | — |
| Modal: title placeholder | "Implement user auth" | Placeholder | Good | Ship | — |
| Modal: desc placeholder | "Details about the task..." | Placeholder | Fair | **Rewrite** | More specific guidance |
| Modal: agent label | "Assign to agent" | Form label | Good | Ship | — |
| Modal: agent default | "Unassigned" | Option | Good | Ship | — |
| Modal: goal label | "Goal (optional)" | Form label | Good | Ship | — |
| Modal: goal default | "No goal" | Option | Good | Ship | — |
| Task card | Title + agent + timestamp | Card | Good | Ship | Resolve agent ID to name |

### 2.4 Logs (`/logs`)

| Element | Content | Type | Quality | Migration Priority | Action |
|---------|---------|------|---------|-------------------|--------|
| Page title | "Logs" | Heading | Good | Ship | — |
| Page description | "Real-time agent output" | Subtitle | Good | Ship | — |
| Filter: agents | "All agents" | Select default | Good | Ship | — |
| Filter: levels | "All levels", Debug, Info, Warning, Error | Select options | Good | Ship | — |
| Empty state title | "No logs yet" | Empty state | Good | Ship | — |
| Empty state desc | "Logs from agent sessions will appear here in real time." | Guidance | Good | Ship | — |
| Clear button | Trash icon + "Clear" | Button | Fair | **Fix** | Add confirmation dialog |
| Refresh button | Refresh icon + "Refresh" | Button | Good | Ship | — |
| Log entry | Timestamp + agent tag + stream tag + message | Log line | Good | Ship | Fix word-break |
| Cleared state | "Logs cleared" | Feedback | Fair | Ship | — |

### 2.5 Settings (`/settings`)

| Element | Content | Type | Quality | Migration Priority | Action |
|---------|---------|------|---------|-------------------|--------|
| Page title | "Settings" | Heading | Good | Ship | — |
| Page description | "Application preferences" | Subtitle | Good | Ship | — |
| Section: General | "General" | Section heading | Good | Ship | — |
| App version | "v0.1.0" (hardcoded) | Badge | Poor | **Fix** | Read from package.json |
| Platform | Dynamic | Badge | Good | Ship | — |
| Section: Agents | "Agents" | Section heading | Good | Ship | — |
| Max parallel | "3" (hardcoded) | Input | Poor | **Rewrite** | Wire to store via IPC |
| Task timeout | "30" min (hardcoded) | Input | Poor | **Rewrite** | Wire to store via IPC |
| Section: Logs | "Logs" | Section heading | Good | Ship | — |
| Log retention | "10000" (hardcoded) | Input | Poor | **Rewrite** | Wire to store via IPC |

---

## 3. Shell Content (index.html)

| Element | Content | Quality | Priority | Action |
|---------|---------|---------|----------|--------|
| `<title>` | "AgentOps" | Good | **P2** | Add dynamic page title |
| Header title | "AgentOps" | Good | P3 | Add logo/icon |
| Sidebar: Overview | "Dashboard" | Good | Ship | — |
| Sidebar: Operations | "Agents", "Tasks", "Logs" | Good | Ship | — |
| Sidebar: footer | "Settings" | Good | Ship | — |
| Footer status | "System ready" | Good | P2 | Make dynamic |
| Footer agent count | "0 agents" | Good | Ship | Dynamic |
| Footer version | "v0.1.0" | Fair | **P2** | Read from package.json |
| Notifications button | Bell icon, no label | Fair | P3 | Remove or implement |

---

## 4. Documentation Inventory

| File | Path | Words | Quality | Status | Priority | Action |
|------|------|-------|---------|--------|----------|--------|
| Vision | `docs/VISION.md` | ~850 | Excellent | Active | Ship | — |
| MVP Scope | `docs/MVP-SCOPE.md` | ~1,200 | Excellent | Active | Ship | — |
| Architecture | `docs/ARCHITECTURE.md` | ~1,000 | Excellent | Active | Ship | — |
| Design System | `docs/DESIGN-SYSTEM.md` | ~2,000 | Excellent | Active | Ship | Resolve color token conflict |
| Brand Identity | `docs/BRAND-IDENTITY.md` | ~1,800 | Excellent | Active | Ship | Resolve blue accent conflict |
| Design Spec | `docs/DESIGN-SPEC.md` | ~1,500 | Good | Active | **P2** | Fix font size base (16→14px) |
| Design Audit | `docs/DESIGN-AUDIT.md` | ~800 | Good | Active | Ship | — |
| Design Audit Live | `docs/DESIGN-AUDIT-LIVE.md` | ~600 | Good | Active | Ship | — |
| Content Audit | `docs/CONTENT-AUDIT.md` | ~300 | Good | Active | Ship | — |
| Accessibility Audit | `docs/ACCESSIBILITY-AUDIT.md` | ~700 | Good | Active | Ship | — |
| Codebase Audit | `docs/CODEBASE-AUDIT.md` | ~500 | Good | Active | Ship | — |
| Competitive Landscape | `docs/COMPETITIVE-LANDSCAPE.md` | ~900 | Good | Active | Ship | — |
| Market Analysis | `docs/MARKET-ANALYSIS.md` | ~800 | Good | Active | Ship | — |
| Tech Stack | `docs/TECH-STACK.md` | ~600 | Good | Active | Ship | — |
| API | `docs/API.md` | ~500 | Good | Active | Ship | — |
| Security Review | `docs/SECURITY-REVIEW.md` | ~600 | Good | Active | Ship | — |
| Threat Model | `docs/THREAT-MODEL.md` | ~700 | Good | Active | Ship | — |
| Code Signing | `docs/CODE-SIGNING.md` | ~400 | Good | Active | Ship | — |
| Dependency Audit | `docs/DEPENDENCY-AUDIT.md` | ~500 | Good | Active | Ship | — |
| Performance Budget | `docs/PERFORMANCE-BUDGET.md` | ~400 | Good | Active | Ship | — |
| Monitoring | `docs/MONITORING.md` | ~500 | Good | Active | Ship | — |
| Release Process | `docs/RELEASE-PROCESS.md` | ~600 | Good | Active | Ship | — |
| Feedback Triage | `docs/FEEDBACK-TRIAGE.md` | ~400 | Good | Active | Ship | — |
| User Testing | `docs/USER-TESTING.md` | ~500 | Good | Active | Ship | — |
| Getting Started | `docs/getting-started.md` | ~600 | Good | Active | **P2** | Fix placeholder URLs |
| Content Inventory | `docs/CONTENT-INVENTORY.md` | ~300 | Fair | **Deprecated** | **Remove** | Superseded by this document |
| README | `README.md` | ~100 | Basic | Active | **P1** | Rewrite with full content |

---

## 5. Source Code Modules

| Module | Path | Files | Status | Priority |
|--------|------|-------|--------|----------|
| Main process | `src/main/` | 9 | Active | Ship |
| Renderer process | `src/renderer/` | 2 (app.js, index.html) | Active | Ship |
| Styles | `src/renderer/styles/` | 5 CSS files | Active | Ship |
| Shared types | `src/shared/` | 1 | Active | Ship |
| Repositories | `src/main/repositories/` | 4 | Active | Ship |
| DB layer | `src/main/db/` | 5 | Active | Ship |

---

## 6. Media Assets

| Asset | Expected Path | Status | Priority | Action |
|-------|--------------|--------|----------|--------|
| App icon (icns) | `assets/icon.icns` | **Missing** | **P0** | Create for macOS build |
| Logo PNGs (16–1024px) | `assets/logo-icon-*.png` | **Missing** | P1 | Create from brand spec |
| Logo lockup SVGs | `assets/logo-lockup-*.svg` | **Missing** | P2 | Create from brand spec |
| Custom icon SVGs | `assets/icon-*.svg` | **Missing** | P3 | Currently inline SVGs |
| UI sound effects | `assets/sfx-*.ogg` | **Missing** | P3 | Planned in brand spec |
| Web fonts | `assets/fonts/` | **Missing** | P3 | System font stack as fallback |
| Screenshots/mockups | `assets/screenshots/` | **Missing** | P2 | Needed for marketing site |

---

## 7. Content Quality Issues (by Priority)

### P0 — Critical (fix before release)

| Issue | Location | Impact |
|-------|----------|--------|
| Settings not persisted | Settings page | User changes lost on reload |
| Hardcoded version | Settings + footer | Stale version display |
| No delete confirmation | Agents page | Accidental agent deletion |
| Missing app icon | assets/ | Build fails, no dock icon |
| Focus indicators removed | base.css | Keyboard users lose focus |
| Modal label association | Agents + Settings | Screen readers can't parse forms |
| Word-break in logs | Logs page | Log output unreadable |

### P1 — High (fix before beta)

| Issue | Location | Impact |
|-------|----------|--------|
| No onboarding flow | Dashboard | New users don't know where to start |
| No empty-state guidance | Dashboard, Tasks | Users see blank screens |
| No text search in logs | Logs page | Can't find specific entries |
| No ARIA landmarks | Shell | Screen readers can't navigate |
| No form validation | Agents modal | Silent failures |
| README needs rewrite | README.md | No setup instructions |

### P2 — Medium (polish pass)

| Issue | Location | Impact |
|-------|----------|--------|
| No agent type descriptions | Add agent modal | Users don't know differences |
| "View settings" icon mismatch | Dashboard | barChart icon for settings |
| No task priority | Tasks kanban | All tasks look equal |
| Dynamic page title | index.html | Can't distinguish pages in taskbar |
| Placeholder URLs | getting-started.md | Broken links |
| Design token conflict | 3 docs | Three different primary blues |

### P3 — Low (future polish)

| Issue | Location | Impact |
|-------|----------|--------|
| No keyboard shortcuts | Global | Power user friction |
| No export for logs | Logs page | Can't share/debug externally |
| Notifications button dead | Header | False affordance |
| No version in page title | index.html | — |
| Inline style proliferation | app.js | 38 inline styles to migrate |

---

## 8. Migration Strategy

### Ship As-Is (no changes needed)
- All 5 page renderers (core logic)
- Shell layout (header, sidebar, footer)
- Inline SVG icon system
- CSS design system (5 files)
- 22 of 26 documentation files
- All source code modules
- All config files

### Ship With Fixes (P0/P1 items)
- Settings page → wire to IPC persistence
- Agents page → add delete confirmation, fix modal labels
- Logs page → fix word-break, add search
- Dashboard → add onboarding hints, fix empty states
- Create app icon asset

### Needs Rework
- README.md → full rewrite
- Settings inputs → IPC binding + save mechanism
- DESIGN-SPEC.md → fix font size base

### Planned (not started)
- Agent detail page (`/agents/:agentId`)
- Task detail page (`/tasks/:taskId`)
- Workflows page (`/workflows`)
- Governance settings (`/settings/governance`)
- Agent settings (`/settings/agents`)

### Deprecate
- Old `CONTENT-INVENTORY.md` → superseded by this document

---

## 9. Content Metrics

| Metric | Value |
|--------|-------|
| Implemented pages | 5 |
| Planned pages | 6 (in routes.ts) |
| Total page elements | 62 |
| Documentation files | 26 |
| Total doc word count | ~18,000 |
| Media assets | 0 (all inline SVG) |
| Missing critical assets | 1 (app icon) |
| Settings fields | 5 (none persisted) |
| Empty states | 4 (2 with guidance, 2 without) |
| Modals | 2 (add agent, new task) |
| Inline styles in JS | 38 |
| Content quality score | 7/10 |

---

*This inventory is based on the content audit of 2026-05-28. Re-audit after Sprint 1 completion.*
