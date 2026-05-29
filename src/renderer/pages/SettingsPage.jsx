import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// ── Icons ──

const _IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const _IconRefresh = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const _IconTrash = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const _IconPlug = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const _IconDollar = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

// ── Helper ──

function showToast(message, type = 'success') {
  try { window.showToast?.(message, type); } catch { /* noop */ }
}

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

// ── General Section ──

function _GeneralSection({ _settings, _onChange }) {
  const version = window.agentOps?.version || '0.1.0';
  const platform = window.agentOps?.platform || 'unknown';

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">General</h3>
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">App version</div>
          <div className="settings-row__desc">Current build version</div>
        </div>
        <div className="settings-row__control">
          <span className="badge">v{version}</span>
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Platform</div>
          <div className="settings-row__desc">Operating system</div>
        </div>
        <div className="settings-row__control">
          <span className="badge">{platform}</span>
        </div>
      </div>
    </div>
  );
}

// ── Agent Preferences Section ──

function _AgentPreferencesSection({ settings, onChange }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Agents</h3>
      <div className="settings-row">
        <div className="settings-row__info">
          <label className="settings-row__label" htmlFor="setting-max-agents">Max parallel agents</label>
          <div className="settings-row__desc">Maximum number of agents running simultaneously</div>
        </div>
        <div className="settings-row__control">
          <input
            type="number"
            id="setting-max-agents"
            value={settings.maxParallelAgents ?? 3}
            min={1}
            max={10}
            style={{ width: 64, textAlign: 'center' }}
            onChange={(e) => onChange('maxParallelAgents', parseInt(e.target.value) || 3)}
          />
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row__info">
          <label className="settings-row__label" htmlFor="setting-task-timeout">Task timeout</label>
          <div className="settings-row__desc">Default timeout for agent tasks (minutes)</div>
        </div>
        <div className="settings-row__control">
          <input
            type="number"
            id="setting-task-timeout"
            value={settings.taskTimeout ?? 30}
            min={1}
            max={480}
            style={{ width: 64, textAlign: 'center' }}
            onChange={(e) => onChange('taskTimeout', parseInt(e.target.value) || 30)}
          />
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row__info">
          <label className="settings-row__label" htmlFor="setting-log-retention">Log retention</label>
          <div className="settings-row__desc">Number of log entries to keep in memory</div>
        </div>
        <div className="settings-row__control">
          <input
            type="number"
            id="setting-log-retention"
            value={settings.logRetention ?? 10000}
            min={1000}
            max={100000}
            step={1000}
            style={{ width: 80, textAlign: 'center' }}
            onChange={(e) => onChange('logRetention', parseInt(e.target.value) || 10000)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Adapter Row ──

function _AdapterRow({ adapter, onToggle, onHealthCheck, onDelete }) {
  return (
    <div className="agent-row" data-adapter-id={adapter.id} role="listitem" tabIndex={0} aria-label={`Adapter: ${adapter.name || adapter.type}, ${adapter.enabled ? 'Enabled' : 'Disabled'}`}>
      <span className={`status-dot status-dot--${adapter.enabled ? 'online' : 'offline'}`} role="img" aria-label={adapter.enabled ? 'Enabled' : 'Disabled'} />
      <div className="agent-row__info">
        <div className="agent-row__name">{adapter.name || adapter.type}</div>
        <div className="agent-row__type">{adapter.type}</div>
      </div>
      <span className={`status-badge status-badge--${adapter.enabled ? 'online' : 'offline'}`}>
        {adapter.enabled ? 'enabled' : 'disabled'}
      </span>
      <div className="agent-row__actions">
        <button
          className={`btn btn--ghost btn--sm btn--icon`}
          title={adapter.enabled ? 'Disable' : 'Enable'}
          aria-label={adapter.enabled ? 'Disable adapter' : 'Enable adapter'}
          onClick={() => onToggle(adapter.id, !adapter.enabled)}
        >
          {adapter.enabled ? (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="5" width="22" height="14" rx="7" ry="7" /><circle cx="16" cy="12" r="3" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="5" width="22" height="14" rx="7" ry="7" /><circle cx="8" cy="12" r="3" />
            </svg>
          )}
        </button>
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Health check"
          aria-label="Health check"
          onClick={() => onHealthCheck(adapter.id)}
        >
          <IconRefresh />
        </button>
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Remove"
          aria-label="Remove adapter"
          onClick={() => onDelete(adapter.id, adapter.name || adapter.type)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

// ── Adapter Section ──

function _AdapterSection() {
  const [adapters, setAdapters] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAdapters = useCallback(async () => {
    try {
      const list = await window.agentOps.adapters.list();
      setAdapters(list);
    } catch {
      // IPC not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdapters(); }, [loadAdapters]);

  const handleToggle = async (id, enabled) => {
    try {
      await window.agentOps.adapters.update(id, { enabled });
      await loadAdapters();
      showToast(enabled ? 'Adapter enabled' : 'Adapter disabled');
    } catch (err) {
      showToast(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleHealthCheck = async (id) => {
    try {
      await window.agentOps.adapters.healthCheck(id);
      await loadAdapters();
      showToast('Health check passed');
    } catch (err) {
      showToast(`Health check failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove adapter "${name}"? This action cannot be undone.`)) return;
    try {
      await window.agentOps.adapters.delete(id);
      await loadAdapters();
      showToast('Adapter removed');
    } catch (err) {
      showToast(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h3 className="settings-section__title" style={{ marginBottom: 0 }}>Adapter Configuration</h3>
      </div>
      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading...</div>
      ) : adapters.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-4) 0' }}>
          No adapters configured. Agents use adapters to connect to CLI tools.
        </div>
      ) : (
        <div role="list" aria-label="Adapter list">
          {adapters.map((adapter) => (
            <_AdapterRow
              key={adapter.id}
              adapter={adapter}
              onToggle={handleToggle}
              onHealthCheck={handleHealthCheck}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Budget Row ──

function _BudgetRow({ budget, onEdit, onDelete }) {
  const pct = budget.monthlyLimit > 0
    ? Math.min(100, Math.round((budget.currentSpend || 0) / budget.monthlyLimit * 100))
    : 0;
  const barColor = pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div className="agent-row" data-budget-id={budget.id} role="listitem" tabIndex={0} aria-label={`Budget for ${budget.agentId}: ${pct}% used`}>
      <div className="agent-row__info" style={{ flex: 1 }}>
        <div className="agent-row__name">{budget.agentId}</div>
        <div className="agent-row__type">
          ${(budget.currentSpend || 0).toFixed(2)} / ${budget.monthlyLimit?.toFixed(2) || '0.00'} {budget.currency || 'USD'}
        </div>
        <div style={{ marginTop: 'var(--space-2)', height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <span className="badge" style={{ color: barColor }}>{pct}%</span>
      <div className="agent-row__actions">
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Edit budget"
          aria-label="Edit budget"
          onClick={() => onEdit(budget)}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          className="btn btn--ghost btn--sm btn--icon"
          title="Delete budget"
          aria-label="Delete budget"
          onClick={() => onDelete(budget.id, budget.agentId)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

// ── Budget Modal ──

function _BudgetModal({ isOpen, budget, onClose, onSave }) {
  const [agentId, setAgentId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [warnPct, setWarnPct] = useState('80');
  const [pausePct, setPausePct] = useState('95');
  const [saving, setSaving] = useState(false);
  const isEdit = !!budget;
  const modalRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (budget) {
      setAgentId(budget.agentId || '');
      setMonthlyLimit(String(budget.monthlyLimit || ''));
      setCurrency(budget.currency || 'USD');
      setWarnPct(String(budget.warnPct ?? '80'));
      setPausePct(String(budget.pausePct ?? '95'));
    } else {
      setAgentId('');
      setMonthlyLimit('');
      setCurrency('USD');
      setWarnPct('80');
      setPausePct('95');
    }
  }, [budget, isOpen]);

  const handleSave = async () => {
    if (!agentId.trim() || !monthlyLimit) return;
    setSaving(true);
    try {
      await onSave({
        agentId: agentId.trim(),
        monthlyLimit: parseFloat(monthlyLimit),
        currency,
        warnPct: parseInt(warnPct) || 80,
        pausePct: parseInt(pausePct) || 95,
      });
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
      aria-labelledby="budget-modal-title"
      tabIndex={0}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === e.currentTarget) onClose(); } }}
    >
      <div className="card" style={{ width: 440, maxWidth: '90vw' }}>
        <div className="card__header">
          <h3 className="card__title" id="budget-modal-title">{isEdit ? 'Edit budget' : 'Create budget'}</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="budget-agent" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Agent ID
            </label>
            <input
              type="text"
              id="budget-agent"
              placeholder="agent-uuid"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono-sm)' }}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={isEdit}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="budget-limit" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
              Monthly limit
            </label>
            <input
              type="number"
              id="budget-limit"
              placeholder="100.00"
              min={0}
              step={0.01}
              style={{ width: '100%' }}
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="budget-warn" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                Warn at %
              </label>
              <input
                type="number"
                id="budget-warn"
                min={1}
                max={100}
                style={{ width: '100%' }}
                value={warnPct}
                onChange={(e) => setWarnPct(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="budget-pause" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                Pause at %
              </label>
              <input
                type="number"
                id="budget-pause"
                min={1}
                max={100}
                style={{ width: '100%' }}
                value={pausePct}
                onChange={(e) => setPausePct(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="card__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !agentId.trim() || !monthlyLimit}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create budget'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Budget Section ──

function _BudgetSection() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  const loadBudgets = useCallback(async () => {
    try {
      const list = await window.agentOps.cost.listBudgets();
      setBudgets(list);
    } catch {
      // IPC not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const handleCreate = async (data) => {
    await window.agentOps.cost.createBudget(data);
    setModalOpen(false);
    await loadBudgets();
    showToast('Budget created');
  };

  const handleEdit = async (data) => {
    await window.agentOps.cost.updateBudget(editingBudget.id, data);
    setModalOpen(false);
    setEditingBudget(null);
    await loadBudgets();
    showToast('Budget updated');
  };

  const handleDelete = async (id, agentId) => {
    if (!confirm(`Delete budget for "${agentId}"?`)) return;
    try {
      await window.agentOps.cost.deleteBudget(id);
      await loadBudgets();
      showToast('Budget deleted');
    } catch (err) {
      showToast(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const openEdit = (budget) => {
    setEditingBudget(budget);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingBudget(null);
    setModalOpen(true);
  };

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h3 className="settings-section__title" style={{ marginBottom: 0 }}>Budget Management</h3>
        <button className="btn btn--primary btn--sm" onClick={openCreate}>
          <IconPlus /> Add budget
        </button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading...</div>
      ) : budgets.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-4) 0' }}>
          No budgets configured. Set spending limits per agent to control costs.
        </div>
      ) : (
        <div role="list" aria-label="Budget list">
          {budgets.map((budget) => (
            <_BudgetRow
              key={budget.id}
              budget={budget}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      <_BudgetModal
        isOpen={modalOpen}
        budget={editingBudget}
        onClose={() => { setModalOpen(false); setEditingBudget(null); }}
        onSave={editingBudget ? handleEdit : handleCreate}
      />
    </div>
  );
}

// ── Software Update Section ──

function _SoftwareUpdateSection() {
  const version = window.agentOps?.version || '0.1.0';
  const [status, setStatus] = useState('idle'); // idle | checking | available | downloading | downloaded | not-available | error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [deferred, setDeferred] = useState(false);
  const unsubsRef = useRef([]);

  useEffect(() => {
    const unsubs = unsubsRef.current;
    const api = window.agentOps?.update;
    if (!api) return;

    unsubs.push(api.onChecking(() => {
      setStatus('checking');
      setError(null);
    }));
    unsubs.push(api.onAvailable((info) => {
      setStatus('available');
      setUpdateInfo(info);
      setDeferred(false);
    }));
    unsubs.push(api.onNotAvailable(() => {
      setStatus('not-available');
    }));
    unsubs.push(api.onProgress((p) => {
      setStatus('downloading');
      setProgress(p);
    }));
    unsubs.push(api.onDownloaded((info) => {
      setStatus('downloaded');
      setUpdateInfo((prev) => ({ ...prev, ...info }));
      setProgress(null);
    }));
    unsubs.push(api.onError((err) => {
      setStatus('error');
      setError(err?.message || 'Unknown error');
    }));

    return () => { unsubs.forEach((u) => u()); };
  }, []);

  const handleCheck = async () => {
    try {
      await window.agentOps.update.check();
    } catch {
      showToast('Failed to check for updates', 'error');
    }
  };

  const handleDownload = async () => {
    try {
      await window.agentOps.update.download();
    } catch {
      showToast('Failed to download update', 'error');
    }
  };

  const handleInstall = () => {
    window.agentOps.update.install();
  };

  const handleDefer = async () => {
    if (updateInfo?.version) {
      await window.agentOps.update.defer(updateInfo.version);
      setDeferred(true);
      setStatus('idle');
      showToast(`Update to v${updateInfo.version} deferred`, 'success');
    }
  };

  const handleClearDefer = async () => {
    await window.agentOps.update.clearDefer();
    setDeferred(false);
    showToast('Update deferral cleared', 'success');
  };

  const statusLabel = {
    idle: deferred ? 'Deferred' : 'Up to date',
    checking: 'Checking...',
    available: 'Update available',
    downloading: 'Downloading...',
    downloaded: 'Ready to install',
    'not-available': 'Up to date',
    error: 'Check failed',
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Software Updates</h3>
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Current version</div>
          <div className="settings-row__desc">Installed build</div>
        </div>
        <div className="settings-row__control">
          <span className="badge">v{version}</span>
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Status</div>
          <div className="settings-row__desc">
            {statusLabel[status] || status}
            {updateInfo?.version && (status === 'available' || status === 'downloading' || status === 'downloaded') && (
              <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-primary)' }}>v{updateInfo.version}</span>
            )}
          </div>
        </div>
        <div className="settings-row__control" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(status === 'idle' || status === 'not-available' || status === 'error' || status === 'checking') && (
            <button className="btn btn--secondary btn--sm" onClick={handleCheck} disabled={status === 'checking'}>
              {status === 'checking' ? 'Checking...' : 'Check for updates'}
            </button>
          )}
          {status === 'available' && (
            <>
              <button className="btn btn--primary btn--sm" onClick={handleDownload}>Download</button>
              <button className="btn btn--ghost btn--sm" onClick={handleDefer}>Defer</button>
            </>
          )}
          {status === 'downloading' && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {progress ? `${Math.round(progress.percent)}%` : 'Starting...'}
            </span>
          )}
          {status === 'downloaded' && (
            <button className="btn btn--primary btn--sm" onClick={handleInstall}>Install & Restart</button>
          )}
        </div>
      </div>
      {status === 'downloading' && progress && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${progress.percent}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
            <span>{formatBytes(progress.bytesPerSecond)}/s</span>
          </div>
        </div>
      )}
      {status === 'error' && error && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
      {deferred && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Update deferred. It will not be shown again until you check manually.
          </span>
          <button className="btn btn--ghost btn--sm" onClick={handleClearDefer}>Clear</button>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ── Telemetry Section ──

function _TelemetrySection() {
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.agentOps.telemetry.stats();
        setEnabled(data.enabled);
        setStats(data);
      } catch {
        // IPC not available
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await window.agentOps.telemetry.setEnabled(next);
      showToast(next ? 'Telemetry enabled' : 'Telemetry disabled and data cleared');
      // Refresh stats
      const data = await window.agentOps.telemetry.stats();
      setStats(data);
    } catch {
      showToast('Failed to update telemetry setting', 'error');
      setEnabled(!next);
    }
  };

  const handleClear = async () => {
    if (!confirm('Delete all collected telemetry data? This cannot be undone.')) return;
    try {
      await window.agentOps.telemetry.clearData();
      const data = await window.agentOps.telemetry.stats();
      setStats(data);
      showToast('Telemetry data cleared');
    } catch {
      showToast('Failed to clear telemetry data', 'error');
    }
  };

  if (loading) return null;

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Telemetry</h3>
      <div className="settings-row">
        <div className="settings-row__info">
          <label className="settings-row__label" htmlFor="setting-telemetry">Anonymous usage statistics</label>
          <div className="settings-row__desc">
            Help improve AgentOps by sharing anonymous usage data. No personal information,
            file paths, or file contents are ever collected. All data stays on your machine.
            You can opt out at any time, which will delete all collected data.
          </div>
        </div>
        <div className="settings-row__control">
          <button
            id="setting-telemetry"
            className={`btn btn--sm ${enabled ? 'btn--primary' : 'btn--secondary'}`}
            onClick={handleToggle}
            aria-checked={enabled}
            role="switch"
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
      {enabled && stats && (
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Collected data</div>
            <div className="settings-row__desc">
              {stats.events} event{stats.events !== 1 ? 's' : ''} collected
              {stats.breakdown && Object.keys(stats.breakdown).length > 0 && (
                <span style={{ marginLeft: 'var(--space-2)' }}>
                  ({Object.entries(stats.breakdown).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')})
                </span>
              )}
            </div>
          </div>
          <div className="settings-row__control">
            <button className="btn btn--ghost btn--sm" onClick={handleClear}>
              Clear data
            </button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        GDPR compliant. Data is stored locally and never sent to external servers.
        Opting out immediately deletes all collected telemetry data.
      </div>
    </div>
  );
}

// ── Main Settings Page ──

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await window.agentOps.settings.get();
        setSettings(loaded || {});
      } catch {
        // IPC not available
      }
    })();
  }, []);

  const handleChange = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-save on change
      (async () => {
        try {
          setSaving(true);
          await window.agentOps.settings.update(next);
        } catch {
          showToast('Failed to save settings', 'error');
        } finally {
          setSaving(false);
        }
      })();
      return next;
    });
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Settings</h1>
          <p className="page-header__desc">Application preferences, adapters, and budgets</p>
        </div>
        {saving && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Saving...</span>}
      </div>

      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="card">
          <_GeneralSection settings={settings} onChange={handleChange} />
          <_AgentPreferencesSection settings={settings} onChange={handleChange} />
        </div>

        <div className="card">
          <_AdapterSection />
        </div>

        <div className="card">
          <_BudgetSection />
        </div>

        <div className="card">
          <_SoftwareUpdateSection />
        </div>

        <div className="card">
          <_TelemetrySection />
        </div>
      </div>
    </>
  );
}

/** Mount the React Settings page into a container element */
export function mountSettingsPage(container) {
  const root = createRoot(container);
  root.render(<SettingsPage />);
  return () => root.unmount();
}
