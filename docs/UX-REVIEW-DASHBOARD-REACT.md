# Dashboard Page — UX Review for React Migration

**Issue**: CMPAAA-343
**Date**: 2026-05-29
**Reviewer**: UX Researcher
**Scope**: Dashboard page migration from vanilla JS to React

---

## 1. Current User Journey

### 1.1 Entry Points
- **Primary**: Sidebar "Dashboard" link (default active page)
- **Secondary**: Landing page "Get Started" button
- **Deep link**: `/` route (mapped to `DashboardPage`)

### 1.2 Information Architecture

```
Dashboard
├── Summary Bar (agent/task counts)
├── Row 1: Two-column grid
│   ├── Agent Status Cards (left, 2fr)
│   │   ├── Card header: "Agent Status" + "Manage" link
│   │   └── Grid of agent cards (auto-fill, minmax 220px)
│   │       ├── Agent name (truncated at 140px)
│   │       ├── Agent type (monospace)
│   │       ├── Status badge (idle/running/error/offline)
│   │       └── Restart button (error state only)
│   └── Task Kanban (right, 1fr)
│       ├── Card header: "Task Progress" + "View all" link
│       └── 4-column mini-board
│           ├── Pending
│           ├── Running
│           ├── Done
│           └── Failed
└── Row 2: Full-width
    └── Live Log Stream
        ├── Card header: "Live Log Stream" + Pause/Clear buttons
        └── Scrollable log viewer (320px height)
            ├── Timestamp
            ├── Agent tag (optional)
            └── Message
```

### 1.3 User Tasks
1. **Monitor agent health**: Glance at summary bar → scan agent cards for errors
2. **Track task progress**: View kanban columns → identify blocked/failed tasks
3. **Debug issues**: Pause log stream → scroll to error → identify agent
4. **Take action**: Restart failed agents → navigate to full agent/task views

---

## 2. Current UX Issues

### 2.1 Critical Issues

| Issue | Impact | Location |
|-------|--------|----------|
| **No loading states** | Users see blank content while IPC responds. Skeleton CSS exists but unused. | `loadDashAgents()`, `loadDashTasks()`, `loadDashLogs()` |
| **Task cards show UUID** | `t.agentId` displays raw UUID instead of agent name. Users see `unassigned` or gibberish. | `loadDashTasks():401` |
| **No error recovery** | IPC failures silently swallowed with empty catch blocks. No retry, no error state. | All `load*` functions |
| **Agent restart has no feedback** | Button shows "Restarting..." but no success/failure state persists. | `bindDashActions():480-496` |

### 2.2 Moderate Issues

| Issue | Impact | Location |
|-------|--------|----------|
| **Virtual list threshold arbitrary** | MAX_RENDER = 50 with no virtualization. DOM grows unbounded for large fleets. | `loadDashAgents():326` |
| **Log stream max lines = 500** | Hard limit with no user control. May lose important context. | `subscribeDashEvents():449` |
| **Kanban items capped at 20** | No indication of total count beyond "+N more". Users can't assess backlog size. | `loadDashTasks():404` |
| **Periodic refresh (10s) is aggressive** | May cause UI jank on slower machines. No user control over interval. | `subscribeDashEvents():465` |

### 2.3 Minor Issues

| Issue | Impact | Location |
|-------|--------|----------|
| **Summary bar uses `aria-live="polite"`** | Screen readers announce every count change. Should be `aria-live="off"` or use `aria-atomic`. | `renderDashboard():204` |
| **No keyboard shortcuts** | Power users can't pause/resume logs without mouse. | `bindDashActions()` |
| **Agent cards lack drill-down** | Clicking agent card does nothing. Should navigate to agent detail. | `loadDashAgents():337` |

---

## 3. React Migration Recommendations

### 3.1 Component Architecture

```
DashboardPage
├── DashboardHeader
│   ├── Title + Description
│   └── Action buttons (Refresh, View all logs)
├── SummaryBar
│   └── SummaryItem × 5 (Agents, Running, Idle, Errors, Tasks)
├── DashboardGrid
│   ├── AgentStatusCard
│   │   ├── CardHeader ("Agent Status" + "Manage" link)
│   │   └── AgentCardGrid
│   │       └── AgentCard × N
│   │           ├── AgentCardHeader (name + status badge)
│   │           ├── AgentCardMeta (type)
│   │           └── AgentCardActions (restart button)
│   └── TaskKanbanCard
│       ├── CardHeader ("Task Progress" + "View all" link)
│       └── KanbanBoard
│           └── KanbanColumn × 4
│               ├── ColumnHeader (status + count)
│               └── KanbanItem × N
└── LogStreamCard
    ├── CardHeader ("Live Log Stream" + Pause/Clear)
    └── LogViewer
        └── LogLine × N
```

### 3.2 State Management

```typescript
// Recommended: React Query for server state
interface DashboardState {
  agents: {
    data: Agent[];
    isLoading: boolean;
    error: Error | null;
  };
  tasks: {
    data: Task[];
    isLoading: boolean;
    error: Error | null;
  };
  logs: {
    data: LogEntry[];
    isPaused: boolean;
    maxLines: number;
  };
  refreshInterval: number; // User-configurable
}
```

### 3.3 Real-time Subscriptions

**Current**: Manual subscription management with cleanup in `navigate()`.

**Recommendation**: Use React Query's `useQuery` with `refetchInterval` + WebSocket subscription for logs.

```typescript
// Agent/task data: polling with React Query
useQuery({
  queryKey: ['agents'],
  queryFn: () => window.agentOps.agents.list(),
  refetchInterval: refreshInterval,
});

// Log stream: WebSocket subscription
useEffect(() => {
  const unsub = window.agentOps.logs.onNew((entry) => {
    appendLog(entry);
  });
  return () => unsub();
}, []);
```

### 3.4 UX Improvements to Include

| Improvement | Priority | Implementation |
|-------------|----------|----------------|
| **Skeleton loading states** | High | Use existing `.skeleton` CSS classes |
| **Error boundaries with retry** | High | React Error Boundary + retry button |
| **Agent name resolution** | High | Resolve `agentId` → name before render |
| **Clickable agent cards** | Medium | `onClick={() => navigate(`/agents/${id}`)}` |
| **Configurable refresh interval** | Medium | Settings dropdown (5s, 10s, 30s, 60s) |
| **Virtualized lists** | Medium | `react-window` for agent cards + logs |
| **Keyboard shortcuts** | Low | `useHotkeys('space', togglePause)` |
| **Log search/filter** | Low | Add search input above log viewer |

---

## 4. Accessibility Checklist

- [ ] Summary bar: Use `aria-atomic="true"` instead of `aria-live="polite"`
- [ ] Agent cards: Add `role="listitem"` and `aria-label` with agent name + status
- [ ] Kanban columns: Add `role="region"` and `aria-label` per column
- [ ] Log viewer: Keep `role="log"` and `aria-live="polite"` (correct for live logs)
- [ ] Pause button: Add `aria-pressed` state
- [ ] Restart button: Add `aria-describedby` pointing to agent name
- [ ] Focus management: After restart, return focus to agent card

---

## 5. Design Token Compliance

All existing styles use design tokens correctly. React components should:

1. Import tokens from `styles/tokens.css` (already loaded globally)
2. Use CSS classes, not inline styles
3. Leverage existing `.card`, `.btn`, `.log-line` components
4. Maintain BEM naming: `.dashboard-agent-card__header`

---

## 6. Testing Recommendations

### 6.1 Visual Regression
- Screenshot comparison: empty state, 3 agents, 50+ agents
- Dark mode variants
- Responsive breakpoints (if applicable)

### 6.2 Interaction Tests
- Agent restart flow: click → loading → success/error
- Log pause/resume: button state + aria-pressed
- Navigation: "Manage" → agents page, "View all" → tasks page

### 6.3 Performance Tests
- Render 100 agent cards: should complete in <100ms
- Log stream append: 1000 lines/second without jank
- Memory: no leaks after 10 minutes of log streaming

---

## 7. Migration Phases

### Phase 1: Core Components (This PR)
- [ ] Create `DashboardPage` component
- [ ] Create `SummaryBar` component
- [ ] Create `AgentStatusCard` + `AgentCard` components
- [ ] Create `TaskKanbanCard` + `KanbanColumn` + `KanbanItem` components
- [ ] Create `LogStreamCard` + `LogViewer` components
- [ ] Wire up IPC calls with loading/error states
- [ ] Add skeleton loading states

### Phase 2: Real-time & Actions
- [ ] Implement log stream subscription
- [ ] Implement agent/task polling
- [ ] Add agent restart action with feedback
- [ ] Add pause/resume/clear actions

### Phase 3: Polish
- [ ] Add keyboard shortcuts
- [ ] Add virtualized lists for large fleets
- [ ] Add configurable refresh interval
- [ ] Add log search/filter

---

## 8. Open Questions

1. **Should agent cards be clickable?** Current implementation has no drill-down. Recommendation: yes, navigate to `/agents/:id`.
2. **What is the expected agent fleet size?** Affects virtualization priority.
3. **Should logs persist across navigation?** Currently cleared on page leave. Recommendation: keep in memory, clear on app restart.
4. **Refresh interval: user-configurable or fixed?** Recommendation: user-configurable with sensible default (10s).
