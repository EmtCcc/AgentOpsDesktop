// AgentOps Desktop — Renderer Application
import { mountAgentsPage } from './pages/AgentsPage.jsx';
import { mountTasksPage } from './pages/TasksPage.jsx';
import { mountLogsPage } from './pages/LogsPage.jsx';
import { mountSettingsPage } from './pages/SettingsPage.jsx';
import { mountSquadsPage } from './pages/SquadsPage.jsx';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── Performance Utilities ──

const escapeHtmlCache = new Map();
function escapeHtml(str) {
  if (!str) return '';
  if (escapeHtmlCache.has(str)) return escapeHtmlCache.get(str);
  const result = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  if (escapeHtmlCache.size > 500) escapeHtmlCache.clear();
  escapeHtmlCache.set(str, result);
  return result;
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

let _reactUnmount = null; // cleanup for React-mounted pages
let _rafScroll = null;
function scheduleScroll(el) {
  if (_rafScroll) cancelAnimationFrame(_rafScroll);
  _rafScroll = requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
    _rafScroll = null;
  });
}

// ── SVG Icons ──

const icons = {
  bot: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="6" y="14" width="12" height="8" rx="2" ry="2"/><path d="M12 16v4"/></svg>',
  check: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  listChecks: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  rocket: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  barChart: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  terminal: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  plus: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  play: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  refresh: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  search: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  activity: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  restart: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  clock: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  wifiOff: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  alertTriangle: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

// ── Additional Icons ──

const landingIcons = {
  home: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  workflow: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  zap: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  shield: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  settings: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  arrowRight: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
};

// ── State ──

let _currentPage = 'landing';
let sidebarCollapsed = false;

// ── Navigation ──

function navigate(page) {
  // Cleanup React-mounted pages when leaving
  if (_reactUnmount) { _reactUnmount(); _reactUnmount = null; }

  // Cleanup dashboard subscriptions when leaving
  if (_currentPage === 'dashboard' && page !== 'dashboard') {
    if (_dashLogUnsub) { _dashLogUnsub(); _dashLogUnsub = null; }
    if (_dashOrchUnsub) { _dashOrchUnsub(); _dashOrchUnsub = null; }
    if (_dashRefreshTimer) { clearInterval(_dashRefreshTimer); _dashRefreshTimer = null; }
  }
  _currentPage = page;

  // Update sidebar active state
  $$('.sidebar__item').forEach((item) => {
    item.classList.toggle('sidebar__item--active', item.dataset.page === page);
  });

  // Render page
  renderPage(page);
}

function renderPage(page) {
  const main = $('#main-content');
  const renderers = {
    landing: renderLanding,
    dashboard: renderDashboard,
    agents: renderAgents,
    tasks: renderTasks,
    logs: renderLogs,
    settings: renderSettings,
    workflows: renderWorkflows,
    squads: renderSquads,
  };

  const renderer = renderers[page];
  if (renderer) {
    renderer(main);
  } else {
    main.innerHTML = `<div class="empty-state"><div class="empty-state__title">Page not found</div></div>`;
  }
}

// ── Landing Page ──

function renderLanding(container) {
  container.innerHTML = `
    <div class="landing">
      <div class="landing__hero">
        <h1 class="landing__title">
          Operational control for
          <span class="landing__title-highlight">autonomous agents</span>
        </h1>
        <p class="landing__subtitle">
          Monitor, manage, and orchestrate your AI agent operations from a single desktop application.
          Real-time visibility into agent status, task execution, and system health.
        </p>
        <div class="landing__actions">
          <button class="btn btn--primary btn--lg" data-navigate="dashboard">
            Get Started ${landingIcons.arrowRight}
          </button>
          <button class="btn btn--secondary btn--lg" data-navigate="agents">
            Add Agent
          </button>
        </div>
      </div>

      <div class="landing__features">
        <div class="landing__feature">
          <div class="landing__feature-icon">
            ${icons.bot}
          </div>
          <h3 class="landing__feature-title">Agent Management</h3>
          <p class="landing__feature-desc">
            Connect and manage multiple AI agents from different providers.
            Monitor health, status, and performance in real-time.
          </p>
        </div>

        <div class="landing__feature">
          <div class="landing__feature-icon">
            ${icons.listChecks}
          </div>
          <h3 class="landing__feature-title">Task Orchestration</h3>
          <p class="landing__feature-desc">
            Create, assign, and track tasks across your agent fleet.
            Kanban board for visual task management.
          </p>
        </div>

        <div class="landing__feature">
          <div class="landing__feature-icon">
            ${icons.activity}
          </div>
          <h3 class="landing__feature-title">Real-time Monitoring</h3>
          <p class="landing__feature-desc">
            Live log streaming and activity feeds. Debug agent behavior
            and track execution progress in real-time.
          </p>
        </div>
      </div>
    </div>
  `;

  bindNavigationLinks(container);
}

// ── Dashboard Page (v2) ──

let _dashLogUnsub = null;
let _dashOrchUnsub = null;
let _dashLogPaused = false;
let _dashRefreshTimer = null;

function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__desc">Real-time agent operations monitor</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--ghost btn--sm" id="dash-refresh">${icons.refresh} Refresh</button>
        <button class="btn btn--secondary btn--sm" data-navigate="logs">View all logs</button>
      </div>
    </div>

    <!-- Summary bar -->
    <div class="dashboard-summary-bar" id="dash-summary" role="region" aria-label="Summary" aria-live="polite">
      <div class="dashboard-summary-bar__item">
        <span class="dashboard-summary-bar__dot" style="background:var(--color-primary)"></span>
        <span class="dashboard-summary-bar__value" id="dash-total-agents">0</span> Agents
      </div>
      <div class="dashboard-summary-bar__item">
        <span class="dashboard-summary-bar__dot" style="background:var(--status-running)"></span>
        <span class="dashboard-summary-bar__value" id="dash-running-agents">0</span> Running
      </div>
      <div class="dashboard-summary-bar__item">
        <span class="dashboard-summary-bar__dot" style="background:var(--status-idle)"></span>
        <span class="dashboard-summary-bar__value" id="dash-idle-agents">0</span> Idle
      </div>
      <div class="dashboard-summary-bar__item">
        <span class="dashboard-summary-bar__dot" style="background:var(--status-error)"></span>
        <span class="dashboard-summary-bar__value" id="dash-error-agents">0</span> Errors
      </div>
      <div class="dashboard-summary-bar__item">
        <span class="dashboard-summary-bar__dot" style="background:var(--color-info)"></span>
        <span class="dashboard-summary-bar__value" id="dash-total-tasks">0</span> Tasks
      </div>
    </div>

    <div class="dashboard-v2-grid">
      <!-- Row 1: Agent status + Task kanban -->
      <div class="dashboard-v2-row">
        <!-- Agent status cards -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">${icons.bot} Agent Status</h3>
            <button class="btn btn--ghost btn--sm" data-navigate="agents">Manage</button>
          </div>
          <div class="card__body">
            <div class="dashboard-agents-grid" id="dash-agents" role="list" aria-label="Agent status cards">
              <div class="empty-state" style="padding:var(--space-6) 0;">
                <div style="color:var(--color-text-tertiary);margin-bottom:var(--space-2);">${icons.bot}</div>
                <div style="font-size:var(--text-sm);color:var(--color-text-tertiary);">No agents configured</div>
                <button class="btn btn--primary btn--sm" style="margin-top:var(--space-3);" data-navigate="agents">${icons.plus} Add agent</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Task kanban -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">${icons.listChecks} Task Progress</h3>
            <button class="btn btn--ghost btn--sm" data-navigate="tasks">View all</button>
          </div>
          <div class="card__body">
            <div class="dashboard-kanban" id="dash-kanban" role="region" aria-label="Task board">
              <div class="dashboard-kanban__col">
                <div class="dashboard-kanban__col-header">Pending <span class="dashboard-kanban__col-count" id="dk-pending">0</span></div>
                <div class="dashboard-kanban__items" id="dk-col-pending"></div>
              </div>
              <div class="dashboard-kanban__col">
                <div class="dashboard-kanban__col-header">Running <span class="dashboard-kanban__col-count" id="dk-running">0</span></div>
                <div class="dashboard-kanban__items" id="dk-col-running"></div>
              </div>
              <div class="dashboard-kanban__col">
                <div class="dashboard-kanban__col-header">Done <span class="dashboard-kanban__col-count" id="dk-done">0</span></div>
                <div class="dashboard-kanban__items" id="dk-col-done"></div>
              </div>
              <div class="dashboard-kanban__col">
                <div class="dashboard-kanban__col-header">Failed <span class="dashboard-kanban__col-count" id="dk-failed">0</span></div>
                <div class="dashboard-kanban__items" id="dk-col-failed"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Live log stream -->
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">${icons.terminal} Live Log Stream</h3>
          <div class="dashboard-log-stream__controls">
            <button class="btn btn--ghost btn--sm" id="dash-log-pause">${icons.pause} Pause</button>
            <button class="btn btn--ghost btn--sm" id="dash-log-clear">${icons.trash} Clear</button>
          </div>
        </div>
        <div class="card__body" style="padding:0;">
          <div class="dashboard-log-stream" id="dash-log-stream" role="log" aria-label="Live log stream" aria-live="polite">
            <div class="empty-state" style="padding:var(--space-8) 0;">
              <div style="color:var(--color-text-tertiary);margin-bottom:var(--space-2);">${icons.terminal}</div>
              <div style="font-size:var(--text-sm);color:var(--color-text-tertiary);">Waiting for agent output...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  loadDashAgents();
  loadDashTasks();
  loadDashLogs();
  bindDashActions(container);
  subscribeDashEvents();
  bindNavigationLinks(container);
}

// ── Dashboard: Agent status cards ──

async function loadDashAgents() {
  const grid = document.getElementById('dash-agents');
  if (!grid) return;
  try {
    const agents = await window.agentOps.agents.list();
    if (!agents || agents.length === 0) return;

    // Update summary bar
    const total = agents.length;
    const running = agents.filter((a) => a.status === 'running').length;
    const idle = agents.filter((a) => a.status === 'idle' || a.status === 'created').length;
    const errors = agents.filter((a) => a.status === 'error').length;
    const el = (id) => document.getElementById(id);
    if (el('dash-total-agents')) el('dash-total-agents').textContent = total;
    if (el('dash-running-agents')) el('dash-running-agents').textContent = running;
    if (el('dash-idle-agents')) el('dash-idle-agents').textContent = idle;
    if (el('dash-error-agents')) el('dash-error-agents').textContent = errors;

    // Virtual list: only render first 50, use sentinel for rest
    const MAX_RENDER = 50;
    const visible = agents.slice(0, MAX_RENDER);

    grid.innerHTML = visible.map((a) => {
      const statusClass = a.status === 'error' ? 'dashboard-agent-card--error' : '';
      const statusLabel = _statusLabel(a.status);
      const statusIcon = _statusIcon(a.status);
      const restartBtn = a.status === 'error'
        ? `<button class="btn btn--danger btn--sm" data-action="restart-agent" data-id="${a.id}" title="Restart agent">${icons.restart} Restart</button>`
        : '';
      return `
        <div class="dashboard-agent-card ${statusClass}" role="listitem" data-agent-id="${a.id}">
          <div class="dashboard-agent-card__header">
            <span class="dashboard-agent-card__name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
            <span class="dashboard-agent-card__status dashboard-agent-card__status--${a.status}">${statusIcon} ${statusLabel}</span>
          </div>
          <div class="dashboard-agent-card__type">${escapeHtml(a.type || 'custom')}</div>
          <div class="dashboard-agent-card__actions">${restartBtn}</div>
        </div>`;
    }).join('');

    if (agents.length > MAX_RENDER) {
      grid.insertAdjacentHTML('beforeend',
        `<div style="grid-column:1/-1;text-align:center;padding:var(--space-3);font-size:var(--text-xs);color:var(--color-text-tertiary);">
          +${agents.length - MAX_RENDER} more agents — <a href="#" data-navigate="agents" style="color:var(--color-primary);">view all</a>
        </div>`);
    }

    // Update footer count
    const footerCount = document.getElementById('footer-agent-count');
    if (footerCount) footerCount.textContent = `${total} agent${total !== 1 ? 's' : ''}`;
  } catch { /* IPC not available */ }
}

function _statusLabel(status) {
  const map = { idle: 'Idle', running: 'Running', error: 'Error', offline: 'Offline', created: 'Created', paused: 'Paused', terminated: 'Stopped' };
  return map[status] || status || 'Unknown';
}

function _statusIcon(status) {
  if (status === 'running') return `<span class="status-dot status-dot--running"></span>`;
  if (status === 'error') return icons.alertTriangle;
  if (status === 'offline') return icons.wifiOff;
  if (status === 'paused') return icons.pause;
  return icons.clock;
}

// ── Dashboard: Task kanban ──

async function loadDashTasks() {
  try {
    const tasks = await window.agentOps.tasks.list();
    if (!tasks) return;

    // Update summary
    const el = (id) => document.getElementById(id);
    if (el('dash-total-tasks')) el('dash-total-tasks').textContent = tasks.length;

    const columns = { pending: [], running: [], done: [], failed: [] };
    tasks.forEach((t) => {
      const col = columns[t.status] || columns.pending;
      col.push(t);
    });

    for (const [status, items] of Object.entries(columns)) {
      const countEl = el(`dk-${status}`);
      if (countEl) countEl.textContent = items.length;
      const colEl = el(`dk-col-${status}`);
      if (!colEl) continue;
      if (items.length === 0) {
        colEl.innerHTML = `<div style="font-size:var(--text-xs);color:var(--color-text-tertiary);padding:var(--space-2);text-align:center;">None</div>`;
      } else {
        colEl.innerHTML = items.slice(0, 20).map((t) => `
          <div class="dashboard-kanban__item" data-task-id="${t.id}">
            <div class="dashboard-kanban__item-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
            <div class="dashboard-kanban__item-meta">${t.agentId ? escapeHtml(t.agentId) : 'unassigned'}</div>
          </div>
        `).join('');
        if (items.length > 20) {
          colEl.insertAdjacentHTML('beforeend',
            `<div style="font-size:var(--text-xs);color:var(--color-text-tertiary);padding:var(--space-2);text-align:center;">+${items.length - 20} more</div>`);
        }
      }
    }
  } catch { /* IPC not available */ }
}

// ── Dashboard: Log stream ──

async function loadDashLogs() {
  const viewer = document.getElementById('dash-log-stream');
  if (!viewer) return;
  try {
    const logs = await window.agentOps.logs.list({ limit: 100 });
    if (!logs || logs.length === 0) return;
    viewer.innerHTML = logs.map((l) => _dashLogLine(l)).join('');
    scheduleScroll(viewer);
  } catch { /* IPC not available */ }
}

function _dashLogLine(entry) {
  const levelClass = entry.level === 'error' ? 'log-line--error' : entry.level === 'warn' ? 'log-line--warn' : '';
  const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
  const agent = entry.agentId ? `<span class="log-line__tag">${escapeHtml(entry.agentId)}</span>` : '';
  return `<div class="log-line ${levelClass}"><span class="log-line__ts">${ts}</span>${agent}<span class="log-line__msg">${escapeHtml(entry.message || entry.text || '')}</span></div>`;
}

// ── Dashboard: Real-time subscriptions ──

function subscribeDashEvents() {
  // Unsubscribe previous
  if (_dashLogUnsub) { _dashLogUnsub(); _dashLogUnsub = null; }
  if (_dashOrchUnsub) { _dashOrchUnsub(); _dashOrchUnsub = null; }
  if (_dashRefreshTimer) { clearInterval(_dashRefreshTimer); _dashRefreshTimer = null; }

  // Log stream subscription
  _dashLogUnsub = window.agentOps.logs.onNew((entry) => {
    if (_dashLogPaused) return;
    const viewer = document.getElementById('dash-log-stream');
    if (!viewer) return;
    const empty = viewer.querySelector('.empty-state');
    if (empty) empty.remove();
    viewer.insertAdjacentHTML('beforeend', _dashLogLine(entry));
    // Keep max 500 lines in DOM
    while (viewer.children.length > 500) viewer.removeChild(viewer.firstChild);
    if (viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 120) {
      scheduleScroll(viewer);
    }
  });

  // Orchestrator events — refresh agent/task data on changes
  _dashOrchUnsub = window.agentOps.orchestrator.onDagUpdate((evt) => {
    if (evt && (evt.type?.startsWith('task:') || evt.type?.startsWith('dag:'))) {
      loadDashAgents();
      loadDashTasks();
    }
  });

  // Periodic refresh (10s) for agent status changes not caught by events
  _dashRefreshTimer = setInterval(() => {
    if (_currentPage !== 'dashboard') {
      clearInterval(_dashRefreshTimer);
      _dashRefreshTimer = null;
      return;
    }
    loadDashAgents();
  }, 10000);
}

// ── Dashboard: Actions ──

function bindDashActions(container) {
  container.addEventListener('click', async (e) => {
    // Restart agent
    const restartBtn = e.target.closest('[data-action="restart-agent"]');
    if (restartBtn) {
      const id = restartBtn.dataset.id;
      restartBtn.disabled = true;
      restartBtn.textContent = 'Restarting...';
      try {
        // Kill then re-spawn via health check (best effort)
        await window.agentOps.agents.kill(id);
        await window.agentOps.agents.healthCheck(id);
        showToast('Agent restart initiated', 'success');
        setTimeout(() => loadDashAgents(), 1000);
      } catch (err) {
        showToast(`Restart failed: ${err.message || 'Unknown error'}`);
        restartBtn.disabled = false;
        restartBtn.innerHTML = `${icons.restart} Restart`;
      }
      return;
    }

    // Pause/resume log stream
    const pauseBtn = e.target.closest('#dash-log-pause');
    if (pauseBtn) {
      _dashLogPaused = !_dashLogPaused;
      pauseBtn.innerHTML = _dashLogPaused ? `${icons.play} Resume` : `${icons.pause} Pause`;
      const viewer = document.getElementById('dash-log-stream');
      if (viewer) viewer.classList.toggle('dashboard-log-stream--paused', _dashLogPaused);
      return;
    }

    // Clear log stream
    const clearBtn = e.target.closest('#dash-log-clear');
    if (clearBtn) {
      const viewer = document.getElementById('dash-log-stream');
      if (viewer) viewer.innerHTML = `<div class="empty-state" style="padding:var(--space-8) 0;"><div style="font-size:var(--text-sm);color:var(--color-text-tertiary);">Logs cleared</div></div>`;
      return;
    }

    // Manual refresh
    const refreshBtn = e.target.closest('#dash-refresh');
    if (refreshBtn) {
      loadDashAgents();
      loadDashTasks();
      loadDashLogs();
      return;
    }
  });
}

// ── Agents Page ──

function renderAgents(container) {
  container.innerHTML = '<div id="react-agents-root"></div>';
  const root = container.querySelector('#react-agents-root');
  _reactUnmount = mountAgentsPage(root);
}

// ── Tasks Page ──

function renderTasks(container) {
  container.innerHTML = '<div id="react-tasks-root"></div>';
  const root = container.querySelector('#react-tasks-root');
  _reactUnmount = mountTasksPage(root);
}

// ── Settings Page ──

function renderSettings(container) {
  container.innerHTML = '<div id="react-settings-root"></div>';
  const root = container.querySelector('#react-settings-root');
  _reactUnmount = mountSettingsPage(root);
}

// ── Logs Page ──

function renderLogs(container) {
  container.innerHTML = '<div id="react-logs-root"></div>';
  const root = container.querySelector('#react-logs-root');
  _reactUnmount = mountLogsPage(root);
}

// ── Utilities ──

function showToast(message, type = 'error') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'assertive');
    container.style.cssText = 'position:fixed;top:var(--space-4);right:var(--space-4);z-index:var(--z-toast);display:flex;flex-direction:column;gap:var(--space-2);pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'var(--color-danger)' : type === 'success' ? 'var(--color-success)' : 'var(--color-info)';
  toast.style.cssText = `background:${bgColor};color:white;padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--text-sm);box-shadow:var(--shadow-lg);pointer-events:auto;max-width:400px;animation:fadeIn var(--motion-normal) ease;`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity var(--motion-normal)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function bindNavigationLinks(ctx) {
  ctx.querySelectorAll('[data-navigate]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.navigate));
  });
}

// ── Squads Page (React) ──

function renderSquads(container) {
  container.innerHTML = '<div id="react-squads-root"></div>';
  const root = container.querySelector('#react-squads-root');
  _reactUnmount = mountSquadsPage(root);
}

// ── Workflows Page ──

function renderWorkflows(container) {
  container.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">Workflows</h1>
          <p class="page-header__desc">Manage automated workflows and pipelines</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--primary" id="btn-create-workflow">
            ${icons.plus} Create workflow
          </button>
        </div>
      </div>

      <div class="empty-state">
        <div class="empty-state__icon">${landingIcons.workflow}</div>
        <div class="empty-state__title">No workflows configured</div>
        <div class="empty-state__desc">Create automated workflows to orchestrate complex agent tasks.</div>
        <div class="empty-state__actions">
          <button class="btn btn--primary">
            ${icons.plus} Create workflow
          </button>
          <button class="btn btn--secondary">
            Learn more
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      sidebar.classList.toggle('sidebar--collapsed', sidebarCollapsed);
    });
  }

  // Sidebar navigation
  $$('.sidebar__item[data-page]').forEach((item) => {
    item.addEventListener('click', () => navigate(item.dataset.page));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(item.dataset.page);
      }
    });
  });

  // Header settings button
  $$('[data-page="settings"]').forEach((btn) => {
    if (!btn.classList.contains('sidebar__item')) {
      btn.addEventListener('click', () => navigate('settings'));
    }
  });

  // Debounced global search
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    const debouncedSearch = debounce((query) => {
      if (query.length < 2) return;
      // Future: dispatch search across agents, tasks, logs
      console.debug('[search]', query);
    }, 250);
    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
  }

  // ⌘K shortcut to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // Set version dynamically
  const version = window.agentOps?.version || '0.1.0';
  const sidebarVersion = document.getElementById('sidebar-version');
  const footerVersion = document.getElementById('footer-version');
  if (sidebarVersion) sidebarVersion.textContent = `v${version}`;
  if (footerVersion) footerVersion.textContent = `v${version}`;

  // Initial page
  navigate('landing');
});
