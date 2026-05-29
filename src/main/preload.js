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
    sendInput: (id, data) => _invoke('agents:sendInput', { id, data }),
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
    setOutput: (id, output) => _invoke('tasks:set-output', { id, output }),
    getUpstream: (id) => _invoke('tasks:get-upstream', { id }),
    listHandoffs: (id) => _invoke('tasks:list-handoffs', { id }),
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

  notifications: {
    get: () => ipcRenderer.invoke('notifications:get'),
    update: (config) => ipcRenderer.invoke('notifications:update', { config }),
  },

  update: {
    check: () => _invoke('update:check'),
    download: () => _invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    defer: (version) => _invoke('update:defer', { version }),
    clearDefer: () => _invoke('update:clear-defer'),
    info: () => _invoke('update:info'),
    onChecking: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('update:checking', handler);
      return () => ipcRenderer.removeListener('update:checking', handler);
    },
    onAvailable: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    onNotAvailable: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('update:not-available', handler);
      return () => ipcRenderer.removeListener('update:not-available', handler);
    },
    onProgress: (callback) => {
      const handler = (_event, progress) => callback(progress);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    onDownloaded: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
    onError: (callback) => {
      const handler = (_event, err) => callback(err);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },
  },

  orchestrator: {
    list: (params) => _invoke('orchestrator:list', params),
    get: (id) => _invoke('orchestrator:get', { id }),
    create: (definition) => _invoke('orchestrator:create', definition),
    start: (id) => _invoke('orchestrator:start', { id }),
    pause: (id) => _invoke('orchestrator:pause', { id }),
    resume: (id) => _invoke('orchestrator:resume', { id }),
    cancel: (id) => _invoke('orchestrator:cancel', { id }),
    getProgress: (id) => _invoke('orchestrator:progress', { id }),
    getTask: (dagId, taskId) => _invoke('orchestrator:task:get', { dagId, taskId }),
    completeManualTask: (dagId, taskId, output, success) =>
      _invoke('orchestrator:task:complete', { dagId, taskId, output, success }),
    onDagUpdate: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('orchestrator:event', handler);
      return () => ipcRenderer.removeListener('orchestrator:event', handler);
    },
    onTaskUpdate: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('orchestrator:event', handler);
      return () => ipcRenderer.removeListener('orchestrator:event', handler);
    },
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('orchestrator:progress', handler);
      return () => ipcRenderer.removeListener('orchestrator:progress', handler);
    },
  },

  sharedContext: {
    set: (dagId, key, value, updatedBy) => _invoke('sharedContext:set', { dagId, key, value, updatedBy }),
    get: (dagId, key) => _invoke('sharedContext:get', { dagId, key }),
    getMany: (dagId, keys) => _invoke('sharedContext:getMany', { dagId, keys }),
    list: (dagId) => _invoke('sharedContext:list', { dagId }),
    delete: (dagId, key) => _invoke('sharedContext:delete', { dagId, key }),
  },

  adapters: {
    list: (params) => _invoke('adapters:list', params),
    get: (id) => _invoke('adapters:get', { id }),
    create: (adapter) => _invoke('adapters:create', adapter),
    update: (id, updates) => _invoke('adapters:update', { id, updates }),
    delete: (id) => _invoke('adapters:delete', { id }),
    load: (id) => _invoke('adapters:load', { id }),
    unload: (id) => _invoke('adapters:unload', { id }),
    listLoaded: () => _invoke('adapters:listLoaded'),
    healthCheck: (id) => _invoke('adapters:healthCheck', { id }),
  },

  adapterRegistry: {
    search: (query, opts) => _invoke('adapterRegistry:search', { query, ...opts }),
    listInstalled: (params) => _invoke('adapterRegistry:listInstalled', params),
    getPackage: (name) => _invoke('adapterRegistry:getPackage', { name }),
    install: (name, opts) => _invoke('adapterRegistry:install', { name, ...opts }),
    installFromFile: (filePath, opts) => _invoke('adapterRegistry:installFromFile', { filePath, ...opts }),
    uninstall: (name, opts) => _invoke('adapterRegistry:uninstall', { name, ...opts }),
    update: (name, opts) => _invoke('adapterRegistry:update', { name, ...opts }),
    checkUpdates: () => _invoke('adapterRegistry:checkUpdates'),
    featured: (opts) => _invoke('adapterRegistry:featured', opts),
    scanLocal: () => _invoke('adapterRegistry:scanLocal'),
    registerLocal: (discovered) => _invoke('adapterRegistry:registerLocal', { discovered }),
  },

  cost: {
    listBudgets: (params) => _invoke('cost:listBudgets', params),
    getBudget: (id) => _invoke('cost:getBudget', { id }),
    createBudget: (budget) => _invoke('cost:createBudget', budget),
    updateBudget: (id, updates) => _invoke('cost:updateBudget', { id, updates }),
    deleteBudget: (id) => _invoke('cost:deleteBudget', { id }),
    getCostReport: (params) => _invoke('cost:getCostReport', params),
    resetBudgets: () => _invoke('cost:resetBudgets'),
    getSpendByModel: (params) => _invoke('cost:getSpendByModel', params),
    getSpendByTask: (params) => _invoke('cost:getSpendByTask', params),
    getTokensByAgent: (params) => _invoke('cost:getTokensByAgent', params),
    getSpendTrends: (params) => _invoke('cost:getSpendTrends', params),
  },

  squads: {
    list: (params) => _invoke('squads:list', params),
    get: (id) => _invoke('squads:get', { id }),
    create: (squad) => _invoke('squads:create', squad),
    update: (id, updates) => _invoke('squads:update', { id, updates }),
    delete: (id) => _invoke('squads:delete', { id }),
    addMember: (squadId, agentId, role) => _invoke('squads:addMember', { squadId, agentId, role }),
    removeMember: (squadId, agentId) => _invoke('squads:removeMember', { squadId, agentId }),
    listMembers: (squadId) => _invoke('squads:listMembers', { squadId }),
    batchStart: (squadId) => _invoke('squads:batchStart', { squadId }),
    batchStop: (squadId) => _invoke('squads:batchStop', { squadId }),
    aggregatedStatus: (squadId) => _invoke('squads:aggregatedStatus', { squadId }),
    evaluateTriggerRule: (event, squadId, agentId) => _invoke('squads:evaluateTriggerRule', { event, squadId, agentId }),
    applyTriggerRule: (event, squadId, agentId) => _invoke('squads:applyTriggerRule', { event, squadId, agentId }),
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('squad:event', handler);
      return () => ipcRenderer.removeListener('squad:event', handler);
    },
  },

  skills: {
    list: (params) => _invoke('skills:list', params),
    get: (id) => _invoke('skills:get', { id }),
    create: (skill) => _invoke('skills:create', skill),
    update: (id, updates) => _invoke('skills:update', { id, updates }),
    delete: (id) => _invoke('skills:delete', { id }),
    listTags: () => _invoke('skills:listTags'),
    searchByTags: (tags) => _invoke('skills:searchByTags', { tags }),
    importSkillMd: (content, overwrite) => _invoke('skills:importSkillMd', { content, overwrite }),
    exportSkillMd: (id) => _invoke('skills:exportSkillMd', { id }),
    validateSkillMd: (content) => _invoke('skills:validateSkillMd', { content }),
    importFromDirectory: (dirPath, overwrite) => _invoke('skills:importFromDirectory', { dirPath, overwrite }),
  },

  telemetry: {
    stats: () => _invoke('telemetry:stats'),
    setEnabled: (enabled) => _invoke('telemetry:setEnabled', { enabled }),
    exportData: () => _invoke('telemetry:export'),
    clearData: () => _invoke('telemetry:clear'),
  },

  chat: {
    list: (params) => _invoke('chat:list', params),
    get: (id) => _invoke('chat:get', { id }),
    create: (opts) => _invoke('chat:create', opts),
    update: (id, updates) => _invoke('chat:update', { id, updates }),
    delete: (id) => _invoke('chat:delete', { id }),
    start: (id) => _invoke('chat:start', { id }),
    pause: (id) => _invoke('chat:pause', { id }),
    resume: (id) => _invoke('chat:resume', { id }),
    stop: (id) => _invoke('chat:stop', { id }),
    sendMessage: (id, content) => _invoke('chat:sendMessage', { id, content }),
    listMessages: (id, since) => _invoke('chat:listMessages', { id, since }),
    addParticipant: (id, agentId, role) => _invoke('chat:addParticipant', { id, agentId, role }),
    removeParticipant: (id, agentId) => _invoke('chat:removeParticipant', { id, agentId }),
    getState: (id) => _invoke('chat:getState', { id }),
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('chat:event', handler);
      return () => ipcRenderer.removeListener('chat:event', handler);
    },
  },

  docs: {
    openApi: () => ipcRenderer.invoke('docs:api'),
  },
});
