# Design Spec: Task Cancel/Undo & Edit Flows

**Issue**: CMPAAA-56
**Author**: UI & Brand Designer
**Date**: 2026-05-29
**Status**: Ready for implementation
**Heuristic**: H3 — User control and freedom

---

## 1. Problem Statement

Users cannot cancel running tasks once assigned, and must delete/recreate tasks or goals for any change. This violates the "User Control and Freedom" heuristic — users need escape routes and undo.

**Severity**: Major (from USER-TESTING.md M2 + M3)

---

## 2. Scope

| # | Feature | Priority |
|---|---------|----------|
| 1 | Cancel task action (kills agent subprocess, marks cancelled) | P0 |
| 2 | Cancel confirmation dialog (warns about in-progress work) | P0 |
| 3 | Inline edit for task title & description | P0 |
| 4 | Inline edit for goal title & description | P0 |
| 5 | `cancelled` status in task state machine | P0 |
| 6 | `cancelled` status badge & visual treatment | P1 |
| 7 | Undo cancel (restore to previous status) | P1 |

---

## 3. Task State Machine — Updated

```
                 ┌──────────┐
                 │  pending  │
                 └────┬─────┘
                      │ assign
                      ▼
                 ┌──────────┐
           ┌────▶│ assigned │◀────┐
           │     └────┬─────┘     │
           │          │ start     │ reassign
           │          ▼           │
           │     ┌──────────┐     │
           │     │  running  │─────┘
           │     └──┬───┬───┘
           │        │   │
     cancel│        │   │ complete
           │        │   ▼
           │     ┌──────────┐
           │     │   done    │
           │     └──────────┘
           │
           ▼
     ┌──────────┐
     │ cancelled │  ← NEW
     └──────────┘
```

**Rules**:
- Any non-terminal state (`pending`, `assigned`, `running`) can transition to `cancelled`
- `cancelled` is terminal — no transitions out (except undo within 30s window)
- `done` cannot be cancelled (it's already terminal)
- `failed` cannot be cancelled (it's already terminal)
- `blocked` can be cancelled

**State enum addition**:
```
status: 'pending' | 'assigned' | 'blocked' | 'running' | 'done' | 'failed' | 'cancelled'
```

---

## 4. Visual Design

### 4.1 Cancelled Status Badge

Reuse existing badge pattern. New variant:

```css
/* In components.css — add after .status-badge--spawning */
.status-badge--cancelled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  .status-badge--cancelled {
    background: rgba(156, 163, 175, 0.2);
    color: #9CA3AF;
  }
}
```

**Rationale**: Muted/grey treatment signals "inactive/abandoned" without the alarm of error red. Consistent with how other apps treat cancelled/abandoned states.

### 4.2 Kanban Column Update

Add a 5th column for cancelled tasks:

```js
const COLUMNS = [
  { key: 'pending',    label: 'Pending',     statuses: ['pending', 'assigned', 'blocked'] },
  { key: 'running',    label: 'In Progress',  statuses: ['running'] },
  { key: 'done',       label: 'Done',         statuses: ['done'] },
  { key: 'failed',     label: 'Failed',       statuses: ['failed'] },
  { key: 'cancelled',  label: 'Cancelled',    statuses: ['cancelled'] },  // NEW
];
```

**Grid update** (pages.css):
```css
.task-columns {
  grid-template-columns: repeat(5, 1fr);  /* was 4 */
}
```

For screens < 1200px, collapse to 3-column layout with horizontal scroll or wrap.

### 4.3 Task Card — Cancelled State

Cancelled task cards get a distinct visual treatment:

```css
/* In pages.css — add after .task-card[draggable]:active */
.task-card--cancelled {
  opacity: 0.6;
  border-style: dashed;
  border-color: var(--color-border);
}

.task-card--cancelled:hover {
  opacity: 0.85;
  border-color: var(--color-text-tertiary);
  box-shadow: none;  /* no elevation on hover */
}
```

### 4.4 Status Color Map Update

In `getStatusColor()`:

```js
case 'cancelled': return 'var(--color-text-tertiary)';
```

---

## 5. Cancel Task Flow

### 5.1 Cancel Action — Entry Points

**A. Task Card Context Menu (right-click)**
- Right-click any task card → context menu with "Cancel task" option
- Only shown for non-terminal statuses

**B. Task Detail Panel (future — not in this spec)**
- Will be added when task detail view exists

**C. Keyboard Shortcut**
- Select task card → press `Delete` or `Backspace` → triggers cancel flow
- ARIA: task cards already have `role="article"` and keyboard handlers

### 5.2 Cancel Confirmation Dialog

**Trigger**: User clicks "Cancel task" on a running/assigned task.

**Design**:

```
┌─────────────────────────────────────────────┐
│  ⚠ Cancel Task                        [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  Are you sure you want to cancel            │
│  "Implement user authentication"?           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ⚠ This task is currently running.   │    │
│  │ The assigned agent will be stopped   │    │
│  │ and any in-progress work may be      │    │
│  │ lost.                                │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Reason for cancellation (optional):        │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│         [ Keep Running ]  [ Cancel Task ]   │
│                              btn--danger    │
└─────────────────────────────────────────────┘
```

**Dialog Specifications**:

| Property | Value |
|----------|-------|
| Width | 440px max |
| Overlay | `rgba(0,0,0,0.5)` + `backdrop-filter: blur(4px)` |
| Z-index | `var(--z-modal)` (300) |
| Border radius | `var(--radius-xl)` (12px) |
| Shadow | `var(--shadow-2xl)` |
| Focus trap | Yes (existing `useFocusTrap` pattern) |
| Escape key | Closes dialog (no action) |
| Click outside | Closes dialog (no action) |

**Warning variant** (shown only when task status is `running`):

```css
/* New alert variant for cancel warning */
.alert--cancel-warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
  border: 1px solid var(--color-warning);
}
```

For `pending`/`assigned` tasks, show a simpler warning:
> "This task has not started yet. Cancelling will remove it from the queue."

### 5.3 Confirmation Dialog — Component Spec

```jsx
// CancelTaskDialog component structure
function CancelTaskDialog({ task, isOpen, onConfirm, onCancel }) {
  const isRunning = task.status === 'running';
  const [reason, setReason] = useState('');

  // ... focus trap, keyboard handling

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
         aria-labelledby="cancel-dialog-title">
      <div className="card" style={{ width: 440, maxWidth: '90vw' }}>
        <div className="card__header">
          <h3 id="cancel-dialog-title" className="card__title">
            Cancel Task
          </h3>
          <button className="btn btn--ghost btn--sm btn--icon"
                  onClick={onCancel} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="card__body">
          <p>Are you sure you want to cancel <strong>"{task.title}"</strong>?</p>

          {isRunning && (
            <div className="alert alert--cancel-warning" role="alert">
              <IconAlertTriangle className="alert__icon" />
              <div className="alert__content">
                <div className="alert__title">Task is currently running</div>
                <div className="alert__description">
                  The assigned agent will be stopped and any in-progress
                  work may be lost.
                </div>
              </div>
            </div>
          )}

          {!isRunning && task.status !== 'pending' && (
            <div className="alert alert--warning" role="alert">
              <IconAlertTriangle className="alert__icon" />
              <div className="alert__content">
                <div className="alert__description">
                  This task is assigned but has not started. Cancelling
                  will remove it from the queue.
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-4)' }}>
            <label htmlFor="cancel-reason" className="form-label">
              Reason (optional)
            </label>
            <textarea
              id="cancel-reason"
              className="form-input"
              style={{ height: 56, resize: 'vertical' }}
              placeholder="Why is this being cancelled?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="card__footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Keep {isRunning ? 'Running' : 'Task'}
          </button>
          <button className="btn btn--danger" onClick={() => onConfirm(reason)}>
            Cancel Task
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.4 Cancel — Backend Contract

IPC call:
```js
await window.agentOps.tasks.cancel(taskId, { reason });
// Internally:
// 1. Kill agent subprocess (SIGTERM → wait 5s → SIGKILL)
// 2. Update task status to 'cancelled'
// 3. Store cancellation reason in task metadata
// 4. Emit 'task:cancelled' event for UI refresh
```

---

## 6. Inline Edit Flow

### 6.1 Task Inline Edit

**Trigger**: Double-click on task title or description in the task card.

**Interaction**:

1. Double-click title → title becomes an editable input field
2. Input inherits current text, selects all on focus
3. `Enter` or click outside → save
4. `Escape` → discard changes
5. While editing, card is not draggable

**Design**:

```
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ Implement user authentication  ▒ │ │  ← input field, auto-focused
│ └──────────────────────────────────┘ │
│ @agent-1234      2m ago              │
│ running                                │
└──────────────────────────────────────┘
```

**CSS**:

```css
/* Inline edit input — matches card text style */
.task-card__title-input {
  width: 100%;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  line-height: var(--leading-normal);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border-focus);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
  outline: none;
  margin: calc(-1 * var(--space-1)) calc(-1 * var(--space-2));
}

.task-card__desc-input {
  width: 100%;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border-focus);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
  outline: none;
  resize: vertical;
  min-height: 40px;
}
```

### 6.2 Goal Inline Edit

Same pattern as task inline edit, applied to goal titles/descriptions wherever they appear (Goals page, task card goal selector, dashboard).

**Double-click behavior**:
- Goal title in list → inline edit
- Goal description in detail → inline edit

### 6.3 Edit Save — Backend Contract

```js
// Task update
await window.agentOps.tasks.update(taskId, {
  title: newTitle,        // optional
  description: newDesc,   // optional
});

// Goal update
await window.agentOps.goals.update(goalId, {
  title: newTitle,        // optional
  description: newDesc,   // optional
});
```

### 6.4 Edit — Keyboard & Accessibility

| Key | Action |
|-----|--------|
| `Enter` | Save (single-line inputs only) |
| `Escape` | Cancel edit, restore original |
| `Cmd/Ctrl + Enter` | Save (multi-line textarea) |
| `Tab` | Save and move focus |
| Click outside | Save |

**ARIA**:
- Input has `aria-label="Edit task title"`
- On save, announce "Task title updated" via `aria-live="polite"` region
- On cancel, announce "Edit cancelled"

---

## 7. Undo Cancel (P1)

Within 30 seconds of cancellation, show a toast with undo option:

```
┌─────────────────────────────────────────────────┐
│  Task cancelled        [ Undo ]          [×]    │
└─────────────────────────────────────────────────┘
```

**Toast spec**:
- Position: bottom-right
- Duration: 5 seconds (auto-dismiss)
- Z-index: `var(--z-toast)` (400)
- Animation: slide up + fade in, `var(--motion-normal)`

**Undo action**: Restores task to its previous status. Only available within the 30s window.

---

## 8. Task Card Component — Updated Structure

```jsx
function TaskCard({ task, onDragStart, onCancel, onUpdate }) {
  const [editing, setEditing] = useState(null); // null | 'title' | 'desc'
  const [editValue, setEditValue] = useState('');

  const isCancelled = task.status === 'cancelled';
  const isTerminal = ['done', 'failed', 'cancelled'].includes(task.status);

  const handleDoubleClick = (field) => {
    if (isTerminal) return;
    setEditing(field);
    setEditValue(field === 'title' ? task.title : task.description || '');
  };

  const handleSave = async () => {
    if (editing && editValue.trim() !== (editing === 'title' ? task.title : task.description)) {
      await onUpdate(task.id, { [editing === 'title' ? 'title' : 'description']: editValue.trim() });
    }
    setEditing(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setEditing(null); }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!isTerminal) {
      // Show context menu with "Cancel task" option
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Cancel task', icon: IconXCircle, action: () => onCancel(task), danger: true },
      ]);
    }
  };

  return (
    <div
      className={`task-card ${isCancelled ? 'task-card--cancelled' : ''}`}
      draggable={!editing}
      tabIndex={0}
      role="article"
      aria-label={`Task: ${task.title}, Status: ${task.status}`}
      onContextMenu={handleContextMenu}
      onDragStart={/* ... */}
    >
      {editing === 'title' ? (
        <input
          className="task-card__title-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          aria-label="Edit task title"
        />
      ) : (
        <div
          className="task-card__title"
          onDoubleClick={() => handleDoubleClick('title')}
          title="Double-click to edit"
        >
          {task.title}
        </div>
      )}

      {/* Meta row — unchanged */}
      <div className="task-card__meta">
        {/* ... */}
      </div>

      {/* Status tag — add cancelled */}
      {task.status !== 'pending' && task.status !== 'done' && (
        <div className="task-card__tags">
          <span className="task-card__tag" style={{ color: getStatusColor(task.status) }}>
            {task.status}
          </span>
        </div>
      )}
    </div>
  );
}
```

---

## 9. New SVG Icons

Add to `designs/icons.svg` sprite sheet:

```xml
<!-- Cancel / X-Circle -->
<symbol id="icon-x-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="15" y1="9" x2="9" y2="15"/>
  <line x1="9" y1="9" x2="15" y2="15"/>
</symbol>

<!-- Edit / Pencil -->
<symbol id="icon-pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
</symbol>

<!-- Alert Triangle (for confirmation) -->
<symbol id="icon-alert-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
  <line x1="12" y1="9" x2="12" y2="13"/>
  <line x1="12" y1="17" x2="12.01" y2="17"/>
</symbol>
```

---

## 10. Responsive Behavior

| Breakpoint | Kanban columns | Edit behavior |
|------------|---------------|---------------|
| ≥ 1200px | 5 columns | Full inline edit |
| 960–1199px | 3 columns (scroll) | Full inline edit |
| < 960px | 2 columns (scroll) | Tap to open edit modal instead of inline |

---

## 11. Accessibility Checklist

- [ ] Cancel dialog has `role="dialog"` and `aria-modal="true"`
- [ ] Cancel dialog title linked with `aria-labelledby`
- [ ] Focus trap on dialog (existing `useFocusTrap` hook)
- [ ] Inline edit inputs have descriptive `aria-label`
- [ ] Status changes announced via `aria-live="polite"` region
- [ ] Keyboard: `Escape` cancels edit, `Enter` saves
- [ ] Context menu keyboard accessible (future: `Shift+F10`)
- [ ] Cancelled task cards still keyboard-focusable
- [ ] Color not sole indicator (cancelled uses text + opacity, not just grey)

---

## 12. Implementation Notes

### Files to modify

| File | Changes |
|------|---------|
| `src/renderer/styles/components.css` | Add `.status-badge--cancelled` |
| `src/renderer/styles/pages.css` | Add `.task-card--cancelled`, `.task-card__title-input`, update `.task-columns` grid |
| `src/renderer/pages/TasksPage.jsx` | Add cancel dialog, inline edit, context menu, cancelled column |
| `src/renderer/styles/tokens.css` | No changes needed (existing tokens sufficient) |
| `src/main/task-orchestrator.js` | Add cancel logic (kill subprocess, update status) |
| `designs/icons.svg` | Add new icon symbols |

### CSS additions summary

```css
/* components.css */
.status-badge--cancelled { ... }

/* pages.css */
.task-card--cancelled { ... }
.task-card--cancelled:hover { ... }
.task-card__title-input { ... }
.task-card__desc-input { ... }
.task-columns { grid-template-columns: repeat(5, 1fr); }
```

---

## 13. Out of Scope (Future Milestones)

- Task detail/panel view with full edit form
- Bulk cancel (select multiple → cancel all)
- Cancel reason analytics/reporting
- Undo stack beyond 30s window
- Goal creation flow changes
- Drag-to-cancel (drag to trash zone)

---

## 14. Design Rationale

| Decision | Why |
|----------|-----|
| Grey/muted for cancelled status | Avoids alarm (red=error) or false positivity (green=done). Signals "inactive" clearly. |
| Confirmation only for running tasks | Pending/assigned tasks have no in-progress work to lose; lightweight confirmation is enough. |
| Double-click for inline edit | Standard desktop pattern. Single-click reserved for selection/drag. |
| 30s undo window | Long enough to catch mistakes, short enough to not create ambiguity about task state. |
| Context menu for cancel | Discoverable without cluttering the card UI with action buttons. |
| Optional cancellation reason | Metadata for team retrospectives without adding friction to the cancel action. |
