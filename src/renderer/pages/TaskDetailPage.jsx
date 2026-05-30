import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Task Detail Page — displays status, assignee, and details for a single task.
 * Route: /tasks/:taskId
 */

const _IconArrowLeft = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const _IconCheckSquare = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

function getTaskIdFromPath() {
  const match = window.location.pathname.match(/\/tasks\/([^/]+)/);
  return match ? match[1] : null;
}

const STATUS_COLORS = {
  pending: { bg: 'var(--color-surface-raised)', fg: 'var(--color-text-muted)' },
  assigned: { bg: 'var(--color-info-light)', fg: 'var(--color-info)' },
  running: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)' },
  done: { bg: 'var(--color-success-light)', fg: 'var(--color-success)' },
  failed: { bg: 'var(--color-danger-light)', fg: 'var(--color-danger)' },
  blocked: { bg: 'var(--color-surface-raised)', fg: 'var(--color-text-muted)' },
};

export default function TaskDetailPage() {
  const taskId = getTaskIdFromPath();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tasks/' + taskId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!cancelled) setTask(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading task…
      </div>
    );
  }

  if (!taskId || error || !task) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
          {error || 'Task not found'}
        </p>
        <a href="/tasks" data-navigate="/tasks" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
          ← Back to Tasks
        </a>
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS.pending;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <a href="/tasks" data-navigate="/tasks" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }} aria-label="Back to tasks">
          <_IconArrowLeft />
        </a>
        <_IconCheckSquare />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600 }}>{task.title || task.subject || taskId}</h1>
        <span style={{
          padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
          fontSize: 'var(--text-xs)', fontWeight: 500,
          background: statusStyle.bg, color: statusStyle.fg,
        }}>{task.status}</span>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 600 }}>Details</h2>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Assignee</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{task.assignee || task.agentId || '—'}</dd>
          </div>
          <div>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Priority</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{task.priority || '—'}</dd>
          </div>
          <div>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Created</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{task.createdAt || '—'}</dd>
          </div>
          <div>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Updated</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{task.updatedAt || '—'}</dd>
          </div>
        </dl>
        {task.description && (
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Description</dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{task.description}</dd>
          </div>
        )}
      </div>
    </div>
  );
}
