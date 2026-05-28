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
const { Scheduler } = require('./scheduler');
const { CostGuard } = require('./cost-guard');
const { AdapterRegistry } = require('./adapter-registry');
const GenericCliAdapter = require('./adapters/generic-cli.adapter');
const orchestratorController = require('./ipc/controllers/orchestrator.controller');
const scheduleController = require('./ipc/controllers/schedule.controller');
const adapterController = require('./ipc/controllers/adapter.controller');
const updater = require('./updater');

// Initialize database and repositories
const db = getDb();
runMigrations(db);
const repos = createRepositories(db);

// Create orchestrator runtime and orchestrator
const orchestratorRuntime = new AgentRuntime();
const costGuard = new CostGuard(repos.costs);
const orchestrator = new TaskOrchestrator({ repo: repos.orchestrator, runtime: orchestratorRuntime, costGuard });
orchestratorController.setOrchestrator(orchestrator);

// Create scheduler
const scheduler = new Scheduler({ scheduleRepo: repos.schedules, taskRepo: repos.tasks });
scheduleController.setScheduler(scheduler);

// Create adapter registry and register built-in adapters
const adapterRegistry = new AdapterRegistry();
adapterRegistry.registerClass('generic-cli', GenericCliAdapter);
adapterController.setRegistry(adapterRegistry);

// Auto-load enabled adapters from DB on startup
try {
  const enabledAdapters = repos.adapters.list({ enabled: true, limit: 100 });
  for (const cfg of enabledAdapters.items) {
    try {
      if (cfg.classPath) {
        const AdapterClass = require(cfg.classPath);
        const Cls = AdapterClass.default || AdapterClass;
        adapterRegistry.registerClass(cfg.type, Cls);
      }
      adapterRegistry.load(cfg.type, cfg.config || {});
      logger.info('adapter.auto-loaded', { type: cfg.type });
    } catch (err) {
      logger.error('adapter.auto-load-failed', { type: cfg.type, error: err.message });
    }
  }
} catch { /* first run, table may not exist yet */ }

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
  await startApiServer({ repos, tokenManager, adapterRegistry });
  orchestrator.recoverOnStartup();
  scheduler.recoverOnStartup();
  scheduler.start();
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
  scheduler.stop();
  await orchestrator.shutdown();
  closeDb();
  logger.info('app.quit');
});
