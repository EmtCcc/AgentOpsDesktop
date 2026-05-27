const { contextBridge, ipcRenderer } = require('electron');

// Auto-login on preload and cache the token for subsequent calls
let _authToken = null;

async function _ensureAuth() {
  if (_authToken) return _authToken;
  try {
    const session = await ipcRenderer.invoke('auth:login');
    _authToken = session?.token || null;
  } catch {
    // Login failed — calls will proceed without auth (will be rejected by router)
  }
  return _authToken;
}

// Wrapper that injects _auth into payloads for protected endpoints
async function _invoke(channel, payload) {
  const token = await _ensureAuth();
  const authPayload = token ? { ...payload, _auth: { token } } : payload;
  return ipcRenderer.invoke(channel, authPayload);
}

contextBridge.exposeInMainWorld('agentOps', {
  platform: process.platform,
  version: require('../../package.json').version,

  // ── Auth ──
  auth: {
    login: async (role) => {
      const session = await ipcRenderer.invoke('auth:login', role ? { role } : undefined);
      _authToken = session?.token || null;
      return session;
    },
    logout: async () => {
      const result = await _invoke('auth:logout');
      _authToken = null;
      return result;
    },
    status: () => ipcRenderer.invoke('auth:status'),
    rotate: async () => {
      const session = await _invoke('auth:rotate');
      _authToken = session?.token || _authToken;
      return session;
    },
  },

  agents: {
    list: (params) => _invoke('agents:list', params),
    get: (id) => _invoke('agents:get', { id }),
    create: (agent) => _invoke('agents:create', agent),
    update: (id, updates) => _invoke('agents:update', { id, updates }),
    delete: (id) => _invoke('agents:delete', { id }),
    healthCheck: (id) => _invoke('agents:health-check', { id }),
    spawn: (config) => _invoke('agents:spawn', config),
    status: (id) => _invoke('agents:status', { id }),
    kill: (id, signal) => _invoke('agents:kill', { id, signal }),
  },

  goals: {
    list: (params) => _invoke('goals:list', params),
    get: (id) => _invoke('goals:get', { id }),
    create: (goal) => _invoke('goals:create', goal),
    update: (id, updates) => _invoke('goals:update', { id, updates }),
    delete: (id) => _invoke('goals:delete', { id }),
  },

  tasks: {
    list: (params) => _invoke('tasks:list', params),
    get: (id) => _invoke('tasks:get', { id }),
    create: (task) => _invoke('tasks:create', task),
    update: (id, updates) => _invoke('tasks:update', { id, updates }),
    delete: (id) => _invoke('tasks:delete', { id }),
  },

  logs: {
    list: (opts) => _invoke('logs:list', opts),
    append: (entry) => _invoke('logs:append', entry),
    onNew: (callback) => {
      const handler = (_event, entry) => callback(entry);
      ipcRenderer.on('logs:new', handler);
      return () => ipcRenderer.removeListener('logs:new', handler);
    },
  },

  stats: {
    summary: () => _invoke('stats:summary'),
  },

  monitor: {
    health: () => ipcRenderer.invoke('monitor:health'),
  },

  settings: {
    get: () => _invoke('settings:get'),
    update: (settings) => _invoke('settings:update', { settings }),
  },

  update: {
    check: () => _invoke('update:check'),
    download: () => _invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onAvailable: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    onDownloaded: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
  },

  docs: {
    openApi: () => ipcRenderer.invoke('docs:api'),
  },
});
