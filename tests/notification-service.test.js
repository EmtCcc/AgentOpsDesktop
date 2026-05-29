import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('../src/main/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// We still need to mock electron for the module import, but tests inject their own ctor
vi.mock('electron', () => ({
  Notification: vi.fn(),
}));

import { NotificationService, DEFAULT_CONFIG, EVENT_LABELS } from '../src/main/notification-service.js';

function createMockNotificationCtor() {
  const instances = [];
  function MockNotification(opts) {
    this.title = opts.title;
    this.body = opts.body;
    this.silent = opts.silent;
    this._handlers = {};
    this.show = vi.fn();
    this.on = vi.fn((event, handler) => { this._handlers[event] = handler; });
    instances.push(this);
  }
  MockNotification.isSupported = vi.fn(() => true);
  MockNotification.instances = instances;
  return MockNotification;
}

function createMockSettingsRepo(overrides = {}) {
  const store = {
    notifications: { ...DEFAULT_CONFIG, ...overrides },
  };
  return {
    get: vi.fn((key) => store[key]),
    set: vi.fn((key, value) => { store[key] = value; }),
  };
}

function createMockRuntime() {
  const runtime = new EventEmitter();
  runtime.agents = new Map();
  return runtime;
}

function createMockEngine() {
  const engine = new EventEmitter();
  engine.agents = new Map();
  return engine;
}

describe('NotificationService', () => {
  let settingsRepo;
  let runtime;
  let engine;
  let costEmitter;
  let service;
  let MockNotification;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsRepo = createMockSettingsRepo();
    runtime = createMockRuntime();
    engine = createMockEngine();
    costEmitter = new EventEmitter();
    MockNotification = createMockNotificationCtor();
    service = new NotificationService({
      settingsRepo, runtime, engine, costEmitter,
      NotificationCtor: MockNotification,
    });
  });

  afterEach(() => {
    service.stop();
  });

  describe('getConfig / setConfig', () => {
    it('returns defaults when no stored config', () => {
      settingsRepo.get = vi.fn(() => undefined);
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.events.taskCompleted).toBe(true);
      expect(config.events.agentError).toBe(true);
      expect(config.events.budgetWarning).toBe(true);
    });

    it('merges stored config with defaults', () => {
      settingsRepo.get = vi.fn(() => ({
        enabled: false,
        events: { taskCompleted: false },
      }));
      const config = service.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.events.taskCompleted).toBe(false);
      expect(config.events.agentError).toBe(true);
    });

    it('saves config with merged defaults', () => {
      service.setConfig({ enabled: false, events: { agentCrash: false } });
      expect(settingsRepo.set).toHaveBeenCalledWith('notifications', expect.objectContaining({
        enabled: false,
        events: expect.objectContaining({
          agentCrash: false,
          taskCompleted: true,
        }),
      }));
    });
  });

  describe('_shouldNotify', () => {
    it('returns true when enabled and event type allowed', () => {
      expect(service._shouldNotify('taskCompleted', 'agent-1')).toBe(true);
    });

    it('returns false when notifications disabled globally', () => {
      settingsRepo.get = vi.fn(() => ({ enabled: false }));
      expect(service._shouldNotify('taskCompleted', 'agent-1')).toBe(false);
    });

    it('returns false when specific event type disabled', () => {
      settingsRepo.get = vi.fn(() => ({
        enabled: true,
        events: { taskCompleted: false },
      }));
      expect(service._shouldNotify('taskCompleted', 'agent-1')).toBe(false);
      expect(service._shouldNotify('agentError', 'agent-1')).toBe(true);
    });

    it('returns false when agent-level override disables event', () => {
      settingsRepo.get = vi.fn(() => ({
        enabled: true,
        events: { taskCompleted: true },
        perAgent: { 'agent-1': { taskCompleted: false } },
      }));
      expect(service._shouldNotify('taskCompleted', 'agent-1')).toBe(false);
      expect(service._shouldNotify('taskCompleted', 'agent-2')).toBe(true);
    });

    it('returns false when agent is fully disabled', () => {
      settingsRepo.get = vi.fn(() => ({
        enabled: true,
        events: { taskCompleted: true },
        perAgent: { 'agent-1': { enabled: false } },
      }));
      expect(service._shouldNotify('taskCompleted', 'agent-1')).toBe(false);
    });
  });

  describe('_notify', () => {
    it('creates and shows a notification when allowed', () => {
      service._notify('taskCompleted', 'agent-1', 'Title', 'Body');
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toBe('Title');
      expect(MockNotification.instances[0].body).toBe('Body');
      expect(MockNotification.instances[0].show).toHaveBeenCalled();
    });

    it('registers click and close handlers', () => {
      service._notify('taskCompleted', 'agent-1', 'Title', 'Body');
      const instance = MockNotification.instances[0];
      const registeredEvents = instance.on.mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain('show');
      expect(registeredEvents).toContain('click');
      expect(registeredEvents).toContain('close');
      expect(registeredEvents).toContain('error');
    });

    it('does not show notification when disabled', () => {
      settingsRepo.get = vi.fn(() => ({ enabled: false }));
      service._notify('taskCompleted', 'agent-1', 'Title', 'Body');
      expect(MockNotification.instances).toHaveLength(0);
    });

    it('does not show notification when Notification is not supported', () => {
      MockNotification.isSupported.mockReturnValue(false);
      service._notify('taskCompleted', 'agent-1', 'Title', 'Body');
      expect(MockNotification.instances).toHaveLength(0);
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      service.start();
    });

    afterEach(() => {
      service.stop();
    });

    it('fires taskCompleted notification on agent exit with code 0', () => {
      runtime.emit('exit', { agentId: 'agent-1', code: 0, signal: null });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Task Completed');
    });

    it('does not fire taskCompleted on non-zero exit code', () => {
      runtime.emit('exit', { agentId: 'agent-1', code: 1, signal: null });
      expect(MockNotification.instances).toHaveLength(0);
    });

    it('fires agentError notification on error status', () => {
      runtime.emit('status-change', { agentId: 'agent-1', status: 'error', error: 'crash' });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Agent Error');
      expect(MockNotification.instances[0].body).toBe('crash');
    });

    it('does not fire agentError on non-error status', () => {
      runtime.emit('status-change', { agentId: 'agent-1', status: 'running' });
      expect(MockNotification.instances).toHaveLength(0);
    });

    it('fires recoveryExhausted notification from engine', () => {
      engine.emit('recovery-exhausted', { agentId: 'agent-1', retries: 3 });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Recovery Exhausted');
      expect(MockNotification.instances[0].body).toContain('3');
    });

    it('fires budgetStopped notification on budget threshold', () => {
      costEmitter.emit('budget:threshold', {
        agentId: 'agent-1',
        action: 'stopped',
        budget: { currentSpend: 100, monthlyLimit: 100 },
        pct: 100,
      });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Budget Stopped');
    });

    it('fires budgetPaused notification on budget threshold', () => {
      costEmitter.emit('budget:threshold', {
        agentId: 'agent-1',
        action: 'paused',
        budget: { currentSpend: 90, monthlyLimit: 100 },
        pct: 90,
      });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Budget Paused');
    });

    it('fires budgetWarning notification on budget threshold', () => {
      costEmitter.emit('budget:threshold', {
        agentId: 'agent-1',
        action: 'warn',
        budget: { currentSpend: 80, monthlyLimit: 100 },
        pct: 80,
      });
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain('Budget Warning');
    });
  });

  describe('start / stop lifecycle', () => {
    it('attaches listeners on start', () => {
      const runtimeSpy = vi.spyOn(runtime, 'on');
      const engineSpy = vi.spyOn(engine, 'on');
      const costSpy = vi.spyOn(costEmitter, 'on');
      service.start();
      expect(runtimeSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(runtimeSpy).toHaveBeenCalledWith('status-change', expect.any(Function));
      expect(engineSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(engineSpy).toHaveBeenCalledWith('recovery-exhausted', expect.any(Function));
      expect(costSpy).toHaveBeenCalledWith('budget:threshold', expect.any(Function));
    });

    it('removes listeners on stop', () => {
      const runtimeSpy = vi.spyOn(runtime, 'removeListener');
      const engineSpy = vi.spyOn(engine, 'removeListener');
      const costSpy = vi.spyOn(costEmitter, 'removeListener');
      service.start();
      service.stop();
      expect(runtimeSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(engineSpy).toHaveBeenCalledWith('recovery-exhausted', expect.any(Function));
      expect(costSpy).toHaveBeenCalledWith('budget:threshold', expect.any(Function));
    });

    it('does not double-fire after stop and re-start', () => {
      service.start();
      service.stop();
      service.start();
      runtime.emit('exit', { agentId: 'agent-1', code: 0, signal: null });
      expect(MockNotification.instances).toHaveLength(1);
    });
  });

  describe('agent label resolution', () => {
    beforeEach(() => {
      service.start();
    });

    afterEach(() => {
      service.stop();
    });

    it('uses runtime agent label when available', () => {
      runtime.agents.set('agent-1', { config: { label: 'MyAgent' } });
      runtime.emit('exit', { agentId: 'agent-1', code: 0, signal: null });
      expect(MockNotification.instances[0].title).toContain('MyAgent');
    });

    it('falls back to engine agent label', () => {
      engine.agents.set('agent-1', { config: { label: 'EngineAgent' } });
      engine.emit('exit', { agentId: 'agent-1', code: 0, signal: null });
      expect(MockNotification.instances[0].title).toContain('EngineAgent');
    });

    it('falls back to "Agent" when no label found', () => {
      runtime.emit('exit', { agentId: 'unknown', code: 0, signal: null });
      expect(MockNotification.instances[0].title).toContain('Agent');
    });
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has all event types enabled by default', () => {
    expect(DEFAULT_CONFIG.enabled).toBe(true);
    for (const key of Object.keys(EVENT_LABELS)) {
      expect(DEFAULT_CONFIG.events[key]).toBe(true);
    }
  });
});

describe('EVENT_LABELS', () => {
  it('has labels for all event types in DEFAULT_CONFIG', () => {
    for (const key of Object.keys(DEFAULT_CONFIG.events)) {
      expect(EVENT_LABELS[key]).toBeDefined();
      expect(typeof EVENT_LABELS[key]).toBe('string');
    }
  });
});
