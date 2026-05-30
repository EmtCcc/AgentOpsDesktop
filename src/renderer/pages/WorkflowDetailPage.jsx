import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Workflow Detail Page — displays workflow steps, run history, and controls.
 * Route: /workflows/:workflowId
 */

const _IconArrowLeft = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const _IconGitBranch = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const _IconPlay = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

function getWorkflowIdFromPath() {
  var match = window.location.pathname.match(/\/workflows\/([^/]+)/);
  return match ? match[1] : null;
}

var STATUS_COLORS = {
  pending: { bg: 'var(--color-surface-raised)', fg: 'var(--color-text-muted)' },
  running: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)' },
  completed: { bg: 'var(--color-success-light)', fg: 'var(--color-success)' },
  failed: { bg: 'var(--color-danger-light)', fg: 'var(--color-danger)' },
};

export default function WorkflowDetailPage() {
  var workflowId = getWorkflowIdFromPath();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workflowId) { setLoading(false); return; }
    var cancelled = false;
    (async () => {
      try {
        var res = await fetch('/api/workflows/' + workflowId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (!cancelled) setWorkflow(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return function() { cancelled = true; };
  }, [workflowId]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading workflow…
      </div>
    );
  }

  if (!workflowId || error || !workflow) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
          {error || 'Workflow not found'}
        </p>
        <a href="/workflows" data-navigate="/workflows" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
          ← Back to Workflows
        </a>
      </div>
    );
  }

  var statusStyle = STATUS_COLORS[workflow.status] || STATUS_COLORS.pending;
  var steps = workflow.steps || [];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <a href="/workflows" data-navigate="/workflows" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }} aria-label="Back to workflows">
          <_IconArrowLeft />
        </a>
        <_IconGitBranch />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600 }}>{workflow.name || workflowId}</h1>
        <span style={{
          padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
          fontSize: 'var(--text-xs)', fontWeight: 500,
          background: statusStyle.bg, color: statusStyle.fg,
        }}>{workflow.status || 'pending'}</span>
      </div>

      {workflow.description && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>{workflow.description}</p>
      )}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Steps</h2>
        {steps.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No steps defined.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {steps.map(function(step, i) {
              var ss = STATUS_COLORS[step.status] || STATUS_COLORS.pending;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 600, background: ss.bg, color: ss.fg,
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{step.name || step.label || 'Step ' + (i + 1)}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: ss.fg }}>{step.status || 'pending'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          fontWeight: 500, cursor: 'pointer',
        }}>
          <_IconPlay /> Run Workflow
        </button>
      </div>
    </div>
  );
}
