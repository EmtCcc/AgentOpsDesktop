import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Agent Detail Page — displays status, config, and logs for a single agent.
 * Route: /agents/:agentId
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

function getAgentIdFromPath() {
  const match = window.location.pathname.match(/\/agents\/([^/]+)/);
  return match ? match[1] : null;
}

export default function AgentDetailPage() {
  const agentId = getAgentIdFromPath();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agentId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agents/' + agentId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!cancelled) setAgent(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading agent…
      </div>
    );
  }

  if (!agentId || error || !agent) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
          {error || 'Agent not found'}
        </p>
        <a href="/agents" data-navigate="/agents" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
          ← Back to Agents
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <a href="/agents" data-navigate="/agents" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }} aria-label="Back to agents">
          <_IconArrowLeft />
        </a>
        <_IconBot />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600 }}>{agent.name || agentId}</h1>
        {agent.status && (
          <span style={{
            padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: agent.status === 'running' ? 'var(--color-success-light)' : 'var(--color-surface-raised)',
            color: agent.status === 'running' ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}>{agent.status}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Configuration</h2>
          <dl style={{ margin: 0 }}>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Type</dt>
            <dd style={{ margin: '0 0 var(--space-3)', fontWeight: 500 }}>{agent.type || '—'}</dd>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Model</dt>
            <dd style={{ margin: '0 0 var(--space-3)', fontWeight: 500 }}>{agent.model || '—'}</dd>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>ID</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{agentId}</dd>
          </dl>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Status</h2>
          <dl style={{ margin: 0 }}>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Tasks Completed</dt>
            <dd style={{ margin: '0 0 var(--space-3)', fontWeight: 500 }}>{agent.tasksCompleted ?? '—'}</dd>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Last Active</dt>
            <dd style={{ margin: '0 0 var(--space-3)', fontWeight: 500 }}>{agent.lastActive || '—'}</dd>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Uptime</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{agent.uptime || '—'}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
