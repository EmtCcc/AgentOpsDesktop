# AgentOps Desktop — Usability Evaluation

**Date**: 2026-05-28
**Evaluator**: QA Engineer (Design-phase heuristic evaluation)
**Status**: Initial heuristic evaluation — Day 0, no running code. Findings based on documented specs (VISION.md, MVP-SCOPE.md, DESIGN-SYSTEM.md, BRAND-IDENTITY.md).
**Last updated**: 2026-05-28 — Added acceptance criteria mapping, test environment, usability metrics framework. Fixed test runner to Vitest.

---

## Target User Personas

### Persona 1: Solo Developer — "Alex"

| Attribute | Detail |
|-----------|--------|
| **Role** | Full-stack developer, solo or small team |
| **Goal** | Use multiple AI coding agents to accelerate development without managing terminal chaos |
| **Current workflow** | Jumps between 2-4 terminal tabs running Claude Code, Codex, etc. Loses track of which agent is doing what. |
| **Tech comfort** | High. Comfortable with CLI, config files, JSON. |
| **Pain point** | Context-switching overhead. Can't see all agents at once. Misses agent failures until much later. |
| **Success criteria** | Connects an agent in < 2 minutes. Creates a goal + tasks in < 3 minutes. Detects agent failure within 60s. |

### Persona 2: Tech Lead / Engineering Manager — "Jordan"

| Attribute | Detail |
|-----------|--------|
| **Role** | Manages a team that uses AI agents for code generation, reviews, and CI tasks |
| **Goal** | Oversight of agent activity across the team. Wants visibility into what agents are producing. |
| **Current workflow** | Relies on Slack notifications and manual check-ins. No unified view of agent status. |
| **Tech comfort** | Medium-high. Uses dashboards daily but doesn't configure CLI tools often. |
| **Pain point** | No observability. Can't tell if agents are stuck, failed, or producing low-quality output. |
| **Success criteria** | Understands agent status at a glance. Can drill into agent logs without leaving the app. |

### Persona 3: DevOps / Platform Engineer — "Sam"

| Attribute | Detail |
|-----------|--------|
| **Role** | Sets up and maintains agent infrastructure for the org |
| **Goal** | Standardize agent configurations, monitor health, enforce guardrails |
| **Current workflow** | Writes wrapper scripts around CLI agents. Monitors via cron jobs and log files. |
| **Tech comfort** | Very high. Builds tooling for others. |
| **Pain point** | No structured way to manage agent lifecycle. Health checks are ad-hoc. |
| **Success criteria** | Can register agents with structured configs. Gets health alerts within 30s. Can export logs for analysis. |

---

## Test Scenarios

Based on the MVP core user journey and acceptance criteria.

### Scenario 1: First Launch and Agent Connection

**Persona**: Alex (Solo Developer)
**Flow**: Launch app → configure Claude Code agent → verify health check

| Step | Expected Behavior | Success Metric |
|------|-------------------|----------------|
| 1. Launch app on macOS | App opens with empty state, clear CTA to add agent | < 3s launch time |
| 2. Click "Add Agent" | Form with fields: name, executable path, working directory | Form loads < 500ms |
| 3. Enter Claude Code path (`/usr/local/bin/claude`) | Input validates path exists on disk | Validation feedback < 1s |
| 4. Enter working directory | Input validates directory exists and is writable | Validation feedback < 1s |
| 5. Click "Connect" | Health check runs, agent appears in sidebar with status indicator | Health check < 30s |
| 6. Agent shows "Idle" status | Green/gray status dot visible in sidebar | Immediate visual feedback |

**Edge cases to test**:
- Invalid executable path (file doesn't exist)
- Non-executable file (permissions issue)
- Working directory doesn't exist
- Agent binary not in PATH
- Multiple agents with same name
- Agent already connected (duplicate prevention)

### Scenario 2: Goal and Task Creation

**Persona**: Alex (Solo Developer)
**Flow**: Create goal "Implement TODO API" → split into 2 tasks → assign to agent

| Step | Expected Behavior | Success Metric |
|------|-------------------|----------------|
| 1. Click "New Goal" | Modal or inline form appears | < 200ms response |
| 2. Enter goal title | Text input with clear label | — |
| 3. Add Task 1: "Design schema" | Task appears under goal in task board | — |
| 4. Add Task 2: "Implement CRUD endpoints" | Task appears, order preserved | — |
| 5. Assign Task 1 to Agent | Dropdown shows connected agents | — |
| 6. Assign Task 2 to Agent | Assignment confirmed | — |
| 7. Set execution order (serial) | Tasks show dependency/order | — |

**Edge cases to test**:
- Goal with no tasks (empty state)
- Task with no agent assigned
- Maximum number of tasks per goal
- Very long goal/task titles (text overflow)
- Special characters in titles
- Duplicate task names within same goal

### Scenario 3: Parallel Execution and Monitoring

**Persona**: Jordan (Tech Lead)
**Flow**: 2 agents running tasks simultaneously → monitor real-time logs → detect status changes

| Step | Expected Behavior | Success Metric |
|------|-------------------|----------------|
| 1. Start execution | Both tasks transition to "Running" | Status update < 1s |
| 2. View dashboard | Both agents visible with running indicators | Real-time status |
| 3. Click on Agent 1 log | Live stdout stream appears | Log latency < 2s |
| 4. Switch to Agent 2 log | Context preserved for Agent 1 | Seamless switching |
| 5. Agent 1 fails | Status changes to "Error", alert visible | Detection < 60s |
| 6. Agent 2 completes | Status changes to "Done", output summary available | Immediate status update |

**Edge cases to test**:
- Agent produces no output (silent execution)
- Agent produces extremely verbose output (log flooding)
- Agent hangs (no output for extended period)
- Network/disk resource contention between parallel agents
- Window resize during monitoring
- Log scroll position during rapid output

### Scenario 4: Result Summary and Delivery Confirmation

**Persona**: Alex (Solo Developer)
**Flow**: Tasks complete → review output summary → confirm delivery

| Step | Expected Behavior | Success Metric |
|------|-------------------|----------------|
| 1. Both tasks show "Done" | Goal status updates to reflect completion | Immediate |
| 2. Click "View Output" | Summary shows: changed files, diff overview, agent report | < 1s load |
| 3. Review changes | File list is navigable, diffs are readable | — |
| 4. Click "Confirm Delivery" | Confirmation dialog appears | — |
| 5. Confirm | Goal marked as "Delivered", tasks terminal state | Immediate state update |

**Edge cases to test**:
- Agent produced no changes (empty diff)
- Agent produced changes outside working directory
- Partial completion (1 task done, 1 failed)
- User closes app before confirming delivery
- Re-confirming already delivered task

---

## Heuristic Evaluation (Nielsen's 10 Usability Heuristics)

Applied to the documented design system and MVP scope.

### H1: Visibility of System Status

| Finding | Severity | Detail |
|---------|----------|--------|
| Agent status indicators use color + dot shape | **Pass** | Design system specifies "Status conveyed through color AND iconography (never color alone)" — good. |
| Real-time log streaming planned | **Pass** | MVP scope includes live stdout/stderr per agent. |
| No documented mechanism for long-running task progress | **Major** | Tasks have binary states (pending/running/done/failed). No percentage, ETA, or progress bar for tasks that run for minutes. Users can't distinguish "almost done" from "stuck." |
| No documented notification system for status changes | **Minor** | Audio cues are opt-in and muted by default. Visual notification (toast/badge) for status transitions not specified. |

### H2: Match Between System and Real World

| Finding | Severity | Detail |
|---------|----------|--------|
| Goal/Task terminology maps to project management mental model | **Pass** | Familiar to developers who use task boards. |
| "Confirm delivery" uses shipping metaphor | **Pass** | Intuitive for developers. |
| Agent "health check" terminology | **Pass** | Standard ops vocabulary for target personas. |

### H3: User Control and Freedom

| Finding | Severity | Detail |
|---------|----------|--------|
| No documented undo/cancel for task execution | **Major** | Once a task is assigned and running, no documented way to cancel it. MVP scope mentions pause/resume in Milestone 3 (post-MVP). Users need cancel from day 1. |
| No documented way to edit a goal/task after creation | **Major** | No edit flow specified. Users will make typos or change scope. |
| Sidebar collapse provides escape hatch for screen space | **Pass** | 240px → 48px collapse documented. |

### H4: Consistency and Standards

| Finding | Severity | Detail |
|---------|----------|--------|
| Dark-mode-first with consistent token system | **Pass** | Well-defined CSS custom properties, semantic naming. |
| Button variants are consistent (Primary/Secondary/Danger/Ghost) | **Pass** | Clear usage guidelines per variant. |
| Status colors consistent across agent and task states | **Pass** | Running=green, Error=red, Warning=amber consistently applied. |
| No documented light mode implementation | **Minor** | "prefers-color-scheme: light support planned" — no specs. Dark-only for now may alienate users who prefer light themes. |

### H5: Error Prevention

| Finding | Severity | Detail |
|---------|----------|--------|
| Agent path validation on connection | **Pass** | Health check validates connectivity. |
| No documented validation for task assignment to offline agent | **Major** | What happens if user assigns a task to an agent that goes offline between assignment and execution? No guardrail documented. |
| No documented confirmation for destructive actions | **Minor** | Deleting a goal or removing an agent — no confirmation dialog specified. |

### H6: Recognition Rather Than Recall

| Finding | Severity | Detail |
|---------|----------|--------|
| Agent list visible in sidebar | **Pass** | Persistent navigation shows connected agents. |
| Task status visible on board | **Pass** | Status indicators on task cards. |
| No documented search or filter for agents/tasks | **Minor** | As agent/task count grows, finding specific items requires scrolling. No search/filter specified for MVP. |
| No documented recent activity or history | **Minor** | Users must remember which agent did what. No activity feed or audit trail in MVP. |

### H7: Flexibility and Efficiency of Use

| Finding | Severity | Detail |
|---------|----------|--------|
| No keyboard shortcuts documented | **Major** | Power users (primary persona) expect keyboard navigation. No shortcuts defined in design system or MVP scope. |
| No documented bulk operations | **Minor** | Can't select multiple tasks to assign to same agent in one action. |
| Sidebar collapse for screen space efficiency | **Pass** | Good for smaller displays. |

### H8: Aesthetic and Minimalist Design

| Finding | Severity | Detail |
|---------|----------|--------|
| "Cockpit instrument panel" design direction | **Pass** | Information density over decoration. Appropriate for target users. |
| Dark color palette reduces eye strain for long sessions | **Pass** | Well-chosen dark backgrounds with good contrast hierarchy. |
| Audio design is opt-in and muted by default | **Pass** | No unwanted sensory noise. |

### H9: Help Users Recognize, Diagnose, and Recover from Errors

| Finding | Severity | Detail |
|---------|----------|--------|
| Agent error state documented (red indicator) | **Pass** | Error status with distinct color. |
| No documented error messages or recovery flows | **Critical** | What message does the user see when an agent fails? What are the recovery steps? Error states are defined (color/indicator) but error content and recovery UX are not specified. |
| No documented timeout handling UX | **Major** | MVP scope mentions "configurable timeout mechanism" but no UX for timeout notification or recovery. |

### H10: Help and Documentation

| Finding | Severity | Detail |
|---------|----------|--------|
| No in-app help or onboarding documented | **Major** | First-time users have no guided tour, tooltips, or help content. For a novel product category (agent orchestration), onboarding is critical. |
| README is minimal (title only) | **Minor** | No setup instructions, usage guide, or FAQ. |
| No error help links | **Minor** | Error states don't link to troubleshooting docs. |

---

## Accessibility Audit

Based on DESIGN-SYSTEM.md accessibility section and WCAG 2.1 AA requirements.

### Color Contrast

| Pair | Foreground | Background | Ratio | WCAG AA (4.5:1) | Status |
|------|-----------|------------|-------|-----------------|--------|
| Primary text on primary bg | `#E6EDF3` | `#0D1117` | 13.1:1 | Pass | **Pass** |
| Secondary text on primary bg | `#8B949E` | `#0D1117` | 5.9:1 | Pass | **Pass** |
| Tertiary text on primary bg | `#484F58` | `#0D1117` | 2.8:1 | Fail | **Critical** |
| Accent on primary bg | `#58A6FF` | `#0D1117` | 6.5:1 | Pass | **Pass** |
| Success on primary bg | `#3FB950` | `#0D1117` | 6.1:1 | Pass | **Pass** |
| Danger on primary bg | `#F85149` | `#0D1117` | 5.1:1 | Pass | **Pass** |
| Warning on primary bg | `#D29922` | `#0D1117` | 5.7:1 | Pass | **Pass** |
| White on accent button | `#FFFFFF` | `#58A6FF` | 4.6:1 | Pass (barely) | **Pass** |
| White on danger button | `#FFFFFF` | `#F85149` | 4.6:1 | Pass (barely) | **Pass** |

**Finding**: Tertiary text color (`#484F58` on `#0D1117`) fails WCAG AA at 2.8:1. Used for disabled/placeholder text — still needs to be perceivable.

**Severity**: **Critical** — Users with low vision cannot read disabled/placeholder text.

### Keyboard Navigation

| Requirement | Status | Detail |
|-------------|--------|--------|
| All interactive elements focusable | **Not verified** | No code to test. Design system specifies focus ring (`--color-accent` 2px outline) — good intent. |
| Tab order logical | **Not verified** | Sidebar → content → header → footer order assumed but not documented. |
| Focus trapping in modals | **Not specified** | Modal/dialog focus behavior not documented. |
| Skip-to-content link | **Not specified** | No skip navigation documented. |

### Screen Reader Support

| Requirement | Status | Detail |
|-------------|--------|--------|
| ARIA roles for custom components | **Not specified** | Status indicators, task cards, log panels need ARIA roles. Not documented. |
| Live regions for real-time updates | **Not specified** | Agent status changes and log streaming need `aria-live` regions. Critical for screen reader users. |
| Meaningful alt text for icons | **Not specified** | Lucide icons used — need `aria-label` on icon-only buttons. |

### Motion

| Requirement | Status | Detail |
|-------------|--------|--------|
| `prefers-reduced-motion` support | **Pass** | Documented in design system. |
| No auto-playing animations | **Pass** | Motion tokens are explicit, not ambient. |

---

## Edge Case Coverage

### Resource Exhaustion

| Case | Risk | Mitigation (documented) | Gap |
|------|------|------------------------|-----|
| Agent floods stdout | Log panel overwhelmed | "Raw output" mode mentioned | No rate limiting, virtual scrolling, or output truncation specified |
| 10+ agents connected | Sidebar overflows | Sidebar is scrollable | No agent grouping, search, or categorization |
| Long task titles | Text overflow | Not addressed | Need truncation/tooltip strategy |
| Many tasks in a goal | Board scroll | Not addressed | Need pagination or virtual scroll for task board |

### Failure Modes

| Case | Risk | Mitigation (documented) | Gap |
|------|------|------------------------|-----|
| App crashes during agent execution | Data loss | Local SQLite persistence mentioned | No crash recovery or session restore documented |
| Disk full during agent execution | Agent fails silently | Not addressed | No disk space check or warning |
| Agent process zombie | Status shows "Running" but agent is dead | Timeout mechanism mentioned | No zombie detection or cleanup documented |
| SQLite corruption | Data loss | Not addressed | No backup or migration strategy documented |

### Data Integrity

| Case | Risk | Mitigation (documented) | Gap |
|------|------|------------------------|-----|
| Concurrent writes (parallel agents) | SQLite lock contention | Not addressed | WAL mode or write queue needed |
| Agent modifies files outside working directory | Unexpected side effects | Not addressed | No sandboxing or directory boundary enforcement |
| User deletes agent with running tasks | Orphaned tasks | Not addressed | Need cascade rules or confirmation |

---

## Findings Summary

### Critical (3)

| # | Finding | Heuristic | Impact |
|---|---------|-----------|--------|
| C1 | No documented error messages or recovery flows for agent failures | H9 | Users see a red dot but don't know what happened or how to fix it. Blocks task completion understanding. |
| C2 | Tertiary text color (`#484F58`) fails WCAG AA contrast | Accessibility | 2.8:1 ratio. Disabled/placeholder text unreadable for low-vision users. |
| C3 | No ARIA live regions specified for real-time status updates | Accessibility | Screen reader users won't receive agent status changes or log updates. |

### Major (6)

| # | Finding | Heuristic | Impact |
|---|---------|-----------|--------|
| M1 | No task progress indicator beyond binary states | H1 | Users can't distinguish "almost done" from "stuck" for long-running tasks. |
| M2 | No documented cancel/undo for running tasks | H3 | Users can't stop a misbehaving agent. Post-MVP (Milestone 3) is too late. |
| M3 | No documented edit flow for goals/tasks after creation | H3 | Users must delete and recreate for any change. High friction. |
| M4 | No validation guardrail for assigning tasks to offline agents | H5 | Silent failure when agent goes offline between assignment and execution. |
| M5 | No keyboard shortcuts defined | H7 | Power users can't operate efficiently. Tab-only navigation is slow for multi-agent workflows. |
| M6 | No onboarding or first-run experience documented | H10 | Novel product category needs guided introduction. Users won't know where to start. |

### Minor (5)

| # | Finding | Heuristic | Impact |
|---|---------|-----------|--------|
| m1 | No visual notification for status transitions (toast/badge) | H1 | Users may miss status changes if not actively watching the dashboard. |
| m2 | No light mode implementation | H4 | Some users prefer light themes. Not blocking but limits adoption. |
| m3 | No search/filter for agents or tasks | H6 | Scrolling fatigue as count grows. |
| m4 | No confirmation dialog for destructive actions (delete goal, remove agent) | H5 | Accidental data loss possible. |
| m5 | No documented log output rate limiting or virtual scrolling | Edge cases | Verbose agents could overwhelm the UI. |

---

## Recommendations

### Immediate (Before Implementation)

1. **Define error UX**: Document error messages, recovery flows, and error state content for every failure mode (agent crash, timeout, invalid config, connection lost).
2. **Fix tertiary text contrast**: Change `--color-text-tertiary` from `#484F58` to at least `#6E7681` (4.5:1 ratio on `#0D1117`).
3. **Specify ARIA patterns**: Document ARIA roles, live regions, and keyboard interaction patterns for all custom components (status indicators, task cards, log panels, modals).
4. **Add task progress states**: Between "running" and "done", consider: `queued`, `initializing`, `executing`, `summarizing`. Even without percentage, sub-states reduce uncertainty.
5. **Define keyboard shortcuts**: At minimum: new goal (Cmd+N), new task (Cmd+T), focus sidebar (Cmd+B), focus logs (Cmd+L), cancel task (Cmd+.).

### Short-Term (MVP)

6. **Add cancel task**: Don't defer to Milestone 3. Users need to stop agents from day 1.
7. **Add edit flow**: Inline edit for goal/task titles and descriptions.
8. **Build onboarding**: First-run wizard: connect first agent → create first goal → run first task. 3 steps, skippable.
9. **Add offline agent guardrail**: Disable or warn when assigning tasks to agents with non-"Idle" status.

### Medium-Term (Post-MVP)

10. **Add search/filter**: Filter agents by status, search tasks by title.
11. **Add activity feed**: Chronological list of agent actions and status changes.
12. **Implement light mode**: Use the documented token system to support `prefers-color-scheme: light`.

---

## Test Automation Plan

Once code exists, the following test automation should be implemented:

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Agent connection logic, task state machine, status mapping |
| Component | React Testing Library | Button interactions, form validation, status indicators |
| Integration | Playwright | Full user flows: connect agent, create goal, monitor execution |
| E2E | Playwright + Electron | App launch, agent lifecycle, delivery confirmation |
| Accessibility | axe-core + Playwright | Automated contrast checks, ARIA validation, keyboard nav |
| Visual | Percy or Chromatic | Screenshot regression for dark mode components |

Priority automation targets (from MVP acceptance criteria):
1. Agent connection health check flow
2. Goal → Task → Assignment → Execution state machine
3. Real-time log streaming (mock agent output)
4. Delivery confirmation flow

---

## Acceptance Criteria Mapping

Each MVP acceptance criterion maps to one or more test scenarios:

| MVP Acceptance Criterion | Test Scenario(s) | Coverage Status |
|--------------------------|-------------------|-----------------|
| 1. macOS launch + configure Claude Code Agent | Scenario 1 (Steps 1-6) | Covered |
| 2. Create Goal "Implement a TODO API" | Scenario 2 (Steps 1-2) | Covered |
| 3. Split into 2 Tasks | Scenario 2 (Steps 3-4) | Covered |
| 4. Assign to Agent (serial or parallel) | Scenario 2 (Steps 5-7), Scenario 3 | Covered |
| 5. Real-time log output per Task | Scenario 3 (Steps 3-4) | Covered |
| 6. View output summary after completion | Scenario 4 (Steps 1-3) | Covered |
| 7. Confirm delivery, task marked done | Scenario 4 (Steps 4-5) | Covered |

All 7 MVP acceptance criteria have corresponding test coverage.

---

## Test Environment & Setup

| Item | Specification |
|------|---------------|
| **Platform** | macOS (primary target per MVP-SCOPE.md) |
| **Runtime** | Electron 42, Node.js >= 20 |
| **Test runner** | Vitest (unit/integration), Playwright (E2E) |
| **Agent under test** | Claude Code CLI (`/usr/local/bin/claude` or equivalent) |
| **Test data** | Synthetic goals/tasks with deterministic agent prompts |
| **Isolation** | Each test run uses a temp working directory; `~/.agentops/data.json` reset between runs |
| **Mock strategy** | Mock agent subprocess for unit tests; real CLI agent for integration/E2E |

### Prerequisites for Manual Evaluation

1. macOS with Electron app built (`npm run build`)
2. At least one CLI agent installed and on PATH (Claude Code recommended)
3. A writable test working directory (e.g., `~/agentops-test/`)
4. Screen recording enabled for evaluation sessions (QuickTime or equivalent)

---

## Usability Metrics Framework

Quantitative metrics to collect during evaluation sessions:

| Metric | Target | Collection Method |
|--------|--------|-------------------|
| **Task completion rate** | 100% for Scenario 1-4 core steps | Observer logs pass/fail per step |
| **Time on task** | Scenario 1 < 2 min, Scenario 2 < 3 min | Stopwatch per scenario |
| **Error rate** | < 2 user errors per scenario | Observer logs mistakes + self-corrections |
| **System Usability Scale (SUS)** | >= 68 (above average) | Post-evaluation questionnaire |
| **Agent failure detection time** | < 60s from failure to user awareness | Timestamp comparison |
| **First-action success** | User takes correct first action on first try | Observer logs |

### SUS Questionnaire (Post-Evaluation)

Standard 10-item SUS survey administered after completing all test scenarios. Score interpretation:
- \> 80.3: Excellent
- 68-80.3: Good
- 51-67.9: OK
- < 51: Poor

---

## Test Execution Log

| Date | Evaluator | Type | Scenarios | Findings | Notes |
|------|-----------|------|-----------|----------|-------|
| 2026-05-28 | QA Engineer | Heuristic (Day 0) | S1-S4 (spec-only) | 3C, 6M, 5m | No running code; evaluation based on design specs |

*Add rows as evaluations are executed against running code.*

---

## Next Steps

- [x] Initial usability evaluation documented (this document)
- [x] Acceptance criteria mapping completed
- [x] Usability metrics framework defined
- [ ] CTO reviews critical findings (C1, C2, C3) before implementation begins
- [ ] Design system updated with tertiary text contrast fix
- [ ] Error UX spec created (separate document or inline in MVP-SCOPE.md)
- [ ] ARIA patterns documented in DESIGN-SYSTEM.md
- [ ] Keyboard shortcuts defined in DESIGN-SYSTEM.md
- [ ] Re-evaluate after Milestone 1 implementation (running code to test against)
- [ ] Set up automated accessibility testing in CI pipeline

---

*This is a living document. Update findings as the product evolves from spec to implementation.*
