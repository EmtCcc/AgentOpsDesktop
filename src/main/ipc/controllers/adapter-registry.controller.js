'use strict';

const { IpcError } = require('../errors');

let registryService = null;

const adapterRegistryController = {
  setService(service) {
    registryService = service;
  },

  async search(event, { query, remote, limit }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!query || typeof query !== 'string') throw IpcError.validation('query is required');
    return registryService.search(query, { remote, limit });
  },

  async listInstalled(event, params = {}) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    return registryService.listInstalled(params);
  },

  async getPackage(event, { name }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!name) throw IpcError.validation('name is required');
    const pkg = registryService.getPackage(name);
    if (!pkg) throw IpcError.notFound('Adapter package', name);
    return pkg;
  },

  async install(event, { name, version, autoLoad }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!name) throw IpcError.validation('name is required');
    return registryService.install(name, { version, autoLoad });
  },

  async installFromFile(event, { filePath, name, autoLoad }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!filePath) throw IpcError.validation('filePath is required');
    return registryService.installFromFile(filePath, { name, autoLoad });
  },

  async uninstall(event, { name, removeFiles }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!name) throw IpcError.validation('name is required');
    return registryService.uninstall(name, { removeFiles });
  },

  async update(event, { name, version }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!name) throw IpcError.validation('name is required');
    return registryService.update(name, { version });
  },

  async checkUpdates(event) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    return registryService.checkUpdates();
  },

  async getFeatured(event, { limit }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    return registryService.getFeatured({ limit });
  },

  async scanLocal(event) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    return registryService.scanLocal();
  },

  async registerLocal(event, { discovered }) {
    if (!registryService) throw IpcError.internal('Adapter registry service not initialized');
    if (!discovered) throw IpcError.validation('discovered is required');
    return registryService.registerLocal(discovered);
  },
};

adapterRegistryController.schemas = {
  search: {
    query: { type: 'string', required: true, minLength: 1 },
    remote: { type: 'boolean' },
    limit: { type: 'number' },
  },
  listInstalled: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    source: { type: 'string' },
  },
  getPackage: {
    name: { type: 'string', required: true },
  },
  install: {
    name: { type: 'string', required: true, minLength: 1 },
    version: { type: 'string' },
    autoLoad: { type: 'boolean' },
  },
  installFromFile: {
    filePath: { type: 'string', required: true },
    name: { type: 'string' },
    autoLoad: { type: 'boolean' },
  },
  uninstall: {
    name: { type: 'string', required: true },
    removeFiles: { type: 'boolean' },
  },
  update: {
    name: { type: 'string', required: true },
    version: { type: 'string' },
  },
  checkUpdates: {},
  getFeatured: {
    limit: { type: 'number' },
  },
  scanLocal: {},
  registerLocal: {
    discovered: { type: 'object', required: true },
  },
};

module.exports = adapterRegistryController;
