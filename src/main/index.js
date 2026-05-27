const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const logger = require('./logger');
const monitor = require('./monitor');

// Install global error handlers before anything else
monitor.installGlobalHandlers();

// Wrap ipcMain.handle with latency tracking
const _originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, handler) => {
  _originalHandle(channel, async (event, ...args) => {
    const start = Date.now();
    try {
      const result = await handler(event, ...args);
      monitor.recordIpcCall(channel, Date.now() - start, null);
      return result;
    } catch (err) {
      monitor.recordIpcCall(channel, Date.now() - start, err);
      throw err;
    }
  });
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0D1117',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    monitor.recordRendererCrash(details);
  });

  mainWindow.on('unresponsive', () => {
    monitor.recordRendererUnresponsive();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  logger.info('window.created', { width: 1280, height: 800 });
}

app.whenReady().then(() => {
  monitor.startHealthLoop();
  logger.info('app.ready', { version: app.getVersion(), platform: process.platform });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  monitor.stopHealthLoop();
  logger.info('app.quit');
});

// ── Monitoring IPC ──

ipcMain.handle('monitor:health', () => monitor.getHealth());

// ── In-memory data stores ──

const agents = new Map();
const goals = new Map();
const tasks = new Map();
const logs = [];

let nextAgentId = 1;
let nextGoalId = 1;
let nextTaskId = 1;

// ── Agents ──

ipcMain.handle('agents:list', () => Array.from(agents.values()));

ipcMain.handle('agents:create', (_event, agent) => {
  const id = `agent-${nextAgentId++}`;
  const record = { id, status: 'idle', createdAt: Date.now(), ...agent };
  agents.set(id, record);
  return record;
});

ipcMain.handle('agents:update', (_event, { id, updates }) => {
  const existing = agents.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  agents.set(id, updated);
  return updated;
});

ipcMain.handle('agents:delete', (_event, id) => agents.delete(id));

ipcMain.handle('agents:health-check', async (_event, id) => {
  const agent = agents.get(id);
  if (!agent) return { status: 'error', message: 'Agent not found' };
  const isHealthy = Math.random() > 0.1;
  agent.status = isHealthy ? 'idle' : 'error';
  agent.lastHealthCheck = Date.now();
  agents.set(id, agent);
  return { status: agent.status, timestamp: agent.lastHealthCheck };
});

// ── Goals ──

ipcMain.handle('goals:list', () => Array.from(goals.values()));

ipcMain.handle('goals:create', (_event, goal) => {
  const id = `goal-${nextGoalId++}`;
  const record = { id, status: 'active', createdAt: Date.now(), taskIds: [], ...goal };
  goals.set(id, record);
  return record;
});

ipcMain.handle('goals:update', (_event, { id, updates }) => {
  const existing = goals.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  goals.set(id, updated);
  return updated;
});

ipcMain.handle('goals:delete', (_event, id) => goals.delete(id));

// ── Tasks ──

ipcMain.handle('tasks:list', () => Array.from(tasks.values()));

ipcMain.handle('tasks:create', (_event, task) => {
  const id = `task-${nextTaskId++}`;
  const record = { id, status: 'pending', createdAt: Date.now(), ...task };
  tasks.set(id, record);
  if (task.goalId) {
    const goal = goals.get(task.goalId);
    if (goal) {
      goal.taskIds = [...(goal.taskIds || []), id];
      goals.set(task.goalId, goal);
    }
  }
  return record;
});

ipcMain.handle('tasks:update', (_event, { id, updates }) => {
  const existing = tasks.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  tasks.set(id, updated);
  return updated;
});

ipcMain.handle('tasks:delete', (_event, id) => tasks.delete(id));

// ── Logs ──

ipcMain.handle('logs:list', (_event, { agentId, limit = 200 } = {}) => {
  let filtered = agentId ? logs.filter((l) => l.agentId === agentId) : logs;
  return filtered.slice(-limit);
});

ipcMain.handle('logs:append', (_event, entry) => {
  const record = { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), ...entry };
  logs.push(record);
  if (logs.length > 10000) logs.splice(0, logs.length - 10000);
  mainWindow?.webContents.send('logs:new', record);
  return record;
});

// ── Stats ──

ipcMain.handle('stats:summary', () => {
  const agentList = Array.from(agents.values());
  const taskList = Array.from(tasks.values());
  return {
    agents: {
      total: agentList.length,
      running: agentList.filter((a) => a.status === 'running').length,
      idle: agentList.filter((a) => a.status === 'idle').length,
      error: agentList.filter((a) => a.status === 'error').length,
    },
    tasks: {
      total: taskList.length,
      pending: taskList.filter((t) => t.status === 'pending').length,
      running: taskList.filter((t) => t.status === 'running').length,
      done: taskList.filter((t) => t.status === 'done').length,
      failed: taskList.filter((t) => t.status === 'failed').length,
    },
  };
});
