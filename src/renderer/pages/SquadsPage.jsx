import { useState, useEffect, useCallback } from 'react';
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

function SquadCard({ squad, onStart, onStop, onStatus, onDelete }) {
  const members = squad.members || [];
  const memberCount = members.length;
  const statusClass = squad.status === 'running' ? 'squad-card--running' : squad.status === 'error' ? 'squad-card--error' : '';
  const statusLabel = squad.status === 'running' ? 'Running' : squad.status === 'error' ? 'Error' : 'Idle';
  const statusDotClass = squad.status === 'running' ? 'status-dot--running' : squad.status === 'error' ? 'status-dot--error' : 'status-dot--idle';
  const leaderMember = members.find((m) => m.role === 'leader');
  const leaderName = leaderMember ? leaderMember.agentId : 'None';

  return (
    <div className={`squad-card ${statusClass}`} role="listitem" data-squad-id={squad.id}>
      <div className="squad-card__header">
        <div className="squad-card__info">
          <div className="squad-card__name">{squad.name}</div>
          {squad.description && <div className="squad-card__desc">{squad.description}</div>}
        </div>
        <span className={`status-badge status-badge--${squad.status}`}>
          <span className={`status-dot ${statusDotClass}`} /> {statusLabel}
        </span>
      </div>
      <div className="squad-card__meta">
        <span className="squad-card__members">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        <span className="squad-card__leader">Leader: {leaderName}</span>
      </div>
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

function CreateSquadModal({ isOpen, onClose, onSave, agents }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [saving, setSaving] = useState(false);

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
        members: Array.from(selectedMembers),
      });
      setName('');
      setDescription('');
      setLeaderId('');
      setSelectedMembers(new Set());
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      id="squad-modal-overlay"
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog"
      aria-modal="true"
      aria-label="New Squad"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
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
              onKeyDown={handleKeyDown}
              autoFocus
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
              onKeyDown={handleKeyDown}
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
