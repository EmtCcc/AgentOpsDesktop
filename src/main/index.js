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
const agentControllerRef = require('./ipc/controllers/agent.controller');
const { TaskOrchestrator } = require('./task-orchestrator');
const { Scheduler } = require('./scheduler');
const { CostGuard } = require('./cost-guard');
const { AdapterRegistry } = require('./adapter-registry');
const GenericCliAdapter = require('./adapters/generic-cli.adapter');
const orchestratorController = require('./ipc/controllers/orchestrator.controller');
const scheduleController = require('./ipc/controllers/schedule.controller');
const adapterController = require('./ipc/controllers/adapter.controller');
const adapterRegistryController = require('./ipc/controllers/adapter-registry.controller');
const { RemoteRegistryClient } = require('./adapter-registry-client');
const { AdapterRegistryService } = require('./adapter-registry-service');
const { createMessageBus, SocketBusServer } = require('./message-bus');
const { GroupChatEngine } = require('./group-chat-engine');
const updater = require('./updater');
const { detectAndRegister } = require('./cli-scanner');
const telemetry = require('./telemetry');
const { NotificationService } = require('./notification-service');

// Initialize database and repositories
const db = getDb();
runMigrations(db);
const repos = createRepositories(db);

// Create MessageBus with persistence and Unix socket server
const messageBus = createMessageBus({ db });
const busSocketPath = path.join(app.getPath('userData'), 'agent-bus.sock');
const socketBusServer = new SocketBusServer(messageBus, {
  socketPath: busSocketPath,
  squadRepo: repos.squads,
});

// Create orchestrator runtime and orchestrator
const orchestratorRuntime = new AgentRuntime({ skillRepo: repos.skills, busSocketPath });
const { EventEmitter } = require('events');
const costEvents = new EventEmitter();
const costGuard = new CostGuard(repos.costs, costEvents);
const orchestrator = new TaskOrchestrator({ repo: repos.orchestrator, runtime: orchestratorRuntime, costGuard, skillRepo: repos.skills, squadRepo: repos.squads, bus: messageBus });
orchestratorController.setOrchestrator(orchestrator);

// Create scheduler
const scheduler = new Scheduler({ scheduleRepo: repos.schedules, taskRepo: repos.tasks });
scheduleController.setScheduler(scheduler);

// Create adapter registry and register built-in adapters
const adapterRegistry = new AdapterRegistry();
adapterRegistry.registerClass('generic-cli', GenericCliAdapter);
adapterController.setRegistry(adapterRegistry);

// Create group chat engine
const chatRuntime = new AgentRuntime({ skillRepo: repos.skills, busSocketPath });
const chatEngine = new GroupChatEngine({ chatRepo: repos.chats, agentRepo: repos.agents, runtime: chatRuntime });

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

// Auto-detect CLI agents on PATH and persist to adapter_configs
detectAndRegister(repos.adapters).then((result) => {
  if (result.registered.length > 0) {
    logger.info('cli-scanner.registered', { types: result.registered });
  }
  if (result.skipped.length > 0) {
    logger.info('cli-scanner.skipped-existing', { types: result.skipped });
  }
}).catch((err) => {
  logger.error('cli-scanner.failed', { error: err.message });
});

// Create adapter registry service (community adapters)
const registryClient = new RemoteRegistryClient();
const adapterRegistryService = new AdapterRegistryService({
  packageRepo: repos.adapterPackages,
  registryClient,
  runtimeRegistry: adapterRegistry,
  adapterRepo: repos.adapters,
  adaptersDir: path.join(app.getPath('userData'), 'adapters'),
});
adapterRegistryController.setService(adapterRegistryService);

// Install global error handlers before anything else
monitor.installGlobalHandlers();

// Create notification service for OS-level agent event alerts
const notificationService = new NotificationService({
  settingsRepo: repos.settings,
  runtime: orchestratorRuntime,
  engine: agentControllerRef._engine,
  costEmitter: costEvents,
});

// Initialize telemetry (opt-in, GDPR compliant)
telemetry.init(repos.settings, repos.telemetry);

// Wrap ipcMain.handle with latency tracking
const _originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, handler) => {
  _originalHandle(channel, async (event, ...args) => {
    const start = Date.now();
    try {
      const result = await handler(event, ...args);
      const latencyMs = Date.now() - start;
      monitor.recordIpcCall(channel, latencyMs, null);
      telemetry.track('ipc.call', { channel, latencyMs, success: true });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - start;
      monitor.recordIpcCall(channel, latencyMs, err);
      telemetry.track('ipc.error', { channel, latencyMs, error: err.message });
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

  // Start MessageBus socket server for agent-to-agent communication
  await socketBusServer.listen();
  logger.info('bus.socket-ready', { path: busSocketPath });

  createWindow();
  bootstrapRoutes(mainWindow, repos, undefined, { notificationService, chatEngine });
  await startApiServer({ repos, tokenManager, adapterRegistry, adapterRegistryService, agentEngine: agentControllerRef._engine });
  orchestrator.recoverOnStartup();
  scheduler.recoverOnStartup();
  scheduler.start();
  updater.init(mainWindow);
  updater.checkForUpdates();
  notificationService.start();
  logger.info('ipc.bootstrapped');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', async () => {
  notificationService.stop();
  telemetry.shutdown();
  monitor.stopHealthLoop();
  scheduler.stop();
  await orchestrator.shutdown();
  await socketBusServer.close();
  messageBus.close();
  closeDb();
  logger.info('app.quit');
});
