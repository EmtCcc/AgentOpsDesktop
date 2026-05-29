import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const _IconActivity = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconBot = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="6" y="14" width="12" height="8" rx="2" ry="2" /><path d="M12 16v4" />
  </svg>
);

const IconCheck = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlert = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconZap = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconUsers = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconTerminal = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const _IconSearch = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const _IconPause = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

const _IconPlay = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const _IconTrash = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

const EVENT_TYPES = {
  agent_action: { label: 'Agent Actions', icon: IconBot, color: 'var(--color-primary)' },
  task_change: { label: 'Task Changes', icon: IconCheck, color: 'var(--color-success)' },
  squad_event: { label: 'Squad Events', icon: IconUsers, color: 'var(--color-info)' },
  log_event: { label: 'Log Events', icon: IconTerminal, color: 'var(--color-text-secondary)' },
  orchestrator: { label: 'Orchestrator', icon: IconZap, color: 'var(--color-warning)' },
  error: { label: 'Errors', icon: IconAlert, color: 'var(--color-danger)' },
};

function classifyEvent(entry) {
  if (entry.type?.startsWith('dag:') || entry.type?.startsWith('task:') || entry.type?.startsWith('orchestrator:')) {
    return 'orchestrator';
  }
  if (entry.type?.startsWith('squad:') || entry.squadId) {
    return 'squad_event';
  }
  if (entry.level === 'error' || entry.level === 'warn') {
    return entry.level === 'error' ? 'error' : 'log_event';
  }
  if (entry.agentId && entry.type?.startsWith('agent:')) {
    return 'agent_action';
  }
  if (entry.type?.startsWith('task') || entry.taskId || entry.status) {
    return 'task_change';
  }
  if (entry.agentId) {
    return 'agent_action';
  }
  return 'log_event';
}

function describeEvent(entry) {
  const type = classifyEvent(entry);
  if (type === 'orchestrator') {
    if (entry.type?.includes('complete')) return 'Orchestration task completed';
    if (entry.type?.includes('start')) return 'Orchestration task started';
    if (entry.type?.includes('fail')) return 'Orchestration task failed';
    if (entry.type?.includes('dag')) return 'DAG workflow update';
    return `Orchestrator: ${entry.type || 'event'}`;
  }
  if (type === 'squad_event') {
    if (entry.type?.includes('start')) return 'Squad batch started';
    if (entry.type?.includes('stop')) return 'Squad batch stopped';
    if (entry.type?.includes('create')) return 'Squad created';
    if (entry.type?.includes('member')) return 'Squad member changed';
    return `Squad event: ${entry.type || 'update'}`;
  }
  if (type === 'task_change') {
    const title = entry.title || entry.taskTitle || entry.name || 'Task';
    if (entry.status === 'done' || entry.status === 'completed') return `${title} completed`;
    if (entry.status === 'failed') return `${title} failed`;
    if (entry.status === 'running' || entry.status === 'in_progress') return `${title} started`;
    if (entry.status === 'pending') return `${title} created`;
    if (entry.type?.includes('handoff')) return `${title} handed off`;
    return `${title}: ${entry.status || entry.type || 'updated'}`;
  }
  if (type === 'agent_action') {
    const name = entry.agentName || entry.agentId || 'Agent';
    if (entry.type?.includes('spawn')) return `${name} spawned`;
    if (entry.type?.includes('kill')) return `${name} terminated`;
    if (entry.type?.includes('health')) return `${name} health check`;
    if (entry.type?.includes('status')) return `${name} status: ${entry.status || ''}`;
    return entry.message || `${name} action`;
  }
  if (type === 'error') {
    return entry.message || entry.text || 'Error occurred';
  }
  return entry.message || entry.text || 'Event';
}

function _ActivityItem({ event }) {
  const type = classifyEvent(event);
  const meta = EVENT_TYPES[type] || EVENT_TYPES.log_event;
  const _Icon = meta.icon;

  return (
    <div className="activity-timeline__item" data-type={type}>
      <div className="activity-timeline__marker" style={{ borderColor: meta.color }}>
        <span className="activity-timeline__icon" style={{ color: meta.color }}>
          <_Icon />
        </span>
      </div>
      <div className="activity-timeline__body">
        <div className="activity-timeline__header">
          <span className="activity-timeline__desc">{describeEvent(event)}</span>
          <span className="activity-timeline__time" title={formatTime(event.timestamp)}>
            {relativeTime(event.timestamp)}
          </span>
        </div>
        <div className="activity-timeline__meta">
          {event.agentId && (
            <span className="activity-timeline__tag">{event.agentId}</span>
          )}
          {event.squadId && (
            <span className="activity-timeline__tag activity-timeline__tag--info">{event.squadId}</span>
          )}
          {event.taskId && (
            <span className="activity-timeline__tag">{event.taskId}</span>
          )}
          {event.level && event.level !== 'info' && (
            <span className={`activity-timeline__tag activity-timeline__tag--${event.level}`}>{event.level}</span>
          )}
        </div>
        {event.message && type !== 'error' && type !== 'log_event' && (
          <div className="activity-timeline__detail">{event.message}</div>
        )}
      </div>
    </div>
  );
}

export default function ActivityTimelinePage() {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [paused, setPaused] = useState(false);
  const [agents, setAgents] = useState([]);
  const [filterAgent, setFilterAgent] = useState('');
  const listRef = useRef(null);
  const logUnsubRef = useRef(null);
  const orchUnsubRef = useRef(null);
  const pausedRef = useRef(false);

  // Keep pausedRef in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Load initial data
  const loadInitial = useCallback(async () => {
    try {
      const [logs, agentList] = await Promise.all([
        window.agentOps.logs.list({ limit: 200 }),
        window.agentOps.agents.list(),
      ]);
      if (agentList) setAgents(agentList);
      if (logs && logs.length > 0) {
        const timelineEvents = logs.map((l) => ({
          ...l,
          _source: 'log',
          timestamp: l.timestamp || Date.now(),
        }));
        setEvents(timelineEvents);
      }
    } catch { /* IPC not available */ }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Subscribe to real-time log events
  useEffect(() => {
    logUnsubRef.current = window.agentOps.logs.onNew((entry) => {
      if (pausedRef.current) return;
      setEvents((prev) => {
        const event = { ...entry, _source: 'log', timestamp: entry.timestamp || Date.now() };
        const next = [event, ...prev];
        if (next.length > 1000) next.pop();
        return next;
      });
    });
    return () => { if (logUnsubRef.current) logUnsubRef.current(); };
  }, []);

  // Subscribe to orchestrator events
  useEffect(() => {
    orchUnsubRef.current = window.agentOps.orchestrator.onDagUpdate((evt) => {
      if (pausedRef.current) return;
      if (!evt) return;
      setEvents((prev) => {
        const event = {
          ...evt,
          _source: 'orchestrator',
          timestamp: evt.timestamp || Date.now(),
        };
        const next = [event, ...prev];
        if (next.length > 1000) next.pop();
        return next;
      });
    });
    return () => { if (orchUnsubRef.current) orchUnsubRef.current(); };
  }, []);

  // Auto-scroll to top when new events arrive (newest first)
  useEffect(() => {
    const el = listRef.current;
    if (!el || paused) return;
    if (el.scrollTop < 80) {
      requestAnimationFrame(() => { el.scrollTop = 0; });
    }
  }, [events, paused]);

  const filteredEvents = events.filter((e) => {
    if (filterType && classifyEvent(e) !== filterType) return false;
    if (filterAgent && e.agentId !== filterAgent) return false;
    return true;
  });

  const eventTypeCounts = {};
  events.forEach((e) => {
    const t = classifyEvent(e);
    eventTypeCounts[t] = (eventTypeCounts[t] || 0) + 1;
  });

  const handleClear = () => setEvents([]);
  const togglePause = () => setPaused((p) => !p);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Activity Timeline</h1>
          <p className="page-header__desc">Real-time feed of agent actions, task changes, and system events</p>
        </div>
        <div className="page-header__actions">
          <button className={`btn btn--sm ${paused ? 'btn--primary' : 'btn--ghost'}`} onClick={togglePause}>
            {paused ? <><_IconPlay /> Resume</> : <><_IconPause /> Pause</>}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={handleClear}>
            <_IconTrash /> Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-timeline__filters">
        <div className="activity-timeline__filter-group">
          <button
            className={`activity-timeline__filter-btn ${filterType === '' ? 'activity-timeline__filter-btn--active' : ''}`}
            onClick={() => setFilterType('')}
          >
            All <span className="activity-timeline__filter-count">{events.length}</span>
          </button>
          {Object.entries(EVENT_TYPES).map(([key, meta]) => {
            const count = eventTypeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                className={`activity-timeline__filter-btn ${filterType === key ? 'activity-timeline__filter-btn--active' : ''}`}
                onClick={() => setFilterType(filterType === key ? '' : key)}
              >
                {meta.label} <span className="activity-timeline__filter-count">{count}</span>
              </button>
            );
          })}
        </div>
        {agents.length > 0 && (
          <select
            className="activity-timeline__agent-filter"
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Timeline */}
      <div className={`card ${paused ? 'activity-timeline--paused' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="activity-timeline__list"
          ref={listRef}
          role="log"
          aria-label="Activity timeline"
          aria-live="polite"
        >
          {filteredEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12) 0' }}>
              <div style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}><_IconActivity /></div>
              <div className="empty-state__title" style={{ fontSize: 'var(--text-sm)' }}>No activity yet</div>
              <div className="empty-state__desc">Agent actions, task changes, and squad events will appear here in real time.</div>
            </div>
          ) : (
            filteredEvents.map((event, i) => (
              <_ActivityItem key={event.id || `${event.timestamp}-${i}`} event={event} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

/** Mount the React Activity Timeline page into a container element */
export function mountActivityTimelinePage(container) {
  const root = createRoot(container);
  root.render(<ActivityTimelinePage />);
  return () => root.unmount();
}
