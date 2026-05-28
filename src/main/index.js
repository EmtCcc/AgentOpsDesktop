const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const logger = require('./logger');
const monitor = require('./monitor');
const { getDb, closeDb } = require('./db/connection');
const { runMigrations } = require('./db/migrations');
const { createRepositories } = require('./repositories');
const { bootstrapRoutes, tokenManager } = require('./ipc');
const { startApiServer } = require('./api/server');
const { AgentRuntime } = require('./agent-runtime');
const { TaskOrchestrator } = require('./task-orchestrator');
const orchestratorController = require('./ipc/controllers/orchestrator.controller');
const updater = require('./updater');

// Initialize database and repositories
const db = getDb();
runMigrations(db);
const repos = createRepositories(db);

// Create orchestrator runtime and orchestrator
const orchestratorRuntime = new AgentRuntime();
const orchestrator = new TaskOrchestrator({ repo: repos.orchestrator, runtime: orchestratorRuntime });
orchestratorController.setOrchestrator(orchestrator);

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

app.whenReady().then(async () => {
  monitor.startHealthLoop();
  logger.info('app.ready', { version: app.getVersion(), platform: process.platform });
  createWindow();
  bootstrapRoutes(mainWindow, repos);
  await startApiServer({ repos, tokenManager });
  orchestrator.recoverOnStartup();
  updater.init(mainWindow);
  updater.checkForUpdates();
  logger.info('ipc.bootstrapped');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', async () => {
  monitor.stopHealthLoop();
  await orchestrator.shutdown();
  closeDb();
  logger.info('app.quit');
});
