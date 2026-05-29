import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AdapterPackageRepository } from '../src/main/repositories/adapter-package.repository.js';

describe('AdapterPackageRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE adapter_packages (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL UNIQUE,
        version         TEXT NOT NULL,
        description     TEXT,
        author          TEXT,
        repository      TEXT,
        license         TEXT,
        keywords        TEXT DEFAULT '[]',
        entry_point     TEXT NOT NULL,
        adapter_type    TEXT NOT NULL,
        config_schema   TEXT DEFAULT '{}',
        installed_path  TEXT NOT NULL,
        source          TEXT NOT NULL DEFAULT 'local'
          CHECK (source IN ('local', 'registry', 'git', 'file')),
        source_url      TEXT,
        installed_at    TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX idx_adapter_packages_name ON adapter_packages(name);
      CREATE INDEX idx_adapter_packages_source ON adapter_packages(source);
      CREATE INDEX idx_adapter_packages_adapter_type ON adapter_packages(adapter_type);
    `);

    repo = new AdapterPackageRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates and retrieves a package by id', () => {
    const pkg = repo.create({
      name: 'my-adapter',
      version: '1.0.0',
      description: 'A test adapter',
      author: 'test-author',
      entryPoint: 'index.js',
      adapterType: 'generic-cli',
      installedPath: '/adapters/my-adapter/index.js',
      source: 'registry',
    });

    expect(pkg.id).toBeDefined();
    expect(pkg.name).toBe('my-adapter');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.description).toBe('A test adapter');
    expect(pkg.author).toBe('test-author');
    expect(pkg.adapterType).toBe('generic-cli');
    expect(pkg.source).toBe('registry');
    expect(pkg.keywords).toEqual([]);
    expect(pkg.installedAt).toBeDefined();
    expect(pkg.updatedAt).toBeDefined();

    const fetched = repo.getById(pkg.id);
    expect(fetched).toEqual(pkg);
  });

  it('retrieves a package by name', () => {
    repo.create({
      name: 'findme',
      version: '2.0.0',
      entryPoint: 'main.js',
      adapterType: 'custom',
      installedPath: '/adapters/findme/main.js',
    });

    const pkg = repo.getByName('findme');
    expect(pkg).not.toBeNull();
    expect(pkg.name).toBe('findme');
    expect(pkg.version).toBe('2.0.0');
  });

  it('returns null for non-existent package', () => {
    expect(repo.getById('nonexistent')).toBeNull();
    expect(repo.getByName('nonexistent')).toBeNull();
  });

  it('lists all packages ordered by name', () => {
    repo.create({ name: 'beta', version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: '/b' });
    repo.create({ name: 'alpha', version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: '/a' });
    repo.create({ name: 'gamma', version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: '/g' });

    const result = repo.list();
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.items[0].name).toBe('alpha');
    expect(result.items[1].name).toBe('beta');
    expect(result.items[2].name).toBe('gamma');
  });

  it('lists with pagination', () => {
    for (let i = 0; i < 10; i++) {
      repo.create({ name: `pkg-${i}`, version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: `/p${i}` });
    }

    const page1 = repo.list({ offset: 0, limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.total).toBe(10);
    expect(page1.hasMore).toBe(true);

    const page4 = repo.list({ offset: 9, limit: 3 });
    expect(page4.items).toHaveLength(1);
    expect(page4.hasMore).toBe(false);
  });

  it('lists filtered by source', () => {
    repo.create({ name: 'from-reg', version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: '/r', source: 'registry' });
    repo.create({ name: 'from-local', version: '1.0.0', entryPoint: 'i.js', adapterType: 'a', installedPath: '/l', source: 'local' });

    const registry = repo.list({ source: 'registry' });
    expect(registry.items).toHaveLength(1);
    expect(registry.items[0].name).toBe('from-reg');

    const local = repo.list({ source: 'local' });
    expect(local.items).toHaveLength(1);
    expect(local.items[0].name).toBe('from-local');
  });

  it('searches by name, description, and keywords', () => {
    repo.create({
      name: 'docker-adapter',
      version: '1.0.0',
      description: 'Run containers',
      keywords: ['docker', 'container'],
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/d',
    });
    repo.create({
      name: 'ssh-adapter',
      version: '1.0.0',
      description: 'Remote shell access',
      keywords: ['ssh', 'remote'],
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/s',
    });

    const byName = repo.search('docker');
    expect(byName).toHaveLength(1);
    expect(byName[0].name).toBe('docker-adapter');

    const byDesc = repo.search('container');
    expect(byDesc).toHaveLength(1);

    const byKeyword = repo.search('remote');
    expect(byKeyword).toHaveLength(1);

    const all = repo.search('adapter');
    expect(all).toHaveLength(2);
  });

  it('updates a package', () => {
    const pkg = repo.create({
      name: 'updatable',
      version: '1.0.0',
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/u',
    });

    const updated = repo.update(pkg.id, { version: '2.0.0', description: 'Updated' });
    expect(updated.version).toBe('2.0.0');
    expect(updated.description).toBe('Updated');
    expect(updated.name).toBe('updatable');
  });

  it('returns null when updating non-existent package', () => {
    const result = repo.update('nonexistent', { version: '2.0.0' });
    expect(result).toBeNull();
  });

  it('deletes a package', () => {
    const pkg = repo.create({
      name: 'deletable',
      version: '1.0.0',
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/d',
    });

    expect(repo.delete(pkg.id)).toBe(true);
    expect(repo.getById(pkg.id)).toBeNull();
    expect(repo.delete(pkg.id)).toBe(false);
  });

  it('serializes and deserializes keywords correctly', () => {
    const pkg = repo.create({
      name: 'keyworded',
      version: '1.0.0',
      keywords: ['ai', 'llm', 'agent'],
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/k',
    });

    const fetched = repo.getById(pkg.id);
    expect(fetched.keywords).toEqual(['ai', 'llm', 'agent']);
  });

  it('serializes and deserializes configSchema correctly', () => {
    const schema = { type: 'object', properties: { execPath: { type: 'string' } } };
    const pkg = repo.create({
      name: 'schemad',
      version: '1.0.0',
      configSchema: schema,
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/s',
    });

    const fetched = repo.getById(pkg.id);
    expect(fetched.configSchema).toEqual(schema);
  });

  it('handles null optional fields gracefully', () => {
    const pkg = repo.create({
      name: 'minimal',
      version: '1.0.0',
      entryPoint: 'i.js',
      adapterType: 'a',
      installedPath: '/m',
    });

    expect(pkg.description).toBeNull();
    expect(pkg.author).toBeNull();
    expect(pkg.repository).toBeNull();
    expect(pkg.license).toBeNull();
    expect(pkg.sourceUrl).toBeNull();
    expect(pkg.keywords).toEqual([]);
    expect(pkg.configSchema).toEqual({});
  });
});
