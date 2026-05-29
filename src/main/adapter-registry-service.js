'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('./logger');

/**
 * Orchestrates local installed packages, remote registry, and runtime adapter registry.
 * npm-style: search, install, uninstall, update, list.
 */
class AdapterRegistryService {
  /**
   * @param {object} deps
   * @param {import('./repositories/adapter-package.repository').AdapterPackageRepository} deps.packageRepo
   * @param {import('./adapter-registry-client').RemoteRegistryClient} deps.registryClient
   * @param {import('./adapter-registry').AdapterRegistry} deps.runtimeRegistry
   * @param {import('./repositories/adapter.repository').AdapterRepository} deps.adapterRepo
   * @param {string} deps.adaptersDir — local directory for installed adapter packages
   */
  constructor({ packageRepo, registryClient, runtimeRegistry, adapterRepo, adaptersDir }) {
    this.packageRepo = packageRepo;
    this.registryClient = registryClient;
    this.runtimeRegistry = runtimeRegistry;
    this.adapterRepo = adapterRepo;
    this.adaptersDir = adaptersDir || path.join(process.cwd(), 'adapters');

    // Ensure adapters directory exists
    if (!fs.existsSync(this.adaptersDir)) {
      fs.mkdirSync(this.adaptersDir, { recursive: true });
    }
  }

  /**
   * Search for adapters — local installed + remote registry.
   * @param {string} query
   * @param {object} opts — { remote: boolean, limit: number }
   */
  async search(query, opts = {}) {
    const local = this.packageRepo.search(query);
    const result = { local, remote: [] };

    if (opts.remote !== false) {
      try {
        const remote = await this.registryClient.search(query, { limit: opts.limit || 20 });
        result.remote = remote.items || [];
      } catch (err) {
        logger.warn('registry.search-remote-failed', { error: err.message });
      }
    }

    return result;
  }

  /**
   * List installed adapter packages.
   */
  listInstalled(params = {}) {
    return this.packageRepo.list(params);
  }

  /**
   * Get details of an installed package.
   */
  getPackage(name) {
    return this.packageRepo.getByName(name);
  }

  /**
   * Install an adapter package from the remote registry.
   * @param {string} name — adapter package name
   * @param {object} opts — { version?: string, autoLoad?: boolean }
   */
  async install(name, opts = {}) {
    // Check if already installed
    const existing = this.packageRepo.getByName(name);
    if (existing) {
      throw new Error(`Adapter already installed: ${name}@${existing.version}. Use update to upgrade.`);
    }

    // Fetch metadata from remote registry
    let meta;
    try {
      meta = await this.registryClient.get(name);
    } catch (err) {
      throw new Error(`Failed to find adapter "${name}" in registry: ${err.message}`);
    }

    const version = opts.version || meta.latest || meta.version;
    if (!version) {
      throw new Error(`No version available for adapter: ${name}`);
    }

    // Download tarball
    let tarball;
    try {
      tarball = await this.registryClient.download(name, version);
    } catch (err) {
      throw new Error(`Failed to download adapter ${name}@${version}: ${err.message}`);
    }

    // Extract to local adapters directory
    const installDir = path.join(this.adaptersDir, name);
    this._extractTarball(tarball, installDir);

    // Determine entry point
    const entryPoint = meta.entryPoint || meta.main || 'index.js';
    const entryPath = path.join(installDir, entryPoint);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry point not found: ${entryPath}`);
    }

    // Register in local package DB
    const pkg = this.packageRepo.create({
      id: randomUUID(),
      name,
      version,
      description: meta.description,
      author: meta.author,
      repository: meta.repository,
      license: meta.license,
      keywords: meta.keywords || [],
      entryPoint,
      adapterType: meta.adapterType || meta.type || 'custom',
      configSchema: meta.configSchema || {},
      installedPath: entryPath,
      source: 'registry',
      sourceUrl: `${this.registryClient.registryUrl}/v1/adapters/${name}`,
    });

    // Register in adapter_configs DB so it persists across restarts
    const _adapterConfig = this.adapterRepo.create({
      type: name,
      name: meta.displayName || name,
      classPath: entryPath,
      config: meta.defaultConfig || {},
      enabled: true,
    });

    // Optionally load into runtime registry
    if (opts.autoLoad !== false) {
      try {
        await this._loadAdapter(name, entryPath, meta.defaultConfig || {});
        logger.info('adapter.installed-and-loaded', { name, version });
      } catch (err) {
        logger.warn('adapter.installed-but-load-failed', { name, version, error: err.message });
      }
    }

    logger.info('adapter.installed', { name, version, source: 'registry' });
    return pkg;
  }

  /**
   * Install from a local file path (tarball or directory).
   * @param {string} filePath — path to tarball or directory
   * @param {object} opts — { name?: string, autoLoad?: boolean }
   */
  async installFromFile(filePath, opts = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Path not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    let installDir;
    let entryPoint;
    let name;

    if (stat.isDirectory()) {
      // Directory install — read package.json or manifest
      installDir = filePath;
      const manifest = this._readManifest(installDir);
      name = opts.name || manifest.name || path.basename(filePath);
      entryPoint = manifest.entryPoint || manifest.main || 'index.js';
    } else {
      // Tarball install
      name = opts.name || path.basename(filePath).replace(/\.tgz$|\.tar\.gz$/, '');
      installDir = path.join(this.adaptersDir, name);
      const tarball = fs.readFileSync(filePath);
      this._extractTarball(tarball, installDir);
      const manifest = this._readManifest(installDir);
      entryPoint = manifest.entryPoint || manifest.main || 'index.js';
    }

    const entryPath = path.isAbsolute(entryPoint) ? entryPoint : path.join(installDir, entryPoint);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry point not found: ${entryPath}`);
    }

    const manifest = this._readManifest(installDir);

    const pkg = this.packageRepo.create({
      id: randomUUID(),
      name,
      version: manifest.version || '0.0.0',
      description: manifest.description,
      author: manifest.author,
      repository: manifest.repository,
      license: manifest.license,
      keywords: manifest.keywords || [],
      entryPoint,
      adapterType: manifest.adapterType || manifest.type || 'custom',
      configSchema: manifest.configSchema || {},
      installedPath: entryPath,
      source: 'file',
      sourceUrl: filePath,
    });

    this.adapterRepo.create({
      type: name,
      name: manifest.displayName || name,
      classPath: entryPath,
      config: manifest.defaultConfig || {},
      enabled: true,
    });

    if (opts.autoLoad !== false) {
      try {
        await this._loadAdapter(name, entryPath, manifest.defaultConfig || {});
      } catch (err) {
        logger.warn('adapter.file-install-load-failed', { name, error: err.message });
      }
    }

    logger.info('adapter.installed-from-file', { name, path: filePath });
    return pkg;
  }

  /**
   * Uninstall an adapter package.
   * @param {string} name
   * @param {object} opts — { removeFiles?: boolean }
   */
  async uninstall(name, opts = {}) {
    const pkg = this.packageRepo.getByName(name);
    if (!pkg) {
      throw new Error(`Adapter not installed: ${name}`);
    }

    // Unload from runtime if loaded
    try {
      await this.runtimeRegistry.unload(name);
      this.runtimeRegistry.unregisterClass(name);
    } catch { /* not loaded */ }

    // Remove from adapter_configs DB
    const adapterConfig = this.adapterRepo.getByType(name);
    if (adapterConfig) {
      this.adapterRepo.delete(adapterConfig.id);
    }

    // Remove installed files
    if (opts.removeFiles !== false && pkg.installedPath) {
      const installDir = path.dirname(pkg.installedPath);
      if (installDir.startsWith(this.adaptersDir) && fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
    }

    // Remove from package DB
    this.packageRepo.delete(pkg.id);

    logger.info('adapter.uninstalled', { name });
    return { uninstalled: true, name };
  }

  /**
   * Update an installed adapter to a newer version.
   * @param {string} name
   * @param {object} opts — { version?: string }
   */
  async update(name, opts = {}) {
    const pkg = this.packageRepo.getByName(name);
    if (!pkg) {
      throw new Error(`Adapter not installed: ${name}`);
    }

    if (pkg.source !== 'registry') {
      throw new Error(`Cannot update adapter installed from ${pkg.source}. Reinstall from registry.`);
    }

    // Fetch latest metadata
    let meta;
    try {
      meta = await this.registryClient.get(name);
    } catch (err) {
      throw new Error(`Failed to check registry for updates: ${err.message}`);
    }

    const targetVersion = opts.version || meta.latest || meta.version;
    if (targetVersion === pkg.version) {
      return { updated: false, name, version: pkg.version, message: 'Already up to date' };
    }

    // Unload current version
    try {
      await this.runtimeRegistry.unload(name);
      this.runtimeRegistry.unregisterClass(name);
    } catch { /* not loaded */ }

    // Download new version
    const tarball = await this.registryClient.download(name, targetVersion);
    const installDir = path.join(this.adaptersDir, name);
    if (fs.existsSync(installDir)) {
      fs.rmSync(installDir, { recursive: true, force: true });
    }
    this._extractTarball(tarball, installDir);

    const entryPoint = meta.entryPoint || meta.main || 'index.js';
    const entryPath = path.join(installDir, entryPoint);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry point not found after update: ${entryPath}`);
    }

    // Update package DB
    this.packageRepo.update(pkg.id, {
      version: targetVersion,
      description: meta.description || pkg.description,
      entryPoint,
      installedPath: entryPath,
    });

    // Update adapter_configs
    const adapterConfig = this.adapterRepo.getByType(name);
    if (adapterConfig) {
      this.adapterRepo.update(adapterConfig.id, { classPath: entryPath });
    }

    // Reload
    try {
      await this._loadAdapter(name, entryPath, meta.defaultConfig || {});
    } catch (err) {
      logger.warn('adapter.update-load-failed', { name, version: targetVersion, error: err.message });
    }

    logger.info('adapter.updated', { name, from: pkg.version, to: targetVersion });
    return { updated: true, name, fromVersion: pkg.version, toVersion: targetVersion };
  }

  /**
   * Check for available updates for all installed registry adapters.
   */
  async checkUpdates() {
    const installed = this.packageRepo.list({ source: 'registry' });
    const results = [];

    for (const pkg of installed.items) {
      try {
        const meta = await this.registryClient.get(pkg.name);
        const latest = meta.latest || meta.version;
        results.push({
          name: pkg.name,
          currentVersion: pkg.version,
          latestVersion: latest,
          updateAvailable: latest !== pkg.version,
        });
      } catch {
        results.push({
          name: pkg.name,
          currentVersion: pkg.version,
          latestVersion: null,
          updateAvailable: false,
          error: 'Failed to check',
        });
      }
    }

    return results;
  }

  /**
   * Get featured/popular adapters from the remote registry.
   */
  async getFeatured(opts = {}) {
    try {
      return await this.registryClient.featured(opts);
    } catch (err) {
      logger.warn('registry.featured-failed', { error: err.message });
      return { items: [] };
    }
  }

  /**
   * Scan local adapters directory for unregistered adapter packages.
   */
  scanLocal() {
    if (!fs.existsSync(this.adaptersDir)) return [];

    const discovered = [];
    const entries = fs.readdirSync(this.adaptersDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.adaptersDir, entry.name);
      const manifest = this._readManifest(dir);
      if (!manifest) continue;

      const entryPoint = manifest.entryPoint || manifest.main || 'index.js';
      const entryPath = path.join(dir, entryPoint);
      if (!fs.existsSync(entryPath)) continue;

      const existing = this.packageRepo.getByName(entry.name);
      if (existing) continue;

      discovered.push({
        name: entry.name,
        version: manifest.version || '0.0.0',
        description: manifest.description,
        entryPoint,
        adapterType: manifest.adapterType || manifest.type || 'custom',
        installedPath: entryPath,
      });
    }

    return discovered;
  }

  /**
   * Register a locally scanned adapter into the package DB.
   */
  registerLocal(discovered) {
    const entryPath = discovered.installedPath;
    const adapterType = discovered.adapterType || 'custom';

    const pkg = this.packageRepo.create({
      id: randomUUID(),
      name: discovered.name,
      version: discovered.version || '0.0.0',
      description: discovered.description,
      entryPoint: discovered.entryPoint,
      adapterType,
      installedPath: entryPath,
      source: 'local',
    });

    this.adapterRepo.create({
      type: discovered.name,
      name: discovered.name,
      classPath: entryPath,
      config: {},
      enabled: true,
    });

    return pkg;
  }

  // ── Private helpers ──

  async _loadAdapter(name, entryPath, config) {
    if (!this.runtimeRegistry.getClass(name)) {
      const AdapterClass = require(entryPath);
      const Cls = AdapterClass.default || AdapterClass;
      this.runtimeRegistry.registerClass(name, Cls);
    }
    if (!this.runtimeRegistry.get(name)) {
      this.runtimeRegistry.load(name, config);
    }
  }

  _readManifest(dir) {
    // Try adapter.json first, then package.json
    for (const filename of ['adapter.json', 'package.json']) {
      const manifestPath = path.join(dir, filename);
      if (fs.existsSync(manifestPath)) {
        try {
          return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch { /* malformed */ }
      }
    }
    return null;
  }

  _extractTarball(buffer, destDir) {
    // Use Node.js built-in zlib + tar-like extraction via child_process
    // For now, support directory copy and single-file adapters
    // Real tarball extraction requires the 'tar' package or system tar
    const { execSync } = require('child_process');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Write buffer to temp file and extract with system tar
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `adapter-${randomUUID()}.tgz`);
    try {
      fs.writeFileSync(tmpFile, buffer);
      execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}

module.exports = { AdapterRegistryService };
