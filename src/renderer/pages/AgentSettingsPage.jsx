import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Agent Settings Page — configure agent defaults, types, and model preferences.
 * Route: /settings/agents
 */

const _IconBot = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="6" y="14" width="12" height="8" rx="2" ry="2" /><path d="M12 16v4" />
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

export default function AgentSettingsPage() {
  const [settings, setSettings] = useState({
    defaultModel: 'claude-sonnet-4-6',
    maxConcurrentAgents: 4,
    autoRestart: true,
    logRetentionDays: 30,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    var cancelled = false;
    (async () => {
      try {
        var res = await fetch('/api/settings/agents');
        if (res.ok) {
          var data = await res.json();
          if (!cancelled) setSettings(function(prev) { return Object.assign({}, prev, data); });
        }
      } catch (e) { /* use defaults */ }
    })();
    return function() { cancelled = true; };
  }, []);

  var handleSave = async function() {
    setSaving(true);
    try {
      var res = await fetch('/api/settings/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('Agent settings saved');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <a href="/settings" data-navigate="/settings" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }} aria-label="Back to settings">
          <_IconArrowLeft />
        </a>
        <_IconBot />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600 }}>Agent Settings</h1>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-4)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Default Model</span>
          <select
            value={settings.defaultModel}
            onChange={function(e) { setSettings(function(s) { return Object.assign({}, s, { defaultModel: e.target.value }); }); }}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)' }}
          >
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-8">Claude Opus 4.8</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 'var(--space-4)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Max Concurrent Agents</span>
          <input
            type="number" min={1} max={16}
            value={settings.maxConcurrentAgents}
            onChange={function(e) { setSettings(function(s) { return Object.assign({}, s, { maxConcurrentAgents: Number(e.target.value) }); }); }}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoRestart}
            onChange={function(e) { setSettings(function(s) { return Object.assign({}, s, { autoRestart: e.target.checked }); }); }}
          />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Auto-restart crashed agents</span>
        </label>

        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Log Retention (days)</span>
          <input
            type="number" min={1} max={365}
            value={settings.logRetentionDays}
            onChange={function(e) { setSettings(function(s) { return Object.assign({}, s, { logRetentionDays: Number(e.target.value) }); }); }}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
