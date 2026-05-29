import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const IconSearch = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconRefresh = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconTrash = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconTerminal = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function LogLine({ entry }) {
  const levelClass = entry.level === 'error' ? 'log-line--error' : entry.level === 'warn' ? 'log-line--warn' : '';
  return (
    <div className={`log-line ${levelClass}`} data-level={entry.level} data-agent={entry.agentId || ''}>
      <span className="log-line__ts">{formatTime(entry.timestamp)}</span>
      {entry.agentId && <span className="log-line__tag">{entry.agentId}</span>}
      {entry.stream === 'stderr' && <span className="log-line__tag log-line__tag--stderr">stderr</span>}
      <span className="log-line__msg">{entry.message || entry.text || ''}</span>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterText, setFilterText] = useState('');
  const viewerRef = useRef(null);
  const unsubRef = useRef(null);
  const searchTimerRef = useRef(null);

  const loadLogs = useCallback(async (agentId) => {
    try {
      const opts = { limit: 500 };
      if (agentId) opts.agentId = agentId;
      const data = await window.agentOps.logs.list(opts);
      if (data && data.length > 0) {
        setLogs(data);
      }
    } catch { /* IPC not available */ }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const list = await window.agentOps.agents.list();
      setAgents(list || []);
    } catch { /* IPC not available */ }
  }, []);

  useEffect(() => {
    loadLogs(filterAgent);
    loadAgents();
  }, [loadLogs, loadAgents, filterAgent]);

  // Subscribe to real-time log updates
  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = window.agentOps.logs.onNew((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        if (next.length > 1000) next.shift();
        return next;
      });
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
  }, [logs]);

  const filteredLogs = logs.filter((l) => {
    if (filterLevel && l.level !== filterLevel) return false;
    if (filterText) {
      const text = (l.message || l.text || '').toLowerCase();
      if (!text.includes(filterText.toLowerCase())) return false;
    }
    return true;
  });

  const handleSearch = (e) => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilterText(e.target.value);
    }, 300);
  };

  const handleClear = () => {
    setLogs([]);
  };

  const handleRefresh = () => {
    loadLogs(filterAgent);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Logs</h1>
          <p className="page-header__desc">Real-time agent output</p>
        </div>
        <div className="page-header__actions">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
              <IconSearch />
            </span>
            <input
              type="text"
              id="logs-search"
              placeholder="Search logs..."
              aria-label="Search logs"
              style={{ height: 28, fontSize: 'var(--text-xs)', paddingLeft: 28, width: 160 }}
              onChange={handleSearch}
            />
          </div>
          <select
            id="logs-filter-agent"
            className="logs-filter"
            aria-label="Filter by agent"
            style={{ height: 28, fontSize: 'var(--text-xs)' }}
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            id="logs-filter-level"
            className="logs-filter"
            aria-label="Filter by level"
            style={{ height: 28, fontSize: 'var(--text-xs)' }}
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="">All levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          <button className="btn btn--ghost btn--sm" id="btn-logs-clear" onClick={handleClear}>
            <IconTrash /> Clear
          </button>
          <button className="btn btn--secondary btn--sm" id="btn-logs-refresh" onClick={handleRefresh}>
            <IconRefresh /> Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="log-viewer"
          id="log-viewer"
          ref={viewerRef}
          role="log"
          aria-label="Agent logs"
          aria-live="polite"
        >
          {filteredLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12) 0' }}>
              <div style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}><IconTerminal /></div>
              <div className="empty-state__title" style={{ fontSize: 'var(--text-sm)' }}>No logs yet</div>
              <div className="empty-state__desc">Logs from agent sessions will appear here in real time.</div>
            </div>
          ) : (
            filteredLogs.map((entry, i) => <LogLine key={entry.id || i} entry={entry} />)
          )}
        </div>
      </div>
    </>
  );
}

/** Mount the React Logs page into a container element */
export function mountLogsPage(container) {
  const root = createRoot(container);
  root.render(<LogsPage />);
  return () => root.unmount();
}
