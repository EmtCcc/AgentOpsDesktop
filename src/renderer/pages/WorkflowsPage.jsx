import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// ── Icons ──

const _IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const _IconPlay = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const _IconPause = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

const _IconX = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const _IconRefresh = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const _IconWorkflow = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const _IconTrash = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const _IconCheck = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const _IconZoomIn = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const _IconZoomOut = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const _IconFitView = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

// ── Focus Trap Hook ──

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
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    modal.addEventListener('keydown', handleKeyDown);
    first?.focus();
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  return modalRef;
}

// ── Status Helpers ──

const STATUS_LABELS = {
  pending: 'Pending', running: 'Running', succeeded: 'Succeeded',
  failed: 'Failed', cancelled: 'Cancelled', paused: 'Paused',
  ready: 'Ready', skipped: 'Skipped',
};

const STATUS_COLORS = {
  pending: 'var(--color-text-secondary)',
  running: 'var(--color-primary)',
  succeeded: 'var(--color-success)',
  failed: 'var(--color-danger)',
  cancelled: 'var(--color-warning)',
  paused: 'var(--color-warning)',
  ready: 'var(--color-info)',
  skipped: 'var(--color-text-tertiary)',
};

// ── DAG Layout Algorithm (layered/topological) ──

function layoutDag(tasks, edges) {
  if (!tasks || tasks.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const adj = new Map();
  const inDeg = new Map();

  for (const t of tasks) {
    adj.set(t.id, []);
    inDeg.set(t.id, 0);
  }
  for (const e of (edges || [])) {
    if (adj.has(e.from) && inDeg.has(e.to)) {
      adj.get(e.from).push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    }
  }

  // Topological sort → assign layers
  const queue = [];
  const layer = new Map();
  for (const [id, deg] of inDeg) {
    if (deg === 0) { queue.push(id); layer.set(id, 0); }
  }
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const next of (adj.get(cur) || [])) {
      const newLayer = layer.get(cur) + 1;
      layer.set(next, Math.max(layer.get(next) || 0, newLayer));
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  // Group by layer
  const layers = new Map();
  for (const [id, l] of layer) {
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l).push(id);
  }

  // Position nodes
  const NODE_W = 200;
  const NODE_H = 64;
  const LAYER_GAP = 120;
  const NODE_GAP = 32;

  const nodes = [];

  for (const [l, ids] of layers) {
    const totalH = ids.length * NODE_H + (ids.length - 1) * NODE_GAP;
    const startY = -totalH / 2;
    ids.forEach((id, i) => {
      const task = taskMap.get(id);
      nodes.push({
        id,
        title: task?.title || id,
        taskType: task?.taskType || 'agent',
        status: task?.status || 'pending',
        x: l * (NODE_W + LAYER_GAP),
        y: startY + i * (NODE_H + NODE_GAP),
        w: NODE_W,
        h: NODE_H,
      });
    });
  }

  // Build edge paths
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const layoutEdges = (edges || []).map(e => {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) return null;
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const cx = (x1 + x2) / 2;
    return { ...e, x1, y1, x2, y2, cx };
  }).filter(Boolean);

  const allX = nodes.flatMap(n => [n.x, n.x + n.w]);
  const allY = nodes.flatMap(n => [n.y, n.y + n.h]);
  const width = allX.length ? Math.max(...allX) - Math.min(...allX) + NODE_W + LAYER_GAP * 2 : 0;
  const height = allY.length ? Math.max(...allY) - Math.min(...allY) + NODE_H + NODE_GAP * 2 : 0;

  return { nodes, edges: layoutEdges, width, height };
}

// ── SVG DAG Canvas ──

function _DagCanvas({ dag, selectedTask, onSelectTask }) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const tasks = dag?.tasks || [];
  const edges = dag?.edges || [];
  const layout = useMemo(() => layoutDag(tasks, edges), [tasks, edges]);

  // Fit view on DAG change
  const fitView = useCallback(() => {
    if (!layout.width || !layout.height) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pad = 60;
    const scaleX = (rect.width - pad * 2) / (layout.width || 1);
    const scaleY = (rect.height - pad * 2) / (layout.height || 1);
    const scale = Math.min(scaleX, scaleY, 1.5);
    const cx = layout.width / 2;
    const cy = layout.height / 2;
    setTransform({
      x: rect.width / 2 - cx * scale,
      y: rect.height / 2 - cy * scale,
      scale,
    });
  }, [layout]);

  useEffect(() => { fitView(); }, [dag?.id]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({
      ...t,
      scale: Math.max(0.2, Math.min(3, t.scale * delta)),
      x: e.clientX - (e.clientX - t.x) * delta,
      y: e.clientY - (e.clientY - t.y) * delta,
    }));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Only pan on background click
    if (e.target === svgRef.current || e.target.classList.contains('dag-bg')) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    }
  }, [transform]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setTransform(t => ({
      ...t,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const taskTypeIcon = (type) => {
    if (type === 'noop') return '⚡';
    if (type === 'manual') return '✋';
    return '🤖';
  };

  return (
    <div className="dag-canvas-container">
      <div className="dag-canvas-toolbar">
        <button className="btn btn--ghost btn--sm" onClick={() => setTransform(t => ({ ...t, scale: Math.min(3, t.scale * 1.2) }))} title="Zoom in"><_IconZoomIn /></button>
        <button className="btn btn--ghost btn--sm" onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.2, t.scale * 0.8) }))} title="Zoom out"><_IconZoomOut /></button>
        <button className="btn btn--ghost btn--sm" onClick={fitView} title="Fit to view"><_IconFitView /></button>
        <span className="dag-canvas-toolbar__label">{Math.round(transform.scale * 100)}%</span>
      </div>

      <svg
        ref={svgRef}
        className="dag-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <rect className="dag-bg" width="100%" height="100%" fill="transparent" />

        {/* Grid pattern */}
        <defs>
          <pattern id="dag-grid" width="20" height="20" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${transform.x % (20 * transform.scale)},${transform.y % (20 * transform.scale)}) scale(${transform.scale})`}>
            <circle cx="10" cy="10" r="0.5" fill="var(--color-border)" opacity="0.5" />
          </pattern>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-secondary)" opacity="0.6" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#dag-grid)" />

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {layout.edges.map((e, i) => (
            <g key={`edge-${i}`}>
              <path
                className="dag-edge"
                d={`M${e.x1},${e.y1} C${e.cx},${e.y1} ${e.cx},${e.y2} ${e.x2},${e.y2}`}
                markerEnd="url(#arrowhead)"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="2"
              />
              {/* Data flow label */}
              {e.label && (
                <text
                  x={(e.x1 + e.x2) / 2}
                  y={(e.y1 + e.y2) / 2 - 8}
                  textAnchor="middle"
                  className="dag-edge__label"
                  fill="var(--color-text-tertiary)"
                  fontSize="11"
                >
                  {e.label}
                </text>
              )}
            </g>
          ))}

          {/* Nodes */}
          {layout.nodes.map((node) => (
            <g
              key={node.id}
              className={`dag-node dag-node--${node.status} ${selectedTask === node.id ? 'dag-node--selected' : ''}`}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectTask(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={node.w}
                height={node.h}
                rx="8"
                fill="var(--color-bg-primary)"
                stroke={selectedTask === node.id ? 'var(--color-primary)' : STATUS_COLORS[node.status] || 'var(--color-border)'}
                strokeWidth={selectedTask === node.id ? '2.5' : '1.5'}
              />
              {/* Status indicator bar */}
              <rect
                x="0" y="0" width="4" height={node.h}
                rx="8" ry="0"
                fill={STATUS_COLORS[node.status] || 'var(--color-border)'}
                clipPath={`inset(0 0 0 0 round 8px 0 0 8px)`}
              />
              <rect x="0" y="0" width="4" height={node.h} fill={STATUS_COLORS[node.status] || 'var(--color-border)'} />
              <rect x="2" y="2" width="2" height={node.h - 4} fill="var(--color-bg-primary)" rx="1" />

              {/* Task type badge */}
              <text x="16" y="24" fontSize="14">{taskTypeIcon(node.taskType)}</text>

              {/* Title */}
              <text x="36" y="28" className="dag-node__title" fill="var(--color-text-primary)" fontSize="13" fontWeight="600">
                {node.title.length > 22 ? node.title.slice(0, 22) + '…' : node.title}
              </text>

              {/* Status label */}
              <text x="16" y="50" className="dag-node__status" fill={STATUS_COLORS[node.status] || 'var(--color-text-secondary)'} fontSize="11" fontWeight="500">
                {STATUS_LABELS[node.status] || node.status}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── Task Detail Panel ──

function _TaskDetailPanel({ dag, taskId, onClose }) {
  const task = (dag?.tasks || []).find(t => t.id === taskId);
  if (!task) return null;

  const upstreamEdges = (dag?.edges || []).filter(e => e.to === taskId);
  const downstreamEdges = (dag?.edges || []).filter(e => e.from === taskId);

  return (
    <div className="dag-detail-panel card">
      <div className="card__header">
        <div className="dag-detail-panel__title">
          <span style={{ fontSize: '16px' }}>{task.taskType === 'noop' ? '⚡' : task.taskType === 'manual' ? '✋' : '🤖'}</span>
          <span>{task.title}</span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose}><_IconX /></button>
      </div>
      <div className="card__body">
        <div className="dag-detail-panel__row">
          <span className="dag-detail-panel__label">Status</span>
          <span className={`status-badge status-badge--${task.status}`}>{STATUS_LABELS[task.status] || task.status}</span>
        </div>
        <div className="dag-detail-panel__row">
          <span className="dag-detail-panel__label">Type</span>
          <span>{task.taskType || 'agent'}</span>
        </div>
        {task.agentId && (
          <div className="dag-detail-panel__row">
            <span className="dag-detail-panel__label">Agent</span>
            <span className="dag-detail-panel__mono">{task.agentId}</span>
          </div>
        )}
        {upstreamEdges.length > 0 && (
          <div className="dag-detail-panel__row">
            <span className="dag-detail-panel__label">Depends on</span>
            <div className="dag-detail-panel__list">
              {upstreamEdges.map((e, i) => {
                const fromTask = (dag?.tasks || []).find(t => t.id === e.from);
                return <span key={i} className="dag-detail-panel__dep">{fromTask?.title || e.from}</span>;
              })}
            </div>
          </div>
        )}
        {downstreamEdges.length > 0 && (
          <div className="dag-detail-panel__row">
            <span className="dag-detail-panel__label">Feeds into</span>
            <div className="dag-detail-panel__list">
              {downstreamEdges.map((e, i) => {
                const toTask = (dag?.tasks || []).find(t => t.id === e.to);
                return <span key={i} className="dag-detail-panel__dep">{toTask?.title || e.to}</span>;
              })}
            </div>
          </div>
        )}
        {task.output && (
          <div className="dag-detail-panel__row">
            <span className="dag-detail-panel__label">Output</span>
            <pre className="dag-detail-panel__pre">{JSON.stringify(task.output, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create DAG Modal ──

function _CreateDagModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskRows, setTaskRows] = useState([{ id: `t${Date.now()}`, title: '', taskType: 'agent', agentId: '' }]);
  const [edgeRows, setEdgeRows] = useState([]);
  const [maxParallel, setMaxParallel] = useState(4);
  const [onFailure, setOnFailure] = useState('best-effort');
  const [error, setError] = useState(null);

  const modalRef = useFocusTrap(isOpen, onClose);

  const addTask = () => {
    setTaskRows(rows => [...rows, { id: `t${Date.now()}_${rows.length}`, title: '', taskType: 'agent', agentId: '' }]);
  };

  const removeTask = (idx) => {
    const taskId = taskRows[idx].id;
    setTaskRows(rows => rows.filter((_, i) => i !== idx));
    setEdgeRows(edges => edges.filter(e => e.from !== taskId && e.to !== taskId));
  };

  const updateTask = (idx, field, value) => {
    setTaskRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addEdge = () => {
    if (taskRows.length < 2) return;
    setEdgeRows(edges => [...edges, { from: taskRows[0].id, to: taskRows[1].id, label: '' }]);
  };

  const removeEdge = (idx) => setEdgeRows(edges => edges.filter((_, i) => i !== idx));

  const updateEdge = (idx, field, value) => {
    setEdgeRows(edges => edges.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    const validTasks = taskRows.filter(t => t.title.trim());
    if (validTasks.length === 0) { setError('At least one task with a title is required'); return; }

    const tasks = validTasks.map(t => ({
      title: t.title.trim(),
      taskType: t.taskType || 'agent',
      ...(t.agentId.trim() ? { agentId: t.agentId.trim() } : {}),
    }));

    const edges = edgeRows
      .filter(e => e.from && e.to && e.from !== e.to)
      .map(e => ({ from: e.from, to: e.to, ...(e.label.trim() ? { label: e.label.trim() } : {}) }));

    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined, tasks, edges, maxParallel, onFailure });
      setName(''); setDescription(''); setTaskRows([{ id: `t${Date.now()}`, title: '', taskType: 'agent', agentId: '' }]);
      setEdgeRows([]); setMaxParallel(4); setOnFailure('best-effort');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create workflow');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="button" tabIndex={-1} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal modal--wide" ref={modalRef} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Create Workflow</h2>
            <button className="btn btn--ghost btn--sm" onClick={onClose}><_IconX /></button>
          </div>
          <div className="card__body">
            {error && <div className="alert alert--danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="dag-name">Name *</label>
              <input id="dag-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deploy Pipeline" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="dag-desc">Description</label>
              <input id="dag-desc" className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>

            <div className="form-row">
              <div className="form-group form-group--half">
                <label className="form-label" htmlFor="dag-max-parallel">Max Parallel</label>
                <input id="dag-max-parallel" className="form-input" type="number" min="1" max="32" value={maxParallel} onChange={(e) => setMaxParallel(Number(e.target.value))} />
              </div>
              <div className="form-group form-group--half">
                <label className="form-label" htmlFor="dag-on-failure">On Failure</label>
                <select id="dag-on-failure" className="form-input" value={onFailure} onChange={(e) => setOnFailure(e.target.value)}>
                  <option value="best-effort">Best Effort</option>
                  <option value="fail-fast">Fail Fast</option>
                </select>
              </div>
            </div>

            {/* Tasks */}
            <div className="dag-form-section">
              <div className="dag-form-section__header">
                <h3 className="dag-form-section__title">Tasks</h3>
                <button className="btn btn--ghost btn--sm" onClick={addTask}><_IconPlus /> Add Task</button>
              </div>
              {taskRows.map((task, idx) => (
                <div key={task.id} className="dag-task-row">
                  <input className="form-input dag-task-row__title" value={task.title} onChange={(e) => updateTask(idx, 'title', e.target.value)} placeholder="Task title *" />
                  <select className="form-input dag-task-row__type" value={task.taskType} onChange={(e) => updateTask(idx, 'taskType', e.target.value)}>
                    <option value="agent">Agent</option>
                    <option value="noop">Noop</option>
                    <option value="manual">Manual</option>
                  </select>
                  <input className="form-input dag-task-row__agent" value={task.agentId} onChange={(e) => updateTask(idx, 'agentId', e.target.value)} placeholder="Agent ID (optional)" />
                  <button className="btn btn--danger btn--sm" onClick={() => removeTask(idx)} disabled={taskRows.length <= 1}><_IconTrash /></button>
                </div>
              ))}
            </div>

            {/* Edges */}
            <div className="dag-form-section">
              <div className="dag-form-section__header">
                <h3 className="dag-form-section__title">Dependencies</h3>
                <button className="btn btn--ghost btn--sm" onClick={addEdge} disabled={taskRows.length < 2}><_IconPlus /> Add Edge</button>
              </div>
              {edgeRows.length === 0 && <p className="dag-form-section__empty">No dependencies. Tasks will run in parallel.</p>}
              {edgeRows.map((edge, idx) => (
                <div key={idx} className="dag-edge-row">
                  <select className="form-input dag-edge-row__select" value={edge.from} onChange={(e) => updateEdge(idx, 'from', e.target.value)}>
                    {taskRows.filter(t => t.title.trim()).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <span className="dag-edge-row__arrow">→</span>
                  <select className="form-input dag-edge-row__select" value={edge.to} onChange={(e) => updateEdge(idx, 'to', e.target.value)}>
                    {taskRows.filter(t => t.title.trim()).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <input className="form-input dag-edge-row__label" value={edge.label} onChange={(e) => updateEdge(idx, 'label', e.target.value)} placeholder="Label (optional)" />
                  <button className="btn btn--danger btn--sm" onClick={() => removeEdge(idx)}><_IconTrash /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="card__footer">
            <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSubmit}>Create Workflow</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Workflows Page ──

export default function WorkflowsPage() {
  const [dags, setDags] = useState([]);
  const [selectedDagId, setSelectedDagId] = useState(null);
  const [selectedDag, setSelectedDag] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // Load DAG list
  const loadDags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.agentOps.orchestrator.list({ sortBy: 'updatedAt', sortOrder: 'desc' });
      const items = result?.items || result || [];
      setDags(items);
      // Auto-select first if none selected
      if (!selectedDagId && items.length > 0) {
        setSelectedDagId(items[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [selectedDagId]);

  // Load selected DAG detail
  const loadDagDetail = useCallback(async (id) => {
    if (!id) { setSelectedDag(null); return; }
    try {
      const detail = await window.agentOps.orchestrator.get(id);
      setSelectedDag(detail);
    } catch (err) {
      console.error('Failed to load DAG detail:', err);
    }
  }, []);

  useEffect(() => { loadDags(); }, []);

  useEffect(() => { loadDagDetail(selectedDagId); }, [selectedDagId]);

  // Subscribe to real-time DAG updates
  useEffect(() => {
    const unsubEvents = window.agentOps.orchestrator.onDagUpdate((event) => {
      // Refresh list
      loadDags();
      // Refresh detail if viewing the affected DAG
      if (event?.dagId === selectedDagId) {
        loadDagDetail(selectedDagId);
      }
    });
    const unsubProgress = window.agentOps.orchestrator.onProgress((data) => {
      if (data?.dagId === selectedDagId) {
        loadDagDetail(selectedDagId);
      }
    });
    return () => { unsubEvents(); unsubProgress(); };
  }, [selectedDagId, loadDags, loadDagDetail]);

  // Actions
  const handleCreate = async (definition) => {
    await window.agentOps.orchestrator.create(definition);
    await loadDags();
  };

  const handleStart = async () => {
    if (!selectedDagId) return;
    await window.agentOps.orchestrator.start(selectedDagId);
    await loadDagDetail(selectedDagId);
  };

  const handlePause = async () => {
    if (!selectedDagId) return;
    await window.agentOps.orchestrator.pause(selectedDagId);
    await loadDagDetail(selectedDagId);
  };

  const handleResume = async () => {
    if (!selectedDagId) return;
    await window.agentOps.orchestrator.resume(selectedDagId);
    await loadDagDetail(selectedDagId);
  };

  const handleCancel = async () => {
    if (!selectedDagId) return;
    await window.agentOps.orchestrator.cancel(selectedDagId);
    await loadDagDetail(selectedDagId);
  };

  const filteredDags = useMemo(() => {
    if (filter === 'all') return dags;
    return dags.filter(d => d.status === filter);
  }, [dags, filter]);

  const dagStatus = selectedDag?.status;
  const progress = selectedDag?.progress;
  const completedCount = progress?.completed ?? (selectedDag?.tasks || []).filter(t => t.status === 'succeeded').length;
  const totalCount = progress?.total ?? (selectedDag?.tasks || []).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-header__title">Workflows</h1>
          <p className="page-header__desc">Visual DAG editor for orchestrating agent task pipelines</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={loadDags}><_IconRefresh /></button>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}><_IconPlus /> Create Workflow</button>
        </div>
      </div>

      <div className="workflow-layout">
        {/* Sidebar: DAG list */}
        <div className="workflow-sidebar">
          <div className="workflow-sidebar__filters">
            {['all', 'pending', 'running', 'succeeded', 'failed', 'paused', 'cancelled'].map(f => (
              <button
                key={f}
                className={`workflow-sidebar__filter ${filter === f ? 'workflow-sidebar__filter--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f] || f}
              </button>
            ))}
          </div>
          <div className="workflow-sidebar__list">
            {loading && dags.length === 0 && <div className="workflow-sidebar__loading">Loading...</div>}
            {filteredDags.length === 0 && !loading && (
              <div className="workflow-sidebar__empty">No workflows found</div>
            )}
            {filteredDags.map(dag => {
              const taskCount = dag.tasks?.length || dag.taskCount || 0;
              return (
                <div
                  key={dag.id}
                  role="button"
                  tabIndex={0}
                  className={`workflow-sidebar__item ${selectedDagId === dag.id ? 'workflow-sidebar__item--active' : ''}`}
                  onClick={() => { setSelectedDagId(dag.id); setSelectedTask(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedDagId(dag.id); setSelectedTask(null); } }}
                >
                  <div className="workflow-sidebar__item-header">
                    <span className="workflow-sidebar__item-name">{dag.name}</span>
                    <span className={`status-dot status-dot--${dag.status}`} />
                  </div>
                  <div className="workflow-sidebar__item-meta">
                    <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
                    <span className="workflow-sidebar__item-status" style={{ color: STATUS_COLORS[dag.status] }}>
                      {STATUS_LABELS[dag.status] || dag.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main: DAG canvas */}
        <div className="workflow-main">
          {!selectedDagId ? (
            <div className="empty-state">
              <div className="empty-state__icon"><_IconWorkflow /></div>
              <div className="empty-state__title">No workflow selected</div>
              <div className="empty-state__desc">Select a workflow from the sidebar or create a new one.</div>
            </div>
          ) : !selectedDag ? (
            <div className="empty-state">
              <div className="empty-state__title">Loading...</div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="workflow-toolbar">
                <div className="workflow-toolbar__info">
                  <h2 className="workflow-toolbar__name">{selectedDag.name}</h2>
                  {selectedDag.description && <span className="workflow-toolbar__desc">{selectedDag.description}</span>}
                </div>
                <div className="workflow-toolbar__actions">
                  {progress && (
                    <span className="workflow-toolbar__progress">
                      {completedCount}/{totalCount}
                    </span>
                  )}
                  {dagStatus === 'pending' && (
                    <button className="btn btn--primary btn--sm" onClick={handleStart}><_IconPlay /> Start</button>
                  )}
                  {dagStatus === 'running' && (
                    <>
                      <button className="btn btn--secondary btn--sm" onClick={handlePause}><_IconPause /> Pause</button>
                      <button className="btn btn--danger btn--sm" onClick={handleCancel}><_IconX /> Cancel</button>
                    </>
                  )}
                  {dagStatus === 'paused' && (
                    <>
                      <button className="btn btn--primary btn--sm" onClick={handleResume}><_IconPlay /> Resume</button>
                      <button className="btn btn--danger btn--sm" onClick={handleCancel}><_IconX /> Cancel</button>
                    </>
                  )}
                </div>
              </div>

              {/* DAG Canvas */}
              <_DagCanvas dag={selectedDag} selectedTask={selectedTask} onSelectTask={setSelectedTask} />

              {/* Task detail panel */}
              {selectedTask && (
                <_TaskDetailPanel dag={selectedDag} taskId={selectedTask} onClose={() => setSelectedTask(null)} />
              )}
            </>
          )}
        </div>
      </div>

      <_CreateDagModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </>
  );
}

// ── Mount ──

export function mountWorkflowsPage(container) {
  const root = createRoot(container);
  root.render(<WorkflowsPage />);
  return () => root.unmount();
}
