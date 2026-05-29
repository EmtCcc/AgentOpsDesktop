import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const COLUMNS = [
  { key: 'pending',   label: 'Pending',    statuses: ['pending', 'assigned', 'blocked'] },
  { key: 'running',   label: 'In Progress', statuses: ['running'] },
  { key: 'done',      label: 'Done',        statuses: ['done'] },
  { key: 'failed',    label: 'Failed',      statuses: ['failed'] },
];

// ── Icons ──

const _IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const _IconRefresh = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const _IconSearch = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const _IconClock = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const _IconUser = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

// ── Helpers ──

function useFocusTrap(isOpen, onClose) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    first?.focus();

    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return modalRef;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function getStatusColor(status) {
  switch (status) {
    case 'pending':   return 'var(--color-warning)';
    case 'assigned':  return 'var(--color-info, #3b82f6)';
    case 'blocked':   return 'var(--color-danger)';
    case 'running':   return 'var(--color-primary)';
    case 'done':      return 'var(--color-success)';
    case 'failed':    return 'var(--color-danger)';
    default:          return 'var(--color-text-tertiary)';
  }
}

// ── Task Card ──

function _TaskCard({ task, onDragStart }) {
  return (
    <div
      className="task-card"
      draggable
      tabIndex={0}
      role="article"
      aria-label={`Task: ${task.title}, Status: ${task.status}`}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Could trigger task detail view
        }
      }}
    >
      <div className="task-card__title">{task.title}</div>
      <div className="task-card__meta">
        <span className="task-card__agent" title={task.assigneeAgentId || 'Unassigned'}>
          <_IconUser />
          {task.assigneeAgentId ? task.assigneeAgentId.slice(0, 8) : 'unassigned'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <_IconClock />
          {formatTime(task.createdAt)}
        </span>
      </div>
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

// ── Kanban Column ──

function _KanbanColumn({ column, tasks, _draggedId, onDrop, onDragOver, onDragLeave, isOver }) {
  return (
    <div
      className="task-column"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="task-column__header">
        <span className="task-column__title">
          {column.label}
          <span className="task-column__count">{tasks.length}</span>
        </span>
      </div>
      <div
        className="task-column__cards"
        style={{
          minHeight: 60,
          background: isOver ? 'var(--color-bg-hover, rgba(99,102,241,0.08))' : undefined,
          borderRadius: 'var(--radius-md)',
          transition: 'background 0.15s ease',
        }}
      >
        {tasks.length === 0 ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', padding: 'var(--space-3)', textAlign: 'center' }}>
            No tasks
          </div>
        ) : (
          tasks.map((t) => (
            <_TaskCard key={t.id} task={t} onDragStart={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Create Task Modal ──

function _CreateTaskModal({ isOpen, onClose, onSave, agents, goals }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [agentId, setAgentId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: desc.trim(),
        assigneeAgentId: agentId || undefined,
        goalId: goalId || undefined,
      });
      setTitle('');
      setDesc('');
      setAgentId('');
      setGoalId('');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="modal-overlay"
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      tabIndex={0}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === e.currentTarget) onClose(); } }}
    >
      <div className="card" style={{ width: 480, maxWidth: '90vw' }}>
        <div className="card__header">
          <h3 className="card__title" id="task-modal-title">New task</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="task-title" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Title</label>
            <input
              type="text"
              id="task-title"
              placeholder="Implement user auth"
              style={{ width: '100%' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="task-desc" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Description</label>
            <textarea
              id="task-desc"
              placeholder="Details about the task..."
              style={{ width: '100%', height: 72, resize: 'vertical' }}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="task-agent" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Assign to agent</label>
            <select id="task-agent" style={{ width: '100%' }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="task-goal" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Goal (optional)</label>
            <select id="task-goal" style={{ width: '100%' }} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        </div>
        <div className="card__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TasksPage ──

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [draggedId, setDraggedId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const list = await window.agentOps.tasks.list();
      setTasks(list);
    } catch {
      // IPC not available
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    try {
      const [agentList, goalList] = await Promise.all([
        window.agentOps.agents.list().catch(() => []),
        window.agentOps.goals.list().catch(() => []),
      ]);
      setAgents(agentList);
      setGoals(goalList);
    } catch {
      // IPC not available
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadDropdowns();
  }, [loadTasks, loadDropdowns]);

  const handleCreate = async (taskData) => {
    await window.agentOps.tasks.create(taskData);
    setModalOpen(false);
    await loadTasks();
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await window.agentOps.tasks.update(taskId, { status: newStatus });
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  // ── Drag and Drop ──

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setOverColumn(null);
  };

  const handleDrop = (e, columnKey) => {
    e.preventDefault();
    setOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const targetColumn = COLUMNS.find((c) => c.key === columnKey);
    if (!targetColumn) return;

    // Map column to a representative status (first status in the group)
    const newStatus = targetColumn.statuses[0];
    handleStatusChange(taskId, newStatus);
    setDraggedId(null);
  };

  // ── Filtering ──

  const filteredTasks = tasks.filter((t) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
    }
    if (filterAgent && t.assigneeAgentId !== filterAgent) return false;
    return true;
  });

  // Group tasks into columns
  const columnTasks = {};
  COLUMNS.forEach((col) => {
    columnTasks[col.key] = filteredTasks.filter((t) => col.statuses.includes(t.status));
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Tasks</h1>
          <p className="page-header__desc">Kanban board &mdash; drag tasks between columns to update status</p>
        </div>
        <div className="page-header__actions" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
              <_IconSearch />
            </span>
            <input
              type="text"
              placeholder="Search tasks..."
              style={{ height: 28, fontSize: 'var(--text-xs)', paddingLeft: 28, width: 160 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <select
            style={{ height: 28, fontSize: 'var(--text-xs)' }}
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
          >
            <option value="">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="btn btn--ghost btn--sm" onClick={loadTasks} title="Refresh">
            <_IconRefresh /> Refresh
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
            <_IconPlus /> New task
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-tertiary)' }}>
          Loading tasks...
        </div>
      ) : (
        <div className="task-columns">
          {COLUMNS.map((col) => (
            <_KanbanColumn
              key={col.key}
              column={col}
              tasks={columnTasks[col.key]}
              draggedId={draggedId}
              isOver={overColumn === col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            />
          ))}
        </div>
      )}

      <_CreateTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        agents={agents}
        goals={goals}
      />
    </>
  );
}

/** Mount the React Tasks page into a container element */
export function mountTasksPage(container) {
  const root = createRoot(container);
  root.render(<TasksPage />);
  return () => root.unmount();
}
