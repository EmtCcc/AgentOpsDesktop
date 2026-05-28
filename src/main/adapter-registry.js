'use strict';

const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const logger = require('./logger');

/**
 * Base class for custom agent adapters.
 * All adapters must extend this and implement the four core methods.
 */
class AgentAdapter extends EventEmitter {
  /** @param {object} config — adapter-specific configuration */
  constructor(config = {}) {
    super();
    this.config = config;
    this.id = config.id || randomUUID();
    this.name = config.name || 'unnamed';
    this.type = config.type || 'custom';
    this.status = 'idle';
  }

  /**
   * Spawn/initialize the agent process.
   * @param {object} params — { task, cwd, env }
   * @returns {Promise<{ pid?: string, handle?: any }>}
   */
  async spawn(_params) {
    throw new Error(`${this.constructor.name}.spawn() not implemented`);
  }

  /**
   * Kill/stop the agent process.
   * @param {string} instanceId
   * @returns {Promise<void>}
   */
  async kill(_instanceId) {
    throw new Error(`${this.constructor.name}.kill() not implemented`);
  }

  /**
   * Health check — verify the adapter is functional.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async healthCheck() {
    throw new Error(`${this.constructor.name}.healthCheck() not implemented`);
  }

  /**
   * Execute a task using this adapter.
   * @param {object} task — { title, description, config }
   * @returns {Promise<{ output: string, exitCode: number }>}
   */
  async execute(_task) {
    throw new Error(`${this.constructor.name}.execute() not implemented`);
  }
}

/**
 * Runtime registry for agent adapters.
 * Supports dynamic register/unregister, load from config, and lifecycle management.
 */
class AdapterRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, AgentAdapter>} type -> adapter instance */
    this.adapters = new Map();
    /** @type {Map<string, Function>} type -> adapter class constructor */
    this.adapterClasses = new Map();
  }

  /**
   * Register an adapter class for a given type name.
   * @param {string} type
   * @param {typeof AgentAdapter} AdapterClass
   */
  registerClass(type, AdapterClass) {
    if (this.adapterClasses.has(type)) {
      throw new Error(`Adapter class already registered: ${type}`);
    }
    this.adapterClasses.set(type, AdapterClass);
    logger.info('adapter.class-registered', { type });
  }

  /**
   * Unregister an adapter class.
   */
  unregisterClass(type) {
    // Unload any live instance first
    if (this.adapters.has(type)) {
      this.unload(type);
    }
    this.adapterClasses.delete(type);
    logger.info('adapter.class-unregistered', { type });
  }

  /**
   * Load (instantiate) an adapter from a registered class.
   * @param {string} type
   * @param {object} config
   * @returns {AgentAdapter}
   */
  load(type, config = {}) {
    if (this.adapters.has(type)) {
      throw new Error(`Adapter already loaded: ${type}`);
    }
    const AdapterClass = this.adapterClasses.get(type);
    if (!AdapterClass) {
      throw new Error(`No adapter class registered for type: ${type}`);
    }
    const adapter = new AdapterClass({ ...config, type });
    this.adapters.set(type, adapter);
    this.emit('adapter:loaded', { type, id: adapter.id });
    logger.info('adapter.loaded', { type, id: adapter.id });
    return adapter;
  }

  /**
   * Unload (destroy) a live adapter instance.
   */
  async unload(type) {
    const adapter = this.adapters.get(type);
    if (!adapter) return false;
    try {
      // Attempt graceful cleanup if the adapter has running instances
      adapter.removeAllListeners();
    } catch { /* ignore */ }
    this.adapters.delete(type);
    this.emit('adapter:unloaded', { type });
    logger.info('adapter.unloaded', { type });
    return true;
  }

  /**
   * Get a live adapter instance by type.
   */
  get(type) {
    return this.adapters.get(type) || null;
  }

  /**
   * Get an adapter class by type.
   */
  getClass(type) {
    return this.adapterClasses.get(type) || null;
  }

  /**
   * List all registered adapter types (classes).
   */
  listRegistered() {
    return Array.from(this.adapterClasses.keys());
  }

  /**
   * List all loaded adapter instances.
   */
  listLoaded() {
    const result = [];
    for (const [type, adapter] of this.adapters) {
      result.push({
        type,
        id: adapter.id,
        name: adapter.name,
        status: adapter.status,
      });
    }
    return result;
  }

  /**
   * Run health check on a loaded adapter.
   */
  async healthCheck(type) {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      return { ok: false, error: `Adapter not loaded: ${type}` };
    }
    try {
      return await adapter.healthCheck();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Load adapters from a config array (JSON/YAML-driven).
   * Each entry: { type, classPath?, config? }
   * classPath is resolved relative to the adapters directory or as absolute.
   */
  async loadFromConfigs(configs) {
    const results = [];
    for (const cfg of configs) {
      try {
        // If a classPath is provided, dynamically require it
        if (cfg.classPath && !this.adapterClasses.has(cfg.type)) {
          const AdapterClass = require(cfg.classPath);
          const Cls = AdapterClass.default || AdapterClass;
          this.registerClass(cfg.type, Cls);
        }
        if (!this.adapters.has(cfg.type)) {
          this.load(cfg.type, cfg.config || {});
        }
        results.push({ type: cfg.type, ok: true });
      } catch (err) {
        results.push({ type: cfg.type, ok: false, error: err.message });
        logger.error('adapter.load-failed', { type: cfg.type, error: err.message });
      }
    }
    return results;
  }
}

module.exports = { AgentAdapter, AdapterRegistry };
