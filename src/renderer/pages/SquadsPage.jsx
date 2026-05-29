import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { createRoot } from 'react-dom/client';

const IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconPlay = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconPause = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

const IconActivity = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconTrash = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconUsers = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconRefresh = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

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

function SquadCard({ squad, onStart, onStop, onStatus, onDelete, reactivating, memberProgress }) {
  const members = squad.members || [];
  const memberCount = members.length;
  const statusClass = squad.status === 'running' ? 'squad-card--running' : squad.status === 'error' ? 'squad-card--error' : '';
  const statusLabel = squad.status === 'running' ? 'Running' : squad.status === 'error' ? 'Error' : 'Idle';
  const statusDotClass = squad.status === 'running' ? 'status-dot--running' : squad.status === 'error' ? 'status-dot--error' : 'status-dot--idle';
  const statusDotLabel = squad.status === 'running' ? 'Running' : squad.status === 'error' ? 'Error' : 'Idle';
  const leaderMember = members.find((m) => m.role === 'leader');
  const leaderName = leaderMember ? leaderMember.agentId : 'None';
  const rules = squad.triggerRules || DEFAULT_TRIGGER_RULES;
  const completedCount = memberProgress?.completed || 0;
  const progressTotal = memberProgress?.total || 0;

  return (
    <div className={`squad-card ${statusClass}`} role="listitem" data-squad-id={squad.id}>
      <div className="squad-card__header">
        <div className="squad-card__info">
          <div className="squad-card__name">{squad.name}</div>
          {squad.description && <div className="squad-card__desc">{squad.description}</div>}
        </div>
        <span className={`status-badge status-badge--${squad.status}`}>
          <span className={`status-dot ${statusDotClass}`} role="img" aria-label={statusDotLabel} /> {statusLabel}
        </span>
      </div>
      <div className="squad-card__meta">
        <span className="squad-card__members">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        <span className="squad-card__leader">Leader: {leaderName}</span>
        <span className="squad-card__rules" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          Rules: {rules.on_member_complete} / {rules.on_error} / {rules.on_all_complete}
        </span>
      </div>
      {squad.instructions && (
        <div className="squad-card__instructions" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)', whiteSpace: 'pre-wrap', maxHeight: 48, overflow: 'hidden' }}>
          {squad.instructions}
        </div>
      )}
      {(reactivating || progressTotal > 0) && (
        <div className="squad-card__activity" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
          {reactivating && (
            <span className="squad-reactivating" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', fontWeight: 500 }}>
              <span className="spin"><IconRefresh /></span>
              Leader reactivating
            </span>
          )}
          {progressTotal > 0 && (
            <span style={{ color: 'var(--color-text-tertiary)' }}>
              {completedCount}/{progressTotal} members done
            </span>
          )}
        </div>
      )}
      <div className="squad-card__actions">
        <button
          className="btn btn--ghost btn--sm"
          data-action="start"
          title="Batch start"
          disabled={squad.status === 'running'}
          onClick={() => onStart(squad.id)}
        >
          <IconPlay /> Start
        </button>
        <button
          className="btn btn--ghost btn--sm"
          data-action="stop"
          title="Batch stop"
          disabled={squad.status !== 'running'}
          onClick={() => onStop(squad.id)}
        >
          <IconPause /> Stop
        </button>
        <button
          className="btn btn--ghost btn--sm"
          data-action="status"
          title="Status"
          onClick={() => onStatus(squad.id)}
        >
          <IconActivity /> Status
        </button>
        <button
          className="btn btn--danger btn--sm"
          data-action="delete"
          title="Delete squad"
          onClick={() => onDelete(squad.id, squad.name)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

const DEFAULT_TRIGGER_RULES = {
  on_member_complete: 'continue',
  on_error: 'fail-fast',
  on_all_complete: 'idle',
};

function TriggerRulesEditor({ rules, onChange }) {
  const set = (key, value) => onChange({ ...rules, [key]: value });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        On member complete
        <select style={{ width: '100%', marginTop: 4 }} value={rules.on_member_complete} onChange={(e) => set('on_member_complete', e.target.value)}>
          <option value="continue">Continue</option>
          <option value="pause">Pause squad</option>
          <option value="notify">Notify only</option>
        </select>
      </label>
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        On error
        <select style={{ width: '100%', marginTop: 4 }} value={rules.on_error} onChange={(e) => set('on_error', e.target.value)}>
          <option value="fail-fast">Fail fast</option>
          <option value="continue">Continue</option>
          <option value="pause">Pause squad</option>
        </select>
      </label>
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        On all complete
        <select style={{ width: '100%', marginTop: 4 }} value={rules.on_all_complete} onChange={(e) => set('on_all_complete', e.target.value)}>
          <option value="idle">Set idle</option>
          <option value="archive">Archive</option>
          <option value="notify">Notify only</option>
        </select>
      </label>
    </div>
  );
}

function CreateSquadModal({ isOpen, onClose, onSave, agents }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [triggerRules, setTriggerRules] = useState(DEFAULT_TRIGGER_RULES);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const toggleMember = (agentId) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        leaderId: leaderId || null,
        instructions: instructions.trim() || null,
        triggerRules,
        members: Array.from(selectedMembers),
      });
      setName('');
      setDescription('');
      setLeaderId('');
      setInstructions('');
      setTriggerRules(DEFAULT_TRIGGER_RULES);
      setSelectedMembers(new Set());
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="modal-overlay"
      id="squad-modal-overlay"
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="squad-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="card__header">
          <h3 className="card__title" id="squad-modal-title">New squad</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="squad-name" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Squad name
            </label>
            <input
              type="text"
              id="squad-name"
              placeholder="e.g. Frontend Team"
              style={{ width: '100%' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="squad-desc" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Description
            </label>
            <textarea
              id="squad-desc"
              placeholder="What does this squad do?"
              style={{ width: '100%', height: 56, resize: 'vertical' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="squad-leader" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Squad leader
            </label>
            <select
              id="squad-leader"
              style={{ width: '100%' }}
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
            >
              <option value="">No leader</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="squad-instructions" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Leader instructions
            </label>
            <textarea
              id="squad-instructions"
              placeholder="System prompt injected into the leader agent at spawn time. Describe delegation rules, routing logic, or team conventions."
              style={{ width: '100%', height: 80, resize: 'vertical' }}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Trigger Rules
            </label>
            <TriggerRulesEditor rules={triggerRules} onChange={setTriggerRules} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Members
            </label>
            <div
              id="squad-member-checkboxes"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 160, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              {agents.length === 0 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  No agents available. Add agents first.
                </div>
              ) : (
                agents.map((a) => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(a.id)}
                      onChange={() => toggleMember(a.id)}
                      className="squad-member-cb"
                    />
                    <span>{a.name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{a.type || 'custom'}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="card__footer">
          <button className="btn btn--secondary" id="squad-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" id="squad-modal-save" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create squad'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SquadsPage() {
  const [squads, setSquads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactivatingSquads, setReactivatingSquads] = useState(new Set());
  const [memberProgress, setMemberProgress] = useState({});
  const reactivatingTimers = useRef({});

  const loadSquads = useCallback(async () => {
    try {
      const result = await window.agentOps.squads.list();
      setSquads(result?.items || result || []);
    } catch {
      // IPC not available
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const list = await window.agentOps.agents.list();
      setAgents(list || []);
    } catch {
      // IPC not available
    }
  }, []);

  useEffect(() => {
    loadSquads();
    loadAgents();
  }, [loadSquads, loadAgents]);

  // Listen for squad events (leader reactivation, member completion)
  useEffect(() => {
    if (!window.agentOps?.squads?.onEvent) return;
    const unsubscribe = window.agentOps.squads.onEvent((event) => {
      if (event.type === 'leader-reactivated' && event.squadId) {
        setReactivatingSquads((prev) => new Set([...prev, event.squadId]));
        // Clear after 3s
        clearTimeout(reactivatingTimers.current[event.squadId]);
        reactivatingTimers.current[event.squadId] = setTimeout(() => {
          setReactivatingSquads((prev) => {
            const next = new Set(prev);
            next.delete(event.squadId);
            return next;
          });
        }, 3000);
      }
      if (event.type === 'member-complete' && event.squadId) {
        setMemberProgress((prev) => {
          const squad = prev[event.squadId] || { completed: 0, total: 0 };
          return { ...prev, [event.squadId]: { ...squad, completed: squad.completed + 1 } };
        });
      }
      if (event.type === 'member-spawned' && event.squadId) {
        setMemberProgress((prev) => {
          const squad = prev[event.squadId] || { completed: 0, total: 0 };
          return { ...prev, [event.squadId]: { ...squad, total: squad.total + 1 } };
        });
      }
    });
    return () => {
      unsubscribe?.();
      Object.values(reactivatingTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleCreate = async ({ name, description, leaderId, members }) => {
    await window.agentOps.squads.create({ name, description, leaderId, members });
    setModalOpen(false);
    await loadSquads();
    showToast('Squad created', 'success');
  };

  const handleStart = async (id) => {
    try {
      await window.agentOps.squads.batchStart(id);
      await loadSquads();
      showToast('Squad started', 'success');
    } catch (err) {
      showToast(`Start failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleStop = async (id) => {
    try {
      await window.agentOps.squads.batchStop(id);
      await loadSquads();
      showToast('Squad stopped', 'success');
    } catch (err) {
      showToast(`Stop failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleStatus = async (id) => {
    try {
      const status = await window.agentOps.squads.aggregatedStatus(id);
      const agentLines = (status.agents || []).map((a) => `${a.name}: ${a.status}`).join(', ');
      showToast(`Squad "${status.squadName}" — ${status.status} | ${agentLines}`);
    } catch (err) {
      showToast(`Status failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id, squadName) => {
    if (!confirm(`Delete "${squadName}"? This will remove the squad and all member associations.`)) return;
    try {
      await window.agentOps.squads.delete(id);
      await loadSquads();
      showToast('Squad deleted', 'success');
    } catch (err) {
      showToast(`Delete failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Squads</h1>
          <p className="page-header__desc">Organize agents into teams</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" id="btn-add-squad" onClick={() => setModalOpen(true)}>
            <IconPlus /> New Squad
          </button>
        </div>
      </div>

      <div className="squad-list" id="squad-list" role="list" aria-label="Squad list" aria-live="polite">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state__title">Loading...</div>
          </div>
        ) : squads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconUsers /></div>
            <div className="empty-state__title">No squads configured</div>
            <div className="empty-state__desc">Create a squad to group agents for batch operations.</div>
            <button className="btn btn--primary" id="btn-add-squad-empty" onClick={() => setModalOpen(true)}>
              <IconPlus /> New Squad
            </button>
          </div>
        ) : (
          squads.map((squad) => (
            <SquadCard
              key={squad.id}
              squad={squad}
              onStart={handleStart}
              onStop={handleStop}
              onStatus={handleStatus}
              onDelete={handleDelete}
              reactivating={reactivatingSquads.has(squad.id)}
              memberProgress={memberProgress[squad.id]}
            />
          ))
        )}
      </div>

      <CreateSquadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        agents={agents}
      />
    </>
  );
}

export function mountSquadsPage(container) {
  const root = createRoot(container);
  root.render(<SquadsPage />);
  return () => root.unmount();
}
