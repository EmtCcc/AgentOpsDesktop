import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Governance Settings Page — configure approval policies and guardrails.
 * Route: /settings/governance
 */

const _IconShield = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const _IconArrowLeft = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

function showToast(message, type) {
  try { window.showToast && window.showToast(message, type || 'success'); } catch (e) { /* noop */ }
}

export default function GovernanceSettingsPage() {
  const [policies, setPolicies] = useState({
    requireApprovalForDestructive: true,
    requireApprovalForExternal: true,
    maxCostPerTask: 5.0,
    blockedCommands: ['rm -rf /', 'sudo', 'format'],
  });
  const [newCommand, setNewCommand] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    var cancelled = false;
    (async () => {
      try {
        var res = await fetch('/api/settings/governance');
        if (res.ok) {
          var data = await res.json();
          if (!cancelled) setPolicies(function(prev) { return Object.assign({}, prev, data); });
        }
      } catch (e) { /* use defaults */ }
    })();
    return function() { cancelled = true; };
  }, []);

  var handleSave = async function() {
    setSaving(true);
    try {
      var res = await fetch('/api/settings/governance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('Governance settings saved');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  var addBlockedCommand = function() {
    var cmd = newCommand.trim();
    if (!cmd || policies.blockedCommands.indexOf(cmd) >= 0) return;
    setPolicies(function(p) { return Object.assign({}, p, { blockedCommands: p.blockedCommands.concat([cmd]) }); });
    setNewCommand('');
  };

  var removeBlockedCommand = function(cmd) {
    setPolicies(function(p) { return Object.assign({}, p, { blockedCommands: p.blockedCommands.filter(function(c) { return c !== cmd; }) }); });
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <a href="/settings" data-navigate="/settings" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }} aria-label="Back to settings">
          <_IconArrowLeft />
        </a>
        <_IconShield />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600 }}>Governance Settings</h1>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Approval Policies</h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
          <input type="checkbox" checked={policies.requireApprovalForDestructive}
            onChange={function(e) { setPolicies(function(p) { return Object.assign({}, p, { requireApprovalForDestructive: e.target.checked }); }); }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Require approval for destructive actions</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
          <input type="checkbox" checked={policies.requireApprovalForExternal}
            onChange={function(e) { setPolicies(function(p) { return Object.assign({}, p, { requireApprovalForExternal: e.target.checked }); }); }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Require approval for external API calls</span>
        </label>

        <label style={{ display: 'block', marginTop: 'var(--space-4)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Max Cost Per Task ($)</span>
          <input type="number" min={0} step={0.5} value={policies.maxCostPerTask}
            onChange={function(e) { setPolicies(function(p) { return Object.assign({}, p, { maxCostPerTask: Number(e.target.value) }); }); }}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </label>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Blocked Commands</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {policies.blockedCommands.map(function(cmd) {
            return (
              <span key={cmd} style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
                background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
              }}>
                {cmd}
                <button onClick={function() { removeBlockedCommand(cmd); }} aria-label={'Remove ' + cmd}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 'var(--text-sm)' }}>×</button>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input type="text" value={newCommand} onChange={function(e) { setNewCommand(e.target.value); }}
            placeholder="Add blocked command…"
            onKeyDown={function(e) { if (e.key === 'Enter') addBlockedCommand(); }}
            style={{ flex: 1, padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
          />
          <button onClick={addBlockedCommand}
            style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
            Add
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{
          padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
