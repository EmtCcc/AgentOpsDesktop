// AgentOps Desktop — Renderer Application

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── SVG Icons ──

const icons = {
  bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="6" y="14" width="12" height="8" rx="2" ry="2"/><path d="M12 16v4"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  listChecks: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  rocket: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  barChart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  terminal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  activity: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
};

// ── State ──

let currentPage = 'dashboard';
let sidebarCollapsed = false;

// ── Navigation ──

function navigate(page) {
  currentPage = page;

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
    dashboard: renderDashboard,
    agents: renderAgents,
    tasks: renderTasks,
    logs: renderLogs,
    settings: renderSettings,
  };

  const renderer = renderers[page];
  if (renderer) {
    renderer(main);
  } else {
    main.innerHTML = `<div class="empty-state"><div class="empty-state__title">Page not found</div></div>`;
  }
}

// ── Dashboard Page ──

function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__desc">Agent operations overview</p>
      </div>
    </div>

    <div class="dashboard-stats" role="region" aria-label="Dashboard statistics" aria-live="polite">
      <div class="card">
        <div class="stat__icon stat__icon--accent">${icons.bot}</div>
        <div class="stat">
          <div class="stat__value" id="stat-agents">0</div>
          <div class="stat__label">Agents</div>
        </div>
      </div>
      <div class="card">
        <div class="stat__icon stat__icon--success">${icons.listChecks}</div>
        <div class="stat">
          <div class="stat__value" id="stat-tasks">0</div>
          <div class="stat__label">Tasks</div>
        </div>
      </div>
      <div class="card">
        <div class="stat__icon stat__icon--warning">${icons.rocket}</div>
        <div class="stat">
          <div class="stat__value" id="stat-running">0</div>
          <div class="stat__label">Running</div>
        </div>
      </div>
      <div class="card">
        <div class="stat__icon stat__icon--danger">${icons.activity}</div>
        <div class="stat">
          <div class="stat__value" id="stat-errors">0</div>
          <div class="stat__label">Errors</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">Recent activity</h3>
          <button class="btn btn--ghost btn--sm" data-navigate="logs">View all</button>
        </div>
        <div class="card__body" id="activity-feed" role="log" aria-label="Recent activity" aria-live="polite">
          <div class="empty-state" style="padding: var(--space-8) 0;">
            <div style="color: var(--color-text-tertiary); margin-bottom: var(--space-2);">${icons.terminal}</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-tertiary);">No recent activity</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <h3 class="card__title">Quick actions</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <button class="btn btn--secondary" style="justify-content: flex-start;" data-navigate="agents">
            ${icons.plus} Add agent
          </button>
          <button class="btn btn--secondary" style="justify-content: flex-start;" data-navigate="tasks">
            ${icons.plus} Create task
          </button>
          <button class="btn btn--secondary" style="justify-content: flex-start;" data-navigate="settings">
            ${icons.barChart} View settings
          </button>
        </div>
      </div>
    </div>
  `;

  loadStats();
  loadRecentActivity();
  bindNavigationLinks(container);
}

async function loadStats() {
  try {
    const stats = await window.agentOps.stats.summary();
    const el = (id) => document.getElementById(id);
    if (el('stat-agents')) el('stat-agents').textContent = stats.agents.total;
    if (el('stat-tasks')) el('stat-tasks').textContent = stats.tasks.total;
    if (el('stat-running')) el('stat-running').textContent = stats.tasks.running;
    if (el('stat-errors')) el('stat-errors').textContent = stats.agents.error;
    const footerCount = el('footer-agent-count');
    if (footerCount) footerCount.textContent = `${stats.agents.total} agent${stats.agents.total !== 1 ? 's' : ''}`;
  } catch {
    // IPC not available yet
  }
}

async function loadRecentActivity() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  try {
    const logs = await window.agentOps.logs.list({ limit: 10 });
    if (!logs || logs.length === 0) return;
    feed.innerHTML = `<div class="activity-feed">${logs.reverse().map((l) => `
      <div class="activity-item">
        <div class="activity-item__icon">${l.level === 'error' ? icons.activity : icons.terminal}</div>
        <div class="activity-item__content">
          <div class="activity-item__text">${escapeHtml(l.message || l.text || '')}</div>
          <div class="activity-item__time">${formatTime(l.timestamp)}</div>
        </div>
      </div>
    `).join('')}</div>`;
  } catch { /* IPC not available */ }
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
    <div id="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; display:none; align-items:center; justify-content:center;">
      <div class="card" style="width: 440px; max-width: 90vw;">
        <div class="card__header">
          <h3 class="card__title">Add agent</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Agent name</label>
            <input type="text" id="agent-name" placeholder="e.g. Claude Code" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Type</label>
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
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Executable path</label>
            <input type="text" id="agent-path" placeholder="/usr/local/bin/claude" style="width:100%; font-family:var(--font-mono); font-size:var(--text-mono-sm);">
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Working directory</label>
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
        </div>
        <span class="status-badge status-badge--${a.status}">${a.status}</span>
        <div class="agent-row__actions">
          <button class="btn btn--ghost btn--sm btn--icon" title="Health check" data-action="health" data-id="${a.id}">${icons.refresh}</button>
          <button class="btn btn--ghost btn--sm btn--icon" title="Remove" data-action="delete" data-id="${a.id}">${icons.trash}</button>
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
      try {
        await window.agentOps.agents.delete(id);
        loadAgents();
      } catch (err) { showToast(`Failed to remove agent: ${err.message || 'Unknown error'}`); }
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
    <div id="task-modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; align-items:center; justify-content:center;">
      <div class="card" style="width: 480px; max-width: 90vw;">
        <div class="card__header">
          <h3 class="card__title">New task</h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Title</label>
            <input type="text" id="task-title" placeholder="Implement user auth" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Description</label>
            <textarea id="task-desc" placeholder="Details about the task..." style="width:100%; height:72px; resize:vertical;"></textarea>
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Assign to agent</label>
            <select id="task-agent" style="width:100%;">
              <option value="">Unassigned</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-1);">Goal (optional)</label>
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

function renderSettings(container) {
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
            <span class="badge">v0.1.0</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Platform</div>
            <div class="settings-row__desc">Operating system</div>
          </div>
          <div class="settings-row__control">
            <span class="badge">${window.agentOps?.platform || 'unknown'}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Agents</h3>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Max parallel agents</div>
            <div class="settings-row__desc">Maximum number of agents running simultaneously</div>
          </div>
          <div class="settings-row__control">
            <input type="number" value="3" min="1" max="10" style="width: 64px; text-align: center;">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Task timeout</div>
            <div class="settings-row__desc">Default timeout for agent tasks (minutes)</div>
          </div>
          <div class="settings-row__control">
            <input type="number" value="30" min="1" max="480" style="width: 64px; text-align: center;">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Logs</h3>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Log retention</div>
            <div class="settings-row__desc">Number of log entries to keep in memory</div>
          </div>
          <div class="settings-row__control">
            <input type="number" value="10000" min="1000" max="100000" step="1000" style="width: 80px; text-align: center;">
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Logs Page ──

let logsUnsubscribe = null;
let logsFilterAgent = '';
let logsFilterLevel = '';

function renderLogs(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Logs</h1>
        <p class="page-header__desc">Real-time agent output</p>
      </div>
      <div class="page-header__actions">
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
    const filtered = logsFilterLevel ? logs.filter((l) => l.level === logsFilterLevel) : logs;
    viewer.innerHTML = filtered.map((l) => logEntryHtml(l)).join('');
    viewer.scrollTop = viewer.scrollHeight;
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
  // Auto-scroll if near bottom
  if (viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 80) {
    viewer.scrollTop = viewer.scrollHeight;
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
}

// ── Utilities ──

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

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
  });

  // Header settings button
  $$('[data-page="settings"]').forEach((btn) => {
    if (!btn.classList.contains('sidebar__item')) {
      btn.addEventListener('click', () => navigate('settings'));
    }
  });

  // Initial page
  navigate('dashboard');
});
