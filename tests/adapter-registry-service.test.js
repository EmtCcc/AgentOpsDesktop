import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { AdapterPackageRepository } from '../src/main/repositories/adapter-package.repository.js';
import { AdapterRepository } from '../src/main/repositories/adapter.repository.js';
import { AdapterRegistry } from '../src/main/adapter-registry.js';
import { RemoteRegistryClient } from '../src/main/adapter-registry-client.js';
import { AdapterRegistryService } from '../src/main/adapter-registry-service.js';

// ── Helpers ──

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE adapter_packages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, version TEXT NOT NULL,
      description TEXT, author TEXT, repository TEXT, license TEXT,
      keywords TEXT DEFAULT '[]', entry_point TEXT NOT NULL, adapter_type TEXT NOT NULL,
      config_schema TEXT DEFAULT '{}', installed_path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'registry', 'git', 'file')),
      source_url TEXT, installed_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_adapter_packages_name ON adapter_packages(name);
    CREATE INDEX idx_adapter_packages_source ON adapter_packages(source);
    CREATE INDEX idx_adapter_packages_adapter_type ON adapter_packages(adapter_type);

    CREATE TABLE adapter_configs (
      id TEXT PRIMARY KEY, type TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      class_path TEXT, config_json TEXT DEFAULT '{}', enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_adapter_configs_type ON adapter_configs(type);
    CREATE INDEX idx_adapter_configs_enabled ON adapter_configs(enabled);
  `);

  return db;
}

function mockRegistryClient(overrides = {}) {
  return {
    registryUrl: 'https://registry.test.dev',
    search: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    get: vi.fn().mockResolvedValue({
      name: 'test-adapter',
      version: '1.0.0',
      latest: '1.0.0',
      description: 'A test adapter',
      author: 'tester',
      entryPoint: 'index.js',
      adapterType: 'generic-cli',
      defaultConfig: {},
    }),
    getVersions: vi.fn().mockResolvedValue({ versions: [{ version: '1.0.0' }] }),
    download: vi.fn().mockResolvedValue(Buffer.from('fake-tarball')),
    featured: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides,
  };
}

// ── Tests ──

describe('RemoteRegistryClient', () => {
  let client;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = new RemoteRegistryClient({ registryUrl: 'https://registry.test.dev', timeoutMs: 5000 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs with default registry URL', () => {
    const defaultClient = new RemoteRegistryClient();
    expect(defaultClient.registryUrl).toBe('https://registry.agentops.dev');
  });

  it('constructs with custom registry URL and strips trailing slash', () => {
    const custom = new RemoteRegistryClient({ registryUrl: 'https://custom.dev/' });
    expect(custom.registryUrl).toBe('https://custom.dev');
  });

  it('search sends correct query params', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ name: 'found' }], total: 1 }),
    });

    const result = await client.search('docker', { limit: 5 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/adapters/search?q=docker&limit=5'),
      expect.any(Object)
    );
    expect(result.items).toHaveLength(1);
  });

  it('get fetches adapter by name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'my-adapter', version: '2.0.0' }),
    });

    const result = await client.get('my-adapter');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/adapters/my-adapter'),
      expect.any(Object)
    );
    expect(result.name).toBe('my-adapter');
  });

  it('get encodes special characters in name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: '@scope/pkg' }),
    });

    await client.get('@scope/pkg');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/adapters/%40scope%2Fpkg'),
      expect.any(Object)
    );
  });

  it('download returns buffer on success', async () => {
    const content = 'tarball-content';
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(encoder.encode(content).buffer),
    });

    const result = await client.download('my-adapter', '1.0.0');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe(content);
  });

  it('download throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });

    await expect(client.download('missing', '1.0.0')).rejects.toThrow('Download failed (404)');
  });

  it('throws on timeout', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      })
    );

    // Use a very short timeout
    client = new RemoteRegistryClient({ registryUrl: 'https://registry.test.dev', timeoutMs: 1 });
    await expect(client.get('test')).rejects.toThrow('timed out');
  });

  it('throws on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    await expect(client.get('test')).rejects.toThrow('Registry request failed: ENOTFOUND');
  });

  it('featured sends request to correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ name: 'popular' }] }),
    });

    const result = await client.featured({ limit: 10 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/adapters/featured?limit=10'),
      expect.any(Object)
    );
    expect(result.items).toHaveLength(1);
  });
});

describe('AdapterRegistryService', () => {
  let db;
  let packageRepo;
  let adapterRepo;
  let runtimeRegistry;
  let service;
  let tmpDir;

  beforeEach(() => {
    db = createTestDb();
    packageRepo = new AdapterPackageRepository(db);
    adapterRepo = new AdapterRepository(db);
    runtimeRegistry = new AdapterRegistry();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createService(overrides = {}) {
    return new AdapterRegistryService({
      packageRepo,
      registryClient: mockRegistryClient(),
      runtimeRegistry,
      adapterRepo,
      adaptersDir: tmpDir,
      ...overrides,
    });
  }

  describe('search', () => {
    it('searches local packages', async () => {
      packageRepo.create({
        name: 'docker-adapter',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: '/d',
      });

      service = createService();
      const result = await service.search('docker', { remote: false });
      expect(result.local).toHaveLength(1);
      expect(result.local[0].name).toBe('docker-adapter');
      expect(result.remote).toEqual([]);
    });

    it('searches remote registry when remote=true', async () => {
      const registryClient = mockRegistryClient({
        search: vi.fn().mockResolvedValue({
          items: [{ name: 'remote-adapter', version: '2.0.0' }],
          total: 1,
        }),
      });

      service = createService({ registryClient });
      const result = await service.search('adapter', { remote: true });
      expect(registryClient.search).toHaveBeenCalledWith('adapter', { limit: 20 });
      expect(result.remote).toHaveLength(1);
    });

    it('handles remote search failure gracefully', async () => {
      const registryClient = mockRegistryClient({
        search: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      service = createService({ registryClient });
      const result = await service.search('test');
      expect(result.remote).toEqual([]);
    });
  });

  describe('listInstalled', () => {
    it('lists installed packages', () => {
      packageRepo.create({ name: 'a', version: '1.0.0', entryPoint: 'i.js', adapterType: 'x', installedPath: '/a' });
      packageRepo.create({ name: 'b', version: '1.0.0', entryPoint: 'i.js', adapterType: 'x', installedPath: '/b' });

      service = createService();
      const result = service.listInstalled();
      expect(result.items).toHaveLength(2);
    });
  });

  describe('getPackage', () => {
    it('returns package by name', () => {
      packageRepo.create({ name: 'my-pkg', version: '1.0.0', entryPoint: 'i.js', adapterType: 'x', installedPath: '/m' });
      service = createService();
      const pkg = service.getPackage('my-pkg');
      expect(pkg.name).toBe('my-pkg');
    });

    it('returns null for unknown package', () => {
      service = createService();
      expect(service.getPackage('unknown')).toBeNull();
    });
  });

  describe('install', () => {
    it('installs adapter from remote registry', async () => {
      const adapterDir = path.join(tmpDir, 'test-adapter');
      fs.mkdirSync(adapterDir);
      fs.writeFileSync(path.join(adapterDir, 'index.js'), 'module.exports = class {};');

      const registryClient = mockRegistryClient({
        get: vi.fn().mockResolvedValue({
          name: 'test-adapter',
          version: '1.0.0',
          description: 'Test',
          entryPoint: 'index.js',
          adapterType: 'generic-cli',
          defaultConfig: { execPath: 'echo' },
        }),
        download: vi.fn().mockResolvedValue(Buffer.from('fake')),
      });

      service = createService({ registryClient });

      // Mock _extractTarball to just create the expected files
      service._extractTarball = vi.fn().mockImplementation((buf, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'index.js'), 'module.exports = class {};');
      });

      const pkg = await service.install('test-adapter');
      expect(pkg.name).toBe('test-adapter');
      expect(pkg.version).toBe('1.0.0');
      expect(pkg.source).toBe('registry');

      // Verify it was registered in adapter_configs
      const config = adapterRepo.getByType('test-adapter');
      expect(config).not.toBeNull();
      expect(config.enabled).toBe(true);
    });

    it('rejects if already installed', async () => {
      packageRepo.create({
        name: 'existing',
        version: '1.0.0',
        entryPoint: 'i.js',
        adapterType: 'a',
        installedPath: '/e',
        source: 'registry',
      });

      service = createService();
      await expect(service.install('existing')).rejects.toThrow('already installed');
    });

    it('rejects if not found in registry', async () => {
      const registryClient = mockRegistryClient({
        get: vi.fn().mockRejectedValue(new Error('Not found')),
      });

      service = createService({ registryClient });
      await expect(service.install('nonexistent')).rejects.toThrow('Failed to find adapter');
    });
  });

  describe('uninstall', () => {
    it('uninstalls an installed adapter', async () => {
      const pkg = packageRepo.create({
        name: 'removable',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: path.join(tmpDir, 'removable', 'index.js'),
        source: 'registry',
      });
      adapterRepo.create({ type: 'removable', name: 'removable', classPath: '/r', enabled: true });

      // Create the directory so removeFiles works
      const installDir = path.join(tmpDir, 'removable');
      fs.mkdirSync(installDir, { recursive: true });
      fs.writeFileSync(path.join(installDir, 'index.js'), '');

      service = createService();
      const result = await service.uninstall('removable');
      expect(result.uninstalled).toBe(true);
      expect(packageRepo.getByName('removable')).toBeNull();
      expect(adapterRepo.getByType('removable')).toBeNull();
      expect(fs.existsSync(installDir)).toBe(false);
    });

    it('rejects if not installed', async () => {
      service = createService();
      await expect(service.uninstall('ghost')).rejects.toThrow('not installed');
    });
  });

  describe('update', () => {
    it('updates to a newer version', async () => {
      packageRepo.create({
        name: 'updatable',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: path.join(tmpDir, 'updatable', 'index.js'),
        source: 'registry',
        sourceUrl: 'https://registry.test.dev/v1/adapters/updatable',
      });

      const registryClient = mockRegistryClient({
        get: vi.fn().mockResolvedValue({
          name: 'updatable',
          version: '2.0.0',
          latest: '2.0.0',
          entryPoint: 'index.js',
        }),
        download: vi.fn().mockResolvedValue(Buffer.from('new-tarball')),
      });

      service = createService({ registryClient });
      service._extractTarball = vi.fn().mockImplementation((buf, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'index.js'), 'module.exports = class {};');
      });

      const result = await service.update('updatable');
      expect(result.updated).toBe(true);
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('2.0.0');

      const pkg = packageRepo.getByName('updatable');
      expect(pkg.version).toBe('2.0.0');
    });

    it('returns no-op if already at latest', async () => {
      packageRepo.create({
        name: 'current',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: '/c',
        source: 'registry',
      });

      const registryClient = mockRegistryClient({
        get: vi.fn().mockResolvedValue({
          name: 'current',
          version: '1.0.0',
          latest: '1.0.0',
        }),
      });

      service = createService({ registryClient });
      const result = await service.update('current');
      expect(result.updated).toBe(false);
      expect(result.message).toContain('up to date');
    });

    it('rejects for non-registry source', async () => {
      packageRepo.create({
        name: 'local-only',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: '/l',
        source: 'local',
      });

      service = createService();
      await expect(service.update('local-only')).rejects.toThrow('Cannot update');
    });

    it('rejects if not installed', async () => {
      service = createService();
      await expect(service.update('ghost')).rejects.toThrow('not installed');
    });
  });

  describe('checkUpdates', () => {
    it('checks all installed registry adapters for updates', async () => {
      packageRepo.create({
        name: 'a',
        version: '1.0.0',
        entryPoint: 'i.js',
        adapterType: 'x',
        installedPath: '/a',
        source: 'registry',
      });
      packageRepo.create({
        name: 'b',
        version: '2.0.0',
        entryPoint: 'i.js',
        adapterType: 'x',
        installedPath: '/b',
        source: 'registry',
      });

      const registryClient = mockRegistryClient({
        get: vi.fn().mockImplementation((name) => {
          if (name === 'a') return Promise.resolve({ name: 'a', version: '1.0.0', latest: '1.1.0' });
          if (name === 'b') return Promise.resolve({ name: 'b', version: '2.0.0', latest: '2.0.0' });
          return Promise.reject(new Error('not found'));
        }),
      });

      service = createService({ registryClient });
      const result = await service.checkUpdates();
      expect(result).toHaveLength(2);

      const a = result.find((r) => r.name === 'a');
      expect(a.updateAvailable).toBe(true);
      expect(a.latestVersion).toBe('1.1.0');

      const b = result.find((r) => r.name === 'b');
      expect(b.updateAvailable).toBe(false);
    });
  });

  describe('installFromFile', () => {
    it('installs from a local directory', async () => {
      const srcDir = path.join(tmpDir, 'src-adapter');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'index.js'), 'module.exports = class {};');
      fs.writeFileSync(path.join(srcDir, 'adapter.json'), JSON.stringify({
        name: 'file-adapter',
        version: '0.5.0',
        description: 'From file',
        entryPoint: 'index.js',
        adapterType: 'custom',
      }));

      service = createService();
      const pkg = await service.installFromFile(srcDir);
      expect(pkg.name).toBe('file-adapter');
      expect(pkg.version).toBe('0.5.0');
      expect(pkg.source).toBe('file');
    });

    it('rejects for non-existent path', async () => {
      service = createService();
      await expect(service.installFromFile('/no/such/path')).rejects.toThrow('not found');
    });

    it('rejects if entry point not found', async () => {
      const srcDir = path.join(tmpDir, 'bad-adapter');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'adapter.json'), JSON.stringify({
        name: 'bad',
        entryPoint: 'missing.js',
      }));

      service = createService();
      await expect(service.installFromFile(srcDir)).rejects.toThrow('Entry point not found');
    });
  });

  describe('scanLocal', () => {
    it('discovers unregistered adapters in adapters directory', () => {
      // Create a valid adapter directory
      const adapterDir = path.join(tmpDir, 'discovered');
      fs.mkdirSync(adapterDir);
      fs.writeFileSync(path.join(adapterDir, 'adapter.json'), JSON.stringify({
        name: 'discovered',
        version: '0.1.0',
        entryPoint: 'index.js',
      }));
      fs.writeFileSync(path.join(adapterDir, 'index.js'), 'module.exports = class {};');

      service = createService();
      const discovered = service.scanLocal();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].name).toBe('discovered');
    });

    it('skips already registered adapters', () => {
      const adapterDir = path.join(tmpDir, 'registered');
      fs.mkdirSync(adapterDir);
      fs.writeFileSync(path.join(adapterDir, 'adapter.json'), JSON.stringify({
        name: 'registered',
        version: '1.0.0',
        entryPoint: 'index.js',
      }));
      fs.writeFileSync(path.join(adapterDir, 'index.js'), '');

      packageRepo.create({
        name: 'registered',
        version: '1.0.0',
        entryPoint: 'index.js',
        adapterType: 'a',
        installedPath: path.join(adapterDir, 'index.js'),
      });

      service = createService();
      const discovered = service.scanLocal();
      expect(discovered).toHaveLength(0);
    });

    it('skips directories without manifest', () => {
      const noManifest = path.join(tmpDir, 'no-manifest');
      fs.mkdirSync(noManifest);
      fs.writeFileSync(path.join(noManifest, 'index.js'), '');

      service = createService();
      const discovered = service.scanLocal();
      expect(discovered).toHaveLength(0);
    });

    it('skips directories without valid entry point', () => {
      const badEntry = path.join(tmpDir, 'bad-entry');
      fs.mkdirSync(badEntry);
      fs.writeFileSync(path.join(badEntry, 'adapter.json'), JSON.stringify({
        name: 'bad-entry',
        entryPoint: 'nope.js',
      }));

      service = createService();
      const discovered = service.scanLocal();
      expect(discovered).toHaveLength(0);
    });
  });

  describe('registerLocal', () => {
    it('registers a discovered adapter into package DB', () => {
      const entryPath = path.join(tmpDir, 'local', 'index.js');
      fs.mkdirSync(path.join(tmpDir, 'local'), { recursive: true });
      fs.writeFileSync(entryPath, '');

      service = createService();
      const pkg = service.registerLocal({
        name: 'local-adapter',
        version: '0.1.0',
        entryPoint: 'index.js',
        adapterType: 'custom',
        installedPath: entryPath,
      });

      expect(pkg.name).toBe('local-adapter');
      expect(pkg.source).toBe('local');

      const config = adapterRepo.getByType('local-adapter');
      expect(config).not.toBeNull();
    });
  });
});
