import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// SVG icons matching existing design
export const IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconRefresh = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const IconTrash = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconBot = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="6" y="14" width="12" height="8" rx="2" ry="2" /><path d="M12 16v4" />
  </svg>
);

const AGENT_TYPES = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini CLI' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'custom', label: 'Custom' },
];

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

export function AgentRow({ agent, onHealthCheck, onDelete }) {
  const statusLabels = { running: 'Running', idle: 'Idle', error: 'Error', spawning: 'Spawning' };
  return (
    <div className="agent-row" data-agent-id={agent.id} role="listitem" tabIndex={0} aria-label={`Agent: ${agent.name}, Status: ${agent.status}`}>
      <span className={`status-dot status-dot--${agent.status}`} role="img" aria-label={statusLabels[agent.status] || agent.status} />
      <div className="agent-row__info">
        <div className="agent-row__name">{agent.name}</div>
        <div className="agent-row__type">{agent.type || 'unknown'}</div>
        {agent.status === 'error' && (
          <div className="agent-row__error" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
            Agent encountered an error. Check executable path and try a health check.
          </div>
        )}
      </div>
      <span className={`status-badge status-badge--${agent.status}`}>{agent.status}</span>
      <div className="agent-row__actions">
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Health check"
          aria-label="Health check"
          onClick={() => onHealthCheck(agent.id)}
        >
          <IconRefresh />
        </button>
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Remove"
          aria-label="Remove agent"
          onClick={() => onDelete(agent.id, agent.name)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

export function AddAgentModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('claude');
  const [execPath, setExecPath] = useState('');
  const [cwd, setCwd] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type, execPath: execPath.trim(), cwd: cwd.trim() });
      setName('');
      setType('claude');
      setExecPath('');
      setCwd('');
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
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === e.currentTarget) onClose(); } }}
    >
      <div className="card" style={{ width: 440, maxWidth: '90vw' }}>
        <div className="card__header">
          <h3 className="card__title" id="modal-title">Add agent</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="agent-name" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Agent name
            </label>
            <input
              type="text"
              id="agent-name"
              placeholder="e.g. Claude Code"
              style={{ width: '100%' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="agent-type" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Agent type
            </label>
            <select
              id="agent-type"
              style={{ width: '100%' }}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {AGENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="agent-path" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Executable path
            </label>
            <input
              type="text"
              id="agent-path"
              placeholder="/usr/local/bin/claude"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono-sm)' }}
              value={execPath}
              onChange={(e) => setExecPath(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="agent-cwd" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Working directory
            </label>
            <input
              type="text"
              id="agent-cwd"
              placeholder="/path/to/project"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono-sm)' }}
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
            />
          </div>
        </div>
        <div className="card__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Adding...' : 'Add agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

function showToast(message, type = 'info') {
  try { window.showToast?.(message, type); } catch { /* noop */ }
}

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    try {
      const list = await window.agentOps.agents.list();
      setAgents(list);
    } catch {
      // IPC not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreate = async ({ name, type, execPath, cwd }) => {
    await window.agentOps.agents.create({ name, type, execPath, cwd });
    setModalOpen(false);
    await loadAgents();
  };

  const handleHealthCheck = async (id) => {
    try {
      await window.agentOps.agents.healthCheck(id);
      await loadAgents();
    } catch (err) {
      showToast(`Health check failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id, agentName) => {
    if (!confirm(`Remove "${agentName}"? This action cannot be undone.`)) return;
    try {
      await window.agentOps.agents.delete(id);
      await loadAgents();
      showToast('Agent removed', 'success');
    } catch (err) {
      showToast(`Failed to remove agent: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Agents</h1>
          <p className="page-header__desc">Manage connected CLI agents</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
            <IconPlus /> Add agent
          </button>
        </div>
      </div>

      <div className="agent-list" role="list" aria-label="Agent list" aria-live="polite">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state__title">Loading...</div>
          </div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconBot /></div>
            <div className="empty-state__title">No agents configured</div>
            <div className="empty-state__desc">Add a CLI agent to start orchestrating tasks.</div>
            <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
              <IconPlus /> Add agent
            </button>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onHealthCheck={handleHealthCheck}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <AddAgentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </>
  );
}

/** Mount the React Agents page into a container element */
export function mountAgentsPage(container) {
  const root = createRoot(container);
  root.render(<AgentsPage />);
  return () => root.unmount();
}
