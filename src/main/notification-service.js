'use strict';

const { Notification } = require('electron');
const logger = require('./logger');

const DEFAULT_CONFIG = {
  enabled: true,
  events: {
    taskCompleted: true,
    agentError: true,
    agentCrash: true,
    budgetWarning: true,
    budgetPaused: true,
    budgetStopped: true,
    recoveryExhausted: true,
  },
  perAgent: {},
};

const EVENT_LABELS = {
  taskCompleted: 'Task Completed',
  agentError: 'Agent Error',
  agentCrash: 'Agent Crashed',
  budgetWarning: 'Budget Warning',
  budgetPaused: 'Budget Paused',
  budgetStopped: 'Budget Stopped',
  recoveryExhausted: 'Recovery Exhausted',
};

class NotificationService {
  /**
   * @param {object} opts
   * @param {import('./db/repositories/settings.repository').SettingsRepository} opts.settingsRepo
   * @param {import('./agent-runtime').AgentRuntime} [opts.runtime]
   * @param {import('./agent-engine').AgentEngine} [opts.engine]
   * @param {EventEmitter} [opts.costEmitter] — emitter that fires 'budget:threshold'
   */
  constructor({ settingsRepo, runtime, engine, costEmitter, NotificationCtor }) {
    this._settingsRepo = settingsRepo;
    this._runtime = runtime;
    this._engine = engine;
    this._costEmitter = costEmitter;
    this._Notification = NotificationCtor || Notification;
    this._handlers = new Map();
  }

  /** Read notification config from settings, merged with defaults. */
  getConfig() {
    const stored = this._settingsRepo.get('notifications');
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      events: { ...DEFAULT_CONFIG.events, ...(stored?.events || {}) },
      perAgent: { ...(stored?.perAgent || {}) },
    };
  }

  /** Save notification config to settings. */
  setConfig(config) {
    const merged = {
      ...DEFAULT_CONFIG,
      ...config,
      events: { ...DEFAULT_CONFIG.events, ...(config?.events || {}) },
      perAgent: { ...(config?.perAgent || {}) },
    };
    this._settingsRepo.set('notifications', merged);
    return merged;
  }

  /** Check if a specific event type should fire for an agent. */
  _shouldNotify(eventType, agentId) {
    const config = this.getConfig();
    if (!config.enabled) return false;
    if (!config.events[eventType]) return false;

    // Per-agent overrides: agent config can disable specific events
    const agentOverrides = config.perAgent[agentId];
    if (agentOverrides && agentOverrides[eventType] === false) return false;
    if (agentOverrides && agentOverrides.enabled === false) return false;

    return true;
  }

  /** Fire an OS notification if allowed by config. */
  _notify(eventType, agentId, title, body) {
    if (!this._shouldNotify(eventType, agentId)) return;

    try {
      if (!this._Notification.isSupported()) {
        logger.warn('notification.unsupported', { eventType, agentId });
        return;
      }

      const notification = new this._Notification({
        title,
        body,
        silent: false,
      });

      notification.on('show', () => {
        logger.info('notification.shown', { eventType, agentId, title });
      });

      notification.on('click', () => {
        logger.info('notification.clicked', { eventType, agentId });
      });

      notification.on('close', () => {
        logger.info('notification.closed', { eventType, agentId });
      });

      notification.on('error', (err) => {
        logger.error('notification.error', { eventType, agentId, error: err.message });
      });

      notification.show();
    } catch (err) {
      logger.error('notification.failed', { eventType, agentId, error: err.message });
    }
  }

  // ── Event handlers ──

  _onAgentExit = (data) => {
    const { agentId, code, signal: _signal } = data;
    if (code === 0) {
      const label = this._getAgentLabel(agentId);
      this._notify('taskCompleted', agentId, `${label} — Task Completed`, `Agent finished successfully.`);
    }
  };

  _onAgentStatusChange = (data) => {
    const { agentId, status, error } = data;
    if (status === 'error') {
      const label = this._getAgentLabel(agentId);
      this._notify('agentError', agentId, `${label} — Agent Error`, error || 'Agent entered error state.');
    }
  };

  _onRecoveryExhausted = (data) => {
    const { agentId, retries } = data;
    const label = this._getAgentLabel(agentId);
    this._notify('recoveryExhausted', agentId,
      `${label} — Recovery Exhausted`,
      `All ${retries} recovery attempts failed. Agent will not restart.`);
  };

  _onBudgetThreshold = (data) => {
    const { agentId, action, budget, pct } = data;
    const label = this._getAgentLabel(agentId);
    const spend = budget?.currentSpend?.toFixed(2) ?? '?';
    const limit = budget?.monthlyLimit?.toFixed(2) ?? '?';

    if (action === 'stopped') {
      this._notify('budgetStopped', agentId,
        `${label} — Budget Stopped`,
        `Spend $${spend} / $${limit} (${pct}%). Agent has been stopped.`);
    } else if (action === 'paused') {
      this._notify('budgetPaused', agentId,
        `${label} — Budget Paused`,
        `Spend $${spend} / $${limit} (${pct}%). Agent has been paused.`);
    } else if (action === 'warn') {
      this._notify('budgetWarning', agentId,
        `${label} — Budget Warning`,
        `Spend $${spend} / $${limit} (${pct}%). Approaching budget limit.`);
    }
  };

  _getAgentLabel(agentId) {
    // Try to get agent label from runtime or engine
    try {
      if (this._runtime) {
        const agent = this._runtime.agents?.get?.(agentId);
        if (agent?.config?.label) return agent.config.label;
      }
      if (this._engine) {
        const agent = this._engine.agents?.get?.(agentId);
        if (agent?.config?.label) return agent.config.label;
      }
    } catch { /* ignore */ }
    return 'Agent';
  }

  // ── Lifecycle ──

  /** Attach event listeners to runtime, engine, and cost emitter. */
  start() {
    if (this._runtime) {
      this._runtime.on('exit', this._onAgentExit);
      this._runtime.on('status-change', this._onAgentStatusChange);
    }

    if (this._engine) {
      this._engine.on('exit', this._onAgentExit);
      this._engine.on('status-change', this._onAgentStatusChange);
      this._engine.on('recovery-exhausted', this._onRecoveryExhausted);
    }

    if (this._costEmitter) {
      this._costEmitter.on('budget:threshold', this._onBudgetThreshold);
    }

    logger.info('notification-service.started');
  }

  /** Detach all event listeners. */
  stop() {
    if (this._runtime) {
      this._runtime.removeListener('exit', this._onAgentExit);
      this._runtime.removeListener('status-change', this._onAgentStatusChange);
    }

    if (this._engine) {
      this._engine.removeListener('exit', this._onAgentExit);
      this._engine.removeListener('status-change', this._onAgentStatusChange);
      this._engine.removeListener('recovery-exhausted', this._onRecoveryExhausted);
    }

    if (this._costEmitter) {
      this._costEmitter.removeListener('budget:threshold', this._onBudgetThreshold);
    }

    logger.info('notification-service.stopped');
  }
}

module.exports = { NotificationService, DEFAULT_CONFIG, EVENT_LABELS };
