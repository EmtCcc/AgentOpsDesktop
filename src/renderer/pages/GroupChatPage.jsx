import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// ── Icons ──

export const IconEdit = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const IconX = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconPlus = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconPlay = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export const IconPause = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const IconStop = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

export const IconSend = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const IconTrash = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconUsers = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconMessageSquare = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconChevronRight = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconRefresh = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ── Focus trap hook ──

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

// ── Create Chat Modal ──

export function CreateChatModal({ isOpen, onClose, onSave, agents }) {
  const [title, setTitle] = useState('');
  const [strategyType, setStrategyType] = useState('round-robin');
  const [selectedAgents, setSelectedAgents] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const toggleAgent = (agentId) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim() || selectedAgents.size < 2) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), agentIds: Array.from(selectedAgents), strategyType });
      setTitle('');
      setSelectedAgents(new Set());
      setStrategyType('round-robin');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog" aria-modal="true" aria-labelledby="chat-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === e.currentTarget) onClose(); } }}
    >
      <div className="card" style={{ width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="card__header">
          <h3 className="card__title" id="chat-modal-title">New Group Chat</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="chat-title" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Chat Title *</label>
            <input type="text" id="chat-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Architecture Discussion" style={{ width: '100%' }} />
          </div>
          <div>
            <label htmlFor="chat-strategy" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Turn Strategy</label>
            <select id="chat-strategy" value={strategyType} onChange={(e) => setStrategyType(e.target.value)} style={{ width: '100%' }}>
              <option value="round-robin">Round Robin</option>
              <option value="human-assign">Human Assign</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              Participants * (min 2)
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
              {agents.length === 0 && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', padding: 'var(--space-2)' }}>No agents available</div>
              )}
              {agents.map((agent) => (
                <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={selectedAgents.has(agent.id)} onChange={() => toggleAgent(agent.id)} />
                  <span>{agent.name}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{agent.agent_type}</span>
                </label>
              ))}
            </div>
            </label>
          </div>
        </div>
        <div className="card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!title.trim() || selectedAgents.size < 2 || saving}>
            {saving ? 'Creating...' : 'Create Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Session Modal ──

export function EditSessionModal({ isOpen, onClose, onSave, session }) {
  const [title, setTitle] = useState('');
  const [strategyType, setStrategyType] = useState('round-robin');
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (session) {
      setTitle(session.title || '');
      setStrategyType(session.strategyType || 'round-robin');
    }
  }, [session]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: session.id, title: title.trim(), strategyType });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog" aria-modal="true" aria-labelledby="edit-session-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === e.currentTarget) onClose(); } }}
    >
      <div className="card" style={{ width: 440, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="card__header">
          <h3 className="card__title" id="edit-session-title">Edit Session</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="edit-chat-title" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Chat Title</label>
            <input type="text" id="edit-chat-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chat title" style={{ width: '100%' }} />
          </div>
          <div>
            <label htmlFor="edit-chat-strategy" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Turn Strategy</label>
            <select id="edit-chat-strategy" value={strategyType} onChange={(e) => setStrategyType(e.target.value)} style={{ width: '100%' }}>
              <option value="round-robin">Round Robin</option>
              <option value="human-assign">Human Assign</option>
            </select>
          </div>
        </div>
        <div className="card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Participant Modal ──

export function AddParticipantModal({ isOpen, onClose, onSave, agents, existingParticipantIds }) {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [role, setRole] = useState('expert');
  const [saving, setSaving] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const availableAgents = agents.filter((a) => !existingParticipantIds.includes(a.id));

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      await onSave({ agentId: selectedAgent, role });
      setSelectedAgent('');
      setRole('expert');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
      role="dialog" aria-modal="true" aria-labelledby="add-participant-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 400, maxWidth: '90vw' }}>
        <div className="card__header">
          <h3 className="card__title" id="add-participant-title">Add Participant</h3>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="add-participant-agent" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Agent</label>
            <select id="add-participant-agent" value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select an agent...</option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.agent_type})</option>
              ))}
            </select>
            {availableAgents.length === 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>All agents are already participants</div>
            )}
          </div>
          <div>
            <label htmlFor="add-participant-role" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Role</label>
            <select id="add-participant-role" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
              <option value="expert">Expert</option>
              <option value="manager">Manager</option>
              <option value="observer">Observer</option>
            </select>
          </div>
        </div>
        <div className="card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!selectedAgent || saving}>
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ──

export function MessageBubble({ message, agentName, isStreaming }) {
  const isHuman = message.agentId === 'human';
  const isSystem = message.type === 'system';
  const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : '';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', padding: '2px 12px', borderRadius: 'var(--radius-full)' }}>
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isHuman ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isHuman ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
          {isHuman ? 'Human' : agentName || message.agentId}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{time}</span>
      </div>
      <div style={{
        maxWidth: '75%', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
        background: isHuman ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
        color: isHuman ? 'white' : 'var(--color-text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 'var(--text-sm)', lineHeight: 1.6,
        position: 'relative',
      }}>
        {message.content}
        {isStreaming && <span style={{ display: 'inline-block', width: 6, height: 14, background: 'currentColor', marginLeft: 2, animation: 'blink 1s step-end infinite' }} />}
      </div>
    </div>
  );
}

// ── Participant List Panel ──

export function ParticipantPanel({ participants, agentMap, engineState, strategyType, onAddParticipant, onRemoveParticipant, onStrategyChange }) {
  const statusColors = { speaking: 'var(--color-success)', listening: 'var(--color-primary)', idle: 'var(--color-text-tertiary)' };
  const statusLabels = { speaking: 'Speaking', listening: 'Listening', idle: 'Idle' };

  return (
    <div style={{ width: 220, borderLeft: '1px solid var(--color-border)', padding: 'var(--space-3)', overflowY: 'auto' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <IconUsers /> Participants ({participants.length})
        </span>
        {onAddParticipant && (
          <button className="btn btn--ghost btn--sm" onClick={onAddParticipant} title="Add participant" style={{ padding: '2px 4px' }}><IconPlus /></button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {participants.map((p) => {
          const agent = agentMap[p.agentId];
          return (
            <div key={p.agentId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[p.status] || statusColors.idle, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent?.name || p.agentId}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {p.role} &middot; {statusLabels[p.status] || p.status}
                </div>
              </div>
              {onRemoveParticipant && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => onRemoveParticipant(p.agentId)}
                  title="Remove participant"
                  style={{ padding: '2px 4px', opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                >
                  <IconX />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Strategy section */}
      {onStrategyChange && (
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Strategy</div>
          <select
            value={strategyType || 'round-robin'}
            onChange={(e) => onStrategyChange(e.target.value)}
            style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '4px 8px' }}
          >
            <option value="round-robin">Round Robin</option>
            <option value="human-assign">Human Assign</option>
          </select>
        </div>
      )}

      {/* Engine state */}
      {engineState && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          <div>Turn: {engineState.turnCount}/{engineState.maxTurns}</div>
          <div>Speaker index: {engineState.turnIndex}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ──

export function GroupChatPage() {
  const [sessions, setSessions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [engineState, setEngineState] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [streamingAgent, setStreamingAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const streamBufferRef = useRef('');

  const agentMap = {};
  for (const a of agents) agentMap[a.id] = a;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load data
  const loadSessions = useCallback(async () => {
    try {
      const result = await window.agentOps.chat.list({ limit: 50 });
      setSessions(result.items || []);
    } catch (err) { console.error('Failed to load sessions:', err); }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const result = await window.agentOps.agents.list({ limit: 100 });
      setAgents(result.items || []);
    } catch (err) { console.error('Failed to load agents:', err); }
  }, []);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      const msgs = await window.agentOps.chat.listMessages(sessionId);
      setMessages(msgs || []);
    } catch (err) { console.error('Failed to load messages:', err); }
  }, []);

  const loadSessionDetails = useCallback(async (sessionId) => {
    try {
      const session = await window.agentOps.chat.get(sessionId);
      setParticipants(session.participants || []);
      await loadMessages(sessionId);
      const state = await window.agentOps.chat.getState(sessionId);
      setEngineState(state);
    } catch (err) { console.error('Failed to load session details:', err); }
  }, [loadMessages]);

  useEffect(() => {
    Promise.all([loadSessions(), loadAgents()]).finally(() => setLoading(false));
  }, [loadSessions, loadAgents]);

  useEffect(() => {
    if (selectedSession) loadSessionDetails(selectedSession);
  }, [selectedSession, loadSessionDetails]);

  // Subscribe to real-time events
  useEffect(() => {
    const unsub = window.agentOps.chat.onEvent((event) => {
      if (!selectedSession || event.sessionId !== selectedSession) return;

      if (event.type === 'message' && event.message) {
        setMessages((prev) => [...prev, event.message]);
        setStreamingAgent(null);
        streamBufferRef.current = '';
      }

      if (event.type === 'agent-status') {
        setParticipants((prev) => prev.map((p) =>
          p.agentId === event.agentId ? { ...p, status: event.status } : p
        ));
      }

      if (event.type === 'turn-change') {
        setEngineState((prev) => prev ? { ...prev, turnIndex: event.turnIndex, turnCount: event.turnCount } : prev);
        setStreamingAgent(event.agentId);
        streamBufferRef.current = '';
      }

      if (event.type === 'stream' && event.chunk) {
        streamBufferRef.current += event.chunk;
        // Force re-render for streaming display
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.agentId === event.agentId && last._streaming) {
            return [...prev.slice(0, -1), { ...last, content: streamBufferRef.current }];
          }
          return [...prev, { id: `stream-${Date.now()}`, chatId: event.sessionId, agentId: event.agentId, content: streamBufferRef.current, type: 'chat', _streaming: true, createdAt: new Date().toISOString() }];
        });
      }

      if (event.type === 'session-status') {
        if (event.status === 'completed') {
          setStreamingAgent(null);
          setEngineState(null);
        }
        loadSessions();
      }

      if (event.type === 'error') {
        console.error('Chat engine error:', event.error);
      }
    });

    return unsub;
  }, [selectedSession, loadSessions]);

  // Handlers
  const handleCreate = async ({ title, agentIds, strategyType }) => {
    await window.agentOps.chat.create({ title, agentIds, strategyType });
    setShowCreateModal(false);
    await loadSessions();
  };

  const handleDelete = async (sessionId) => {
    if (!confirm('Delete this chat session?')) return;
    await window.agentOps.chat.delete(sessionId);
    if (selectedSession === sessionId) setSelectedSession(null);
    await loadSessions();
  };

  const handleStart = async () => {
    if (!selectedSession) return;
    await window.agentOps.chat.start(selectedSession);
    const state = await window.agentOps.chat.getState(selectedSession);
    setEngineState(state);
    await loadSessions();
  };

  const handlePause = async () => {
    if (!selectedSession) return;
    await window.agentOps.chat.pause(selectedSession);
    const state = await window.agentOps.chat.getState(selectedSession);
    setEngineState(state);
  };

  const handleResume = async () => {
    if (!selectedSession) return;
    await window.agentOps.chat.resume(selectedSession);
    const state = await window.agentOps.chat.getState(selectedSession);
    setEngineState(state);
  };

  const handleStop = async () => {
    if (!selectedSession) return;
    await window.agentOps.chat.stop(selectedSession);
    setEngineState(null);
    setStreamingAgent(null);
    await loadSessions();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedSession) return;
    const content = inputValue.trim();
    setInputValue('');
    await window.agentOps.chat.sendMessage(selectedSession, content);
  };

  const handleEditSession = async ({ id, title, strategyType }) => {
    await window.agentOps.chat.update(id, { title, strategyType });
    setShowEditModal(false);
    await loadSessions();
    if (selectedSession === id) await loadSessionDetails(id);
  };

  const handleAddParticipant = async ({ agentId, role }) => {
    await window.agentOps.chat.addParticipant(selectedSession, agentId, role);
    setShowAddParticipantModal(false);
    await loadSessionDetails(selectedSession);
  };

  const handleRemoveParticipant = async (agentId) => {
    if (!confirm('Remove this participant from the chat?')) return;
    await window.agentOps.chat.removeParticipant(selectedSession, agentId);
    await loadSessionDetails(selectedSession);
  };

  const handleStrategyChange = async (strategyType) => {
    if (!selectedSession) return;
    await window.agentOps.chat.update(selectedSession, { strategyType });
    await loadSessionDetails(selectedSession);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRefresh = () => {
    loadSessions();
    if (selectedSession) loadSessionDetails(selectedSession);
  };

  // Find the active session object
  const activeSession = sessions.find((s) => s.id === selectedSession);
  const isRunning = engineState?.running || false;

  if (loading) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Session List Sidebar ── */}
      <div style={{ width: 280, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Group Chats</h2>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <button className="btn btn--ghost btn--sm" onClick={handleRefresh} title="Refresh"><IconRefresh /></button>
            <button className="btn btn--primary btn--sm" onClick={() => setShowCreateModal(true)} title="New Chat"><IconPlus /> New</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
              No chat sessions yet.<br />Create one to get started.
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSession(session.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedSession(session.id); }}
                style={{
                  padding: 'var(--space-3)', cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                  background: selectedSession === session.id ? 'var(--color-bg-secondary)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (selectedSession !== session.id) e.currentTarget.style.background = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { if (selectedSession !== session.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
                  <span style={{
                    fontSize: 'var(--text-xs)', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                    background: session.status === 'active' ? 'var(--color-success-bg)' : session.status === 'paused' ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
                    color: session.status === 'active' ? 'var(--color-success)' : session.status === 'paused' ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                  }}>
                    {session.status}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', display: 'flex', gap: 'var(--space-2)' }}>
                  <span>{session.participants?.length || 0} agents</span>
                  <span>&middot;</span>
                  <span>{session.messageCount || 0} msgs</span>
                  <span>&middot;</span>
                  <span>{session.strategyType}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      {selectedSession ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{activeSession?.title || 'Chat'}</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {activeSession?.strategyType} &middot; {participants.length} participants &middot; {messages.length} messages
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {!isRunning && activeSession?.status !== 'completed' && (
                <button className="btn btn--primary btn--sm" onClick={activeSession?.status === 'paused' ? handleResume : handleStart}>
                  <IconPlay /> {activeSession?.status === 'paused' ? 'Resume' : 'Start'}
                </button>
              )}
              {isRunning && (
                <button className="btn btn--ghost btn--sm" onClick={handlePause}><IconPause /> Pause</button>
              )}
              {isRunning && (
                <button className="btn btn--danger btn--sm" onClick={handleStop}><IconStop /> Stop</button>
              )}
              <button className="btn btn--danger btn--sm" onClick={() => handleDelete(selectedSession)} title="Delete"><IconTrash /></button>
            </div>
          </div>

          {/* Messages + Participants */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-8)' }}>
                  <IconMessageSquare />
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>No messages yet. Start the chat to begin.</div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id || idx}
                    message={msg}
                    agentName={agentMap[msg.agentId]?.name}
                    isStreaming={msg._streaming && streamingAgent === msg.agentId}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Participant Panel */}
            <ParticipantPanel participants={participants} agentMap={agentMap} engineState={engineState} />
          </div>

          {/* Input Area */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-2)' }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              rows={2}
              style={{ flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 'var(--text-sm)' }}
            />
            <button className="btn btn--primary" onClick={handleSendMessage} disabled={!inputValue.trim()} style={{ alignSelf: 'flex-end' }}>
              <IconSend /> Send
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
          <div style={{ textAlign: 'center' }}>
            <IconMessageSquare />
            <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Select a chat or create a new one</div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateChatModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        agents={agents}
      />

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Mount/Unmount ──

export function mountGroupChatPage(container) {
  const root = createRoot(container);
  root.render(<GroupChatPage />);
  return () => root.unmount();
}
