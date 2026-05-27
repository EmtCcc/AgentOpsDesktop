const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentOps', {
  platform: process.platform,

  agents: {
    list: () => ipcRenderer.invoke('agents:list'),
    create: (agent) => ipcRenderer.invoke('agents:create', agent),
    update: (id, updates) => ipcRenderer.invoke('agents:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('agents:delete', id),
    healthCheck: (id) => ipcRenderer.invoke('agents:health-check', id),
  },

  goals: {
    list: () => ipcRenderer.invoke('goals:list'),
    create: (goal) => ipcRenderer.invoke('goals:create', goal),
    update: (id, updates) => ipcRenderer.invoke('goals:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('goals:delete', id),
  },

  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (task) => ipcRenderer.invoke('tasks:create', task),
    update: (id, updates) => ipcRenderer.invoke('tasks:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
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
});
