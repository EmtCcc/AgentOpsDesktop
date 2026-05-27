const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentOps', {
  platform: process.platform,

  // ── Auth ──
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
    rotate: () => ipcRenderer.invoke('auth:rotate'),
  },

  agents: {
    list: (params) => ipcRenderer.invoke('agents:list', params),
    get: (id) => ipcRenderer.invoke('agents:get', { id }),
    create: (agent) => ipcRenderer.invoke('agents:create', agent),
    update: (id, updates) => ipcRenderer.invoke('agents:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('agents:delete', { id }),
    healthCheck: (id) => ipcRenderer.invoke('agents:health-check', { id }),
    spawn: (config) => ipcRenderer.invoke('agents:spawn', config),
    status: (id) => ipcRenderer.invoke('agents:status', { id }),
    kill: (id, signal) => ipcRenderer.invoke('agents:kill', { id, signal }),
  },

  goals: {
    list: (params) => ipcRenderer.invoke('goals:list', params),
    get: (id) => ipcRenderer.invoke('goals:get', { id }),
    create: (goal) => ipcRenderer.invoke('goals:create', goal),
    update: (id, updates) => ipcRenderer.invoke('goals:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('goals:delete', { id }),
  },

  tasks: {
    list: (params) => ipcRenderer.invoke('tasks:list', params),
    get: (id) => ipcRenderer.invoke('tasks:get', { id }),
    create: (task) => ipcRenderer.invoke('tasks:create', task),
    update: (id, updates) => ipcRenderer.invoke('tasks:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('tasks:delete', { id }),
  },

  logs: {
    list: (opts) => ipcRenderer.invoke('logs:list', opts),
    append: (entry) => ipcRenderer.invoke('logs:append', entry),
    onNew: (callback) => {
      const handler = (_event, entry) => callback(entry);
      ipcRenderer.on('logs:new', handler);
      return () => ipcRenderer.removeListener('logs:new', handler);
    },
  },

  stats: {
    summary: () => ipcRenderer.invoke('stats:summary'),
  },

  monitor: {
    health: () => ipcRenderer.invoke('monitor:health'),
  },
});
