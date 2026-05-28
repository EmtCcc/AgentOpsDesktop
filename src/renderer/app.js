// AgentOps Desktop — Renderer Application

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
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Agents</h1>
        <p class="page-header__desc">Manage connected CLI agents</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--primary" id="btn-add-agent">
          ${icons.plus} Add agent
        </button>
      </div>
    </div>

    <div id="agent-list" class="agent-list" role="list" aria-label="Agent list" aria-live="polite">
      <div class="empty-state">
        <div class="empty-state__icon">${icons.bot}</div>
        <div class="empty-state__title">No agents configured</div>
        <div class="empty-state__desc">Add a CLI agent to start orchestrating tasks.</div>
        <button class="btn btn--primary" id="btn-add-agent-empty">
          ${icons.plus} Add agent
        </button>
      </div>
    </div>

    <!-- Add Agent Modal -->
    <div id="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; display:none; align-items:center; justify-content:center;" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="card" style="width: 440px; max-width: 90vw;">
        <div class="card__header">
          <h3 class="card__title" id="modal-title">Add agent</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <label for="agent-name" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Agent name</label>
            <input type="text" id="agent-name" placeholder="e.g. Claude Code" style="width:100%;">
          </div>
          <div>
            <label for="agent-type" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Agent type</label>
            <select id="agent-type" style="width:100%;">
              <option value="claude">Claude Code</option>
              <option value="codex">Codex</option>
              <option value="gemini">Gemini CLI</option>
              <option value="opencode">OpenCode</option>
              <option value="cursor">Cursor</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label for="agent-path" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Executable path</label>
            <input type="text" id="agent-path" placeholder="/usr/local/bin/claude" style="width:100%; font-family:var(--font-mono); font-size:var(--text-mono-sm);">
          </div>
          <div>
            <label for="agent-cwd" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Working directory</label>
            <input type="text" id="agent-cwd" placeholder="/path/to/project" style="width:100%; font-family:var(--font-mono); font-size:var(--text-mono-sm);">
          </div>
        </div>
        <div class="card__footer">
          <button class="btn btn--secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="modal-save">Add agent</button>
        </div>
      </div>
    </div>
  `;

  loadAgents();
  bindAgentActions(container);
}

async function loadAgents() {
  try {
    const agents = await window.agentOps.agents.list();
    const list = document.getElementById('agent-list');
    if (!list) return;

    if (agents.length === 0) return; // keep empty state

    list.innerHTML = agents.map((a) => `
      <div class="agent-row" data-agent-id="${a.id}">
        <span class="status-dot status-dot--${a.status}"></span>
        <div class="agent-row__info">
          <div class="agent-row__name">${escapeHtml(a.name)}</div>
          <div class="agent-row__type">${escapeHtml(a.type || 'unknown')}</div>
          ${a.status === 'error' ? `<div class="agent-row__error" style="color:var(--color-danger);font-size:var(--text-xs);margin-top:var(--space-1);">Agent encountered an error. Check executable path and try a health check.</div>` : ''}
        </div>
        <span class="status-badge status-badge--${a.status}">${a.status}</span>
        <div class="agent-row__actions">
          <button class="btn btn--ghost btn--sm btn--icon" title="Health check" aria-label="Health check" data-action="health" data-id="${a.id}">${icons.refresh}</button>
          <button class="btn btn--ghost btn--sm btn--icon" title="Remove" aria-label="Remove agent" data-action="delete" data-id="${a.id}">${icons.trash}</button>
        </div>
      </div>
    `).join('');
  } catch {
    // IPC not available
  }
}

function bindAgentActions(container) {
  const showModal = () => {
    const overlay = container.querySelector('#modal-overlay');
    if (overlay) overlay.style.display = 'flex';
  };

  const hideModal = () => {
    const overlay = container.querySelector('#modal-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[id="btn-add-agent"], [id="btn-add-agent-empty"]');
    if (btn) { showModal(); return; }

    const cancel = e.target.closest('#modal-cancel');
    if (cancel) { hideModal(); return; }

    const save = e.target.closest('#modal-save');
    if (save) {
      const name = container.querySelector('#agent-name')?.value?.trim();
      const type = container.querySelector('#agent-type')?.value;
      const path = container.querySelector('#agent-path')?.value?.trim();
      const cwd = container.querySelector('#agent-cwd')?.value?.trim();
      if (!name) return;
      try {
        await window.agentOps.agents.create({ name, type, execPath: path, cwd });
        hideModal();
        loadAgents();
      } catch (err) { showToast(`Failed to add agent: ${err.message || 'Unknown error'}`); }
      return;
    }

    const healthBtn = e.target.closest('[data-action="health"]');
    if (healthBtn) {
      const id = healthBtn.dataset.id;
      try {
        await window.agentOps.agents.healthCheck(id);
        loadAgents();
      } catch (err) { showToast(`Health check failed: ${err.message || 'Unknown error'}`); }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const agentRow = deleteBtn.closest('.agent-row');
      const agentName = agentRow?.querySelector('.agent-row__name')?.textContent || 'this agent';
      if (confirm(`Remove "${agentName}"? This action cannot be undone.`)) {
        try {
          await window.agentOps.agents.delete(id);
          loadAgents();
          showToast('Agent removed', 'success');
        } catch (err) { showToast(`Failed to remove agent: ${err.message || 'Unknown error'}`); }
      }
      return;
    }
  });
}

// ── Tasks Page ──

function renderTasks(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Tasks</h1>
        <p class="page-header__desc">Track goals and task assignments</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--primary" id="btn-add-task">
          ${icons.plus} New task
        </button>
      </div>
    </div>

    <div class="task-columns" id="task-board" role="region" aria-label="Task board" aria-live="polite">
      <div class="task-column">
        <div class="task-column__header">
          <span class="task-column__title">Pending <span class="task-column__count" id="count-pending">0</span></span>
        </div>
        <div class="task-column__cards" id="col-pending"></div>
      </div>
      <div class="task-column">
        <div class="task-column__header">
          <span class="task-column__title">Running <span class="task-column__count" id="count-running">0</span></span>
        </div>
        <div class="task-column__cards" id="col-running"></div>
      </div>
      <div class="task-column">
        <div class="task-column__header">
          <span class="task-column__title">Done <span class="task-column__count" id="count-done">0</span></span>
        </div>
        <div class="task-column__cards" id="col-done"></div>
      </div>
      <div class="task-column">
        <div class="task-column__header">
          <span class="task-column__title">Failed <span class="task-column__count" id="count-failed">0</span></span>
        </div>
        <div class="task-column__cards" id="col-failed"></div>
      </div>
    </div>

    <!-- New Task Modal -->
    <div id="task-modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; align-items:center; justify-content:center;" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
      <div class="card" style="width: 480px; max-width: 90vw;">
        <div class="card__header">
          <h3 class="card__title" id="task-modal-title">New task</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <label for="task-title" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Title</label>
            <input type="text" id="task-title" placeholder="Implement user auth" style="width:100%;">
          </div>
          <div>
            <label for="task-desc" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Description</label>
            <textarea id="task-desc" placeholder="Details about the task..." style="width:100%; height:72px; resize:vertical;"></textarea>
          </div>
          <div>
            <label for="task-agent" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Assign to agent</label>
            <select id="task-agent" style="width:100%;">
              <option value="">Unassigned</option>
            </select>
          </div>
          <div>
            <label for="task-goal" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Goal (optional)</label>
            <select id="task-goal" style="width:100%;">
              <option value="">No goal</option>
            </select>
          </div>
        </div>
        <div class="card__footer">
          <button class="btn btn--secondary" id="task-modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="task-modal-save">Create task</button>
        </div>
      </div>
    </div>
  `;

  loadTasks();
  bindTaskActions(container);
}

async function loadTasks() {
  try {
    const tasks = await window.agentOps.tasks.list();
    const columns = { pending: [], running: [], done: [], failed: [] };
    tasks.forEach((t) => {
      const col = columns[t.status] || columns.pending;
      col.push(t);
    });

    Object.entries(columns).forEach(([status, items]) => {
      const colEl = document.getElementById(`col-${status}`);
      const countEl = document.getElementById(`count-${status}`);
      if (countEl) countEl.textContent = items.length;
      if (!colEl) return;

      if (items.length === 0) {
        colEl.innerHTML = `<div style="font-size:var(--text-sm); color:var(--color-text-tertiary); padding:var(--space-3); text-align:center;">No tasks</div>`;
        return;
      }

      colEl.innerHTML = items.map((t) => `
        <div class="task-card">
          <div class="task-card__title">${escapeHtml(t.title)}</div>
          <div class="task-card__meta">
            <span class="task-card__agent">${escapeHtml(t.assigneeAgentId || 'unassigned')}</span>
            <span>${formatTime(t.createdAt)}</span>
          </div>
        </div>
      `).join('');
    });
  } catch {
    // IPC not available
  }
}

async function bindTaskActions(container) {
  // Populate agent dropdown
  try {
    const agents = await window.agentOps.agents.list();
    const sel = container.querySelector('#task-agent');
    if (sel) agents.forEach((a) => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.name; sel.appendChild(o); });
  } catch (err) { console.warn('Failed to load agents for dropdown:', err); }

  // Populate goal dropdown
  try {
    const goals = await window.agentOps.goals.list();
    const sel = container.querySelector('#task-goal');
    if (sel) goals.forEach((g) => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.title; sel.appendChild(o); });
  } catch (err) { console.warn('Failed to load goals for dropdown:', err); }

  container.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('#btn-add-task');
    if (addBtn) {
      const overlay = container.querySelector('#task-modal-overlay');
      if (overlay) overlay.style.display = 'flex';
      return;
    }

    const cancel = e.target.closest('#task-modal-cancel');
    if (cancel) {
      const overlay = container.querySelector('#task-modal-overlay');
      if (overlay) overlay.style.display = 'none';
      return;
    }

    const save = e.target.closest('#task-modal-save');
    if (save) {
      const title = container.querySelector('#task-title')?.value?.trim();
      if (!title) return;
      const task = {
        title,
        description: container.querySelector('#task-desc')?.value?.trim() || '',
        assigneeAgentId: container.querySelector('#task-agent')?.value || undefined,
        goalId: container.querySelector('#task-goal')?.value || undefined,
      };
      try {
        await window.agentOps.tasks.create(task);
        const overlay = container.querySelector('#task-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        loadTasks();
      } catch (err) { showToast(`Failed to create task: ${err.message || 'Unknown error'}`); }
      return;
    }
  });
}

// ── Settings Page ──

let currentSettings = {};

function renderSettings(container) {
  const version = window.agentOps?.version || '0.1.0';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Settings</h1>
        <p class="page-header__desc">Application preferences</p>
      </div>
    </div>

    <div class="card" style="max-width: 640px;">
      <div class="settings-section">
        <h3 class="settings-section__title">General</h3>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">App version</div>
            <div class="settings-row__desc">Current build version</div>
          </div>
          <div class="settings-row__control">
            <span class="badge">v${escapeHtml(version)}</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Platform</div>
            <div class="settings-row__desc">Operating system</div>
          </div>
          <div class="settings-row__control">
            <span class="badge">${escapeHtml(window.agentOps?.platform || 'unknown')}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Agents</h3>
        <div class="settings-row">
          <div class="settings-row__info">
            <label class="settings-row__label" for="setting-max-agents">Max parallel agents</label>
            <div class="settings-row__desc">Maximum number of agents running simultaneously</div>
          </div>
          <div class="settings-row__control">
            <input type="number" id="setting-max-agents" value="${currentSettings.maxParallelAgents || 3}" min="1" max="10" style="width: 64px; text-align: center;">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__info">
            <label class="settings-row__label" for="setting-task-timeout">Task timeout</label>
            <div class="settings-row__desc">Default timeout for agent tasks (minutes)</div>
          </div>
          <div class="settings-row__control">
            <input type="number" id="setting-task-timeout" value="${currentSettings.taskTimeout || 30}" min="1" max="480" style="width: 64px; text-align: center;">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Logs</h3>
        <div class="settings-row">
          <div class="settings-row__info">
            <label class="settings-row__label" for="setting-log-retention">Log retention</label>
            <div class="settings-row__desc">Number of log entries to keep in memory</div>
          </div>
          <div class="settings-row__control">
            <input type="number" id="setting-log-retention" value="${currentSettings.logRetention || 10000}" min="1000" max="100000" step="1000" style="width: 80px; text-align: center;">
          </div>
        </div>
      </div>
    </div>
  `;

  loadSettings();
  bindSettingsActions(container);
}

async function loadSettings() {
  try {
    currentSettings = await window.agentOps.settings.get();
    const maxAgents = document.getElementById('setting-max-agents');
    const taskTimeout = document.getElementById('setting-task-timeout');
    const logRetention = document.getElementById('setting-log-retention');
    if (maxAgents && currentSettings.maxParallelAgents) maxAgents.value = currentSettings.maxParallelAgents;
    if (taskTimeout && currentSettings.taskTimeout) taskTimeout.value = currentSettings.taskTimeout;
    if (logRetention && currentSettings.logRetention) logRetention.value = currentSettings.logRetention;
  } catch {
    // IPC not available
  }
}

function bindSettingsActions(container) {
  const inputs = container.querySelectorAll('input[type="number"]');
  inputs.forEach((input) => {
    input.addEventListener('change', async () => {
      const settings = {
        maxParallelAgents: parseInt(container.querySelector('#setting-max-agents')?.value || '3'),
        taskTimeout: parseInt(container.querySelector('#setting-task-timeout')?.value || '30'),
        logRetention: parseInt(container.querySelector('#setting-log-retention')?.value || '10000'),
      };
      try {
        await window.agentOps.settings.update(settings);
        currentSettings = settings;
        showToast('Settings saved');
      } catch {
        showToast('Failed to save settings', 'error');
      }
    });
  });
}

// ── Logs Page ──

let logsUnsubscribe = null;
let logsFilterAgent = '';
let logsFilterLevel = '';
let logsFilterText = '';

function renderLogs(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Logs</h1>
        <p class="page-header__desc">Real-time agent output</p>
      </div>
      <div class="page-header__actions">
        <div style="position: relative;">
          <svg aria-hidden="true" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="logs-search" placeholder="Search logs..." style="height:28px; font-size:var(--text-xs); padding-left: 28px; width: 160px;">
        </div>
        <select id="logs-filter-agent" class="logs-filter" style="height:28px; font-size:var(--text-xs);">
          <option value="">All agents</option>
        </select>
        <select id="logs-filter-level" class="logs-filter" style="height:28px; font-size:var(--text-xs);">
          <option value="">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <button class="btn btn--ghost btn--sm" id="btn-logs-clear">${icons.trash} Clear</button>
        <button class="btn btn--secondary btn--sm" id="btn-logs-refresh">${icons.refresh} Refresh</button>
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div class="log-viewer" id="log-viewer" role="log" aria-label="Agent logs" aria-live="polite">
        <div class="empty-state" style="padding: var(--space-12) 0;">
          <div style="color: var(--color-text-tertiary); margin-bottom: var(--space-2);">${icons.terminal}</div>
          <div class="empty-state__title" style="font-size:var(--text-sm);">No logs yet</div>
          <div class="empty-state__desc">Logs from agent sessions will appear here in real time.</div>
        </div>
      </div>
    </div>
  `;

  loadLogs();
  loadLogAgents();
  bindLogActions(container);

  // Subscribe to real-time log updates
  if (logsUnsubscribe) logsUnsubscribe();
  logsUnsubscribe = window.agentOps.logs.onNew((entry) => {
    if (logsFilterAgent && entry.agentId !== logsFilterAgent) return;
    if (logsFilterLevel && entry.level !== logsFilterLevel) return;
    if (logsFilterText) {
      const text = (entry.message || entry.text || '').toLowerCase();
      if (!text.includes(logsFilterText.toLowerCase())) return;
    }
    appendLogEntry(entry);
  });
}

async function loadLogs() {
  const viewer = document.getElementById('log-viewer');
  if (!viewer) return;
  try {
    const opts = { limit: 500 };
    if (logsFilterAgent) opts.agentId = logsFilterAgent;
    const logs = await window.agentOps.logs.list(opts);
    if (!logs || logs.length === 0) return;
    let filtered = logsFilterLevel ? logs.filter((l) => l.level === logsFilterLevel) : logs;
    if (logsFilterText) {
      const searchLower = logsFilterText.toLowerCase();
      filtered = filtered.filter((l) => {
        const text = (l.message || l.text || '').toLowerCase();
        return text.includes(searchLower);
      });
    }
    viewer.innerHTML = filtered.map((l) => logEntryHtml(l)).join('');
    scheduleScroll(viewer);
  } catch { /* IPC not available */ }
}

async function loadLogAgents() {
  const select = document.getElementById('logs-filter-agent');
  if (!select) return;
  try {
    const agents = await window.agentOps.agents.list();
    agents.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });
  } catch { /* IPC not available */ }
}

function appendLogEntry(entry) {
  const viewer = document.getElementById('log-viewer');
  if (!viewer) return;
  // Remove empty state if present
  const empty = viewer.querySelector('.empty-state');
  if (empty) empty.remove();
  viewer.insertAdjacentHTML('beforeend', logEntryHtml(entry));
  // Auto-scroll if near bottom (batched with rAF)
  if (viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 80) {
    scheduleScroll(viewer);
  }
}

function logEntryHtml(l) {
  const levelClass = l.level === 'error' ? 'log-line--error' : l.level === 'warn' ? 'log-line--warn' : '';
  const streamTag = l.stream === 'stderr' ? '<span class="log-line__tag log-line__tag--stderr">stderr</span>' : '';
  const agentTag = l.agentId ? `<span class="log-line__tag">${escapeHtml(l.agentId)}</span>` : '';
  const ts = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '';
  return `<div class="log-line ${levelClass}"><span class="log-line__ts">${ts}</span>${agentTag}${streamTag}<span class="log-line__msg">${escapeHtml(l.message || l.text || '')}</span></div>`;
}

function bindLogActions(container) {
  container.addEventListener('click', async (e) => {
    const clearBtn = e.target.closest('#btn-logs-clear');
    if (clearBtn) {
      const viewer = document.getElementById('log-viewer');
      if (viewer) viewer.innerHTML = `<div class="empty-state" style="padding: var(--space-12) 0;"><div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">Logs cleared</div></div>`;
      return;
    }
    const refreshBtn = e.target.closest('#btn-logs-refresh');
    if (refreshBtn) { loadLogs(); return; }
  });

  const agentFilter = container.querySelector('#logs-filter-agent');
  if (agentFilter) {
    agentFilter.addEventListener('change', (e) => { logsFilterAgent = e.target.value; loadLogs(); });
  }
  const levelFilter = container.querySelector('#logs-filter-level');
  if (levelFilter) {
    levelFilter.addEventListener('change', (e) => { logsFilterLevel = e.target.value; loadLogs(); });
  }
  const searchInput = container.querySelector('#logs-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        logsFilterText = e.target.value;
        loadLogs();
      }, 300);
    });
  }
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

// ── Squads Page ──

function renderSquads(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Squads</h1>
        <p class="page-header__desc">Group agents into squads for batch orchestration</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--primary" id="btn-add-squad">
          ${icons.plus} New squad
        </button>
      </div>
    </div>

    <div id="squad-list" class="squad-list" role="list" aria-label="Squad list" aria-live="polite">
      <div class="empty-state">
        <div class="empty-state__icon">${icons.bot}</div>
        <div class="empty-state__title">No squads configured</div>
        <div class="empty-state__desc">Create a squad to group agents for batch operations.</div>
        <button class="btn btn--primary" id="btn-add-squad-empty">
          ${icons.plus} New squad
        </button>
      </div>
    </div>

    <!-- Create/Edit Squad Modal -->
    <div id="squad-modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; align-items:center; justify-content:center;" role="dialog" aria-modal="true" aria-labelledby="squad-modal-title">
      <div class="card" style="width: 520px; max-width: 90vw; max-height: 85vh; overflow-y: auto;">
        <div class="card__header">
          <h3 class="card__title" id="squad-modal-title">New squad</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <label for="squad-name" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Squad name</label>
            <input type="text" id="squad-name" placeholder="e.g. Frontend Team" style="width:100%;">
          </div>
          <div>
            <label for="squad-desc" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Description</label>
            <textarea id="squad-desc" placeholder="What does this squad do?" style="width:100%; height:56px; resize:vertical;"></textarea>
          </div>
          <div>
            <label for="squad-leader" style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Squad leader</label>
            <select id="squad-leader" style="width:100%;">
              <option value="">No leader</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Members</label>
            <div id="squad-member-checkboxes" style="display:flex; flex-direction:column; gap:var(--space-2); max-height:160px; overflow-y:auto; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-2);">
              <div style="font-size:var(--text-xs); color:var(--color-text-tertiary);">Loading agents...</div>
            </div>
          </div>
        </div>
        <div class="card__footer">
          <button class="btn btn--secondary" id="squad-modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="squad-modal-save">Create squad</button>
        </div>
      </div>
    </div>
  `;

  loadSquads();
  bindSquadActions(container);
}

async function loadSquads() {
  try {
    const result = await window.agentOps.squads.list();
    const squads = result?.items || result || [];
    const list = document.getElementById('squad-list');
    if (!list) return;

    if (squads.length === 0) return;

    list.innerHTML = squads.map((s) => {
      const members = s.members || [];
      const memberCount = members.length;
      const statusClass = s.status === 'running' ? 'squad-card--running' : s.status === 'error' ? 'squad-card--error' : '';
      const statusLabel = s.status === 'running' ? 'Running' : s.status === 'error' ? 'Error' : 'Idle';
      const statusDotClass = s.status === 'running' ? 'status-dot--running' : s.status === 'error' ? 'status-dot--error' : 'status-dot--idle';
      const leaderMember = members.find((m) => m.role === 'leader');
      const leaderName = leaderMember ? leaderMember.agentId : 'None';

      return `
        <div class="squad-card ${statusClass}" role="listitem" data-squad-id="${s.id}">
          <div class="squad-card__header">
            <div class="squad-card__info">
              <div class="squad-card__name">${escapeHtml(s.name)}</div>
              ${s.description ? `<div class="squad-card__desc">${escapeHtml(s.description)}</div>` : ''}
            </div>
            <span class="status-badge status-badge--${s.status}"><span class="status-dot ${statusDotClass}"></span> ${statusLabel}</span>
          </div>
          <div class="squad-card__meta">
            <span>${icons.bot} ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
            <span>Leader: ${escapeHtml(leaderName)}</span>
          </div>
          <div class="squad-card__members">
            ${members.map((m) => `
              <span class="squad-card__member ${m.role === 'leader' ? 'squad-card__member--leader' : ''}">${escapeHtml(m.agentId)}${m.role === 'leader' ? ' *' : ''}</span>
            `).join('')}
          </div>
          <div class="squad-card__actions">
            <button class="btn btn--ghost btn--sm" data-action="squad-start" data-id="${s.id}" title="Batch start" ${s.status === 'running' ? 'disabled' : ''}>${icons.play} Start</button>
            <button class="btn btn--ghost btn--sm" data-action="squad-stop" data-id="${s.id}" title="Batch stop" ${s.status !== 'running' ? 'disabled' : ''}>${icons.pause} Stop</button>
            <button class="btn btn--ghost btn--sm" data-action="squad-status" data-id="${s.id}" title="Status">${icons.activity} Status</button>
            <button class="btn btn--danger btn--sm" data-action="squad-delete" data-id="${s.id}" title="Delete squad">${icons.trash}</button>
          </div>
        </div>`;
    }).join('');
  } catch {
    // IPC not available
  }
}

async function _populateSquadAgentDropdowns() {
  try {
    const agents = await window.agentOps.agents.list();
    const leaderSel = document.getElementById('squad-leader');
    const memberDiv = document.getElementById('squad-member-checkboxes');
    if (!agents || agents.length === 0) {
      if (memberDiv) memberDiv.innerHTML = '<div style="font-size:var(--text-xs); color:var(--color-text-tertiary);">No agents available. Add agents first.</div>';
      return;
    }
    if (leaderSel) {
      agents.forEach((a) => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = a.name;
        leaderSel.appendChild(o);
      });
    }
    if (memberDiv) {
      memberDiv.innerHTML = agents.map((a) => `
        <label style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-sm); cursor:pointer;">
          <input type="checkbox" value="${a.id}" class="squad-member-cb">
          <span>${escapeHtml(a.name)}</span>
          <span style="font-size:var(--text-xs); color:var(--color-text-tertiary);">${escapeHtml(a.type || 'custom')}</span>
        </label>
      `).join('');
    }
  } catch { /* IPC not available */ }
}

function bindSquadActions(container) {
  const showModal = () => {
    const overlay = container.querySelector('#squad-modal-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      _populateSquadAgentDropdowns();
    }
  };

  const hideModal = () => {
    const overlay = container.querySelector('#squad-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  container.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('#btn-add-squad, #btn-add-squad-empty');
    if (addBtn) { showModal(); return; }

    const cancel = e.target.closest('#squad-modal-cancel');
    if (cancel) { hideModal(); return; }

    const save = e.target.closest('#squad-modal-save');
    if (save) {
      const name = container.querySelector('#squad-name')?.value?.trim();
      if (!name) return;
      const description = container.querySelector('#squad-desc')?.value?.trim() || '';
      const leaderId = container.querySelector('#squad-leader')?.value || null;
      const memberCbs = container.querySelectorAll('.squad-member-cb:checked');
      const members = Array.from(memberCbs).map((cb) => cb.value);
      try {
        await window.agentOps.squads.create({ name, description, leaderId, members });
        hideModal();
        // Reset form
        container.querySelector('#squad-name').value = '';
        container.querySelector('#squad-desc').value = '';
        loadSquads();
        showToast('Squad created', 'success');
      } catch (err) { showToast(`Failed to create squad: ${err.message || 'Unknown error'}`); }
      return;
    }

    const startBtn = e.target.closest('[data-action="squad-start"]');
    if (startBtn) {
      const id = startBtn.dataset.id;
      try {
        await window.agentOps.squads.batchStart(id);
        loadSquads();
        showToast('Squad started', 'success');
      } catch (err) { showToast(`Start failed: ${err.message || 'Unknown error'}`); }
      return;
    }

    const stopBtn = e.target.closest('[data-action="squad-stop"]');
    if (stopBtn) {
      const id = stopBtn.dataset.id;
      try {
        await window.agentOps.squads.batchStop(id);
        loadSquads();
        showToast('Squad stopped', 'success');
      } catch (err) { showToast(`Stop failed: ${err.message || 'Unknown error'}`); }
      return;
    }

    const statusBtn = e.target.closest('[data-action="squad-status"]');
    if (statusBtn) {
      const id = statusBtn.dataset.id;
      try {
        const status = await window.agentOps.squads.aggregatedStatus(id);
        const agentLines = (status.agents || []).map((a) => `${a.name}: ${a.status}`).join(', ');
        showToast(`Squad "${status.squadName}" — ${status.status} | ${agentLines}`);
      } catch (err) { showToast(`Status failed: ${err.message || 'Unknown error'}`); }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="squad-delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const card = deleteBtn.closest('.squad-card');
      const squadName = card?.querySelector('.squad-card__name')?.textContent || 'this squad';
      if (confirm(`Delete "${squadName}"? This will remove the squad and all member associations.`)) {
        try {
          await window.agentOps.squads.delete(id);
          loadSquads();
          showToast('Squad deleted', 'success');
        } catch (err) { showToast(`Delete failed: ${err.message || 'Unknown error'}`); }
      }
      return;
    }
  });
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
