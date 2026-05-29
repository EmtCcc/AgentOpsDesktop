'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for installed adapter packages (community registry).
 *
 * DB schema: adapter_packages(id, name, version, description, author, repository,
 *   license, keywords, entry_point, adapter_type, config_schema, installed_path,
 *   source, source_url, installed_at, updated_at)
 */
class AdapterPackageRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO adapter_packages
          (id, name, version, description, author, repository, license, keywords,
           entry_point, adapter_type, config_schema, installed_path, source, source_url,
           installed_at, updated_at)
        VALUES (@id, @name, @version, @description, @author, @repository, @license, @keywords,
                @entryPoint, @adapterType, @configSchema, @installedPath, @source, @sourceUrl,
                @installedAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE adapter_packages
        SET version = @version, description = @description, author = @author,
            repository = @repository, license = @license, keywords = @keywords,
            entry_point = @entryPoint, adapter_type = @adapterType,
            config_schema = @configSchema, installed_path = @installedPath,
            source = @source, source_url = @sourceUrl, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM adapter_packages WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM adapter_packages WHERE id = @id'),
      getByName: this.db.prepare('SELECT * FROM adapter_packages WHERE name = @name'),
      list: this.db.prepare('SELECT * FROM adapter_packages ORDER BY name ASC'),
      search: this.db.prepare(`
        SELECT * FROM adapter_packages
        WHERE name LIKE @query OR description LIKE @query OR keywords LIKE @query
        ORDER BY name ASC
      `),
      listBySource: this.db.prepare('SELECT * FROM adapter_packages WHERE source = @source ORDER BY name ASC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      author: row.author,
      repository: row.repository,
      license: row.license,
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      entryPoint: row.entry_point,
      adapterType: row.adapter_type,
      configSchema: row.config_schema ? JSON.parse(row.config_schema) : {},
      installedPath: row.installed_path,
      source: row.source,
      sourceUrl: row.source_url,
      installedAt: new Date(row.installed_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(pkg) {
    const now = new Date().toISOString();
    return {
      id: pkg.id || randomUUID(),
      name: pkg.name,
      version: pkg.version,
      description: pkg.description || null,
      author: pkg.author || null,
      repository: pkg.repository || null,
      license: pkg.license || null,
      keywords: JSON.stringify(pkg.keywords || []),
      entryPoint: pkg.entryPoint,
      adapterType: pkg.adapterType,
      configSchema: JSON.stringify(pkg.configSchema || {}),
      installedPath: pkg.installedPath,
      source: pkg.source || 'local',
      sourceUrl: pkg.sourceUrl || null,
      installedAt: pkg.installedAt ? new Date(pkg.installedAt).toISOString() : now,
      updatedAt: now,
    };
  }

  create(pkg) {
    const params = this._toDbParams(pkg);
    this._stmts.insert.run(params);
    return this.getById(params.id);
  }

  update(id, updates) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;
    const merged = { ...this._toRecord(existing), ...updates, id };
    const params = this._toDbParams(merged);
    this._stmts.update.run(params);
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  delete(id) {
    const result = this._stmts.delete.run({ id });
    return result.changes > 0;
  }

  getById(id) {
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  getByName(name) {
    return this._toRecord(this._stmts.getByName.get({ name }));
  }

  list(params = {}) {
    const { offset = 0, limit = 50, source } = params;
    let rows;
    if (source) {
      rows = this._stmts.listBySource.all({ source });
    } else {
      rows = this._stmts.list.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));
    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  search(query) {
    const pattern = `%${query}%`;
    const rows = this._stmts.search.all({ query: pattern });
    return rows.map((r) => this._toRecord(r));
  }
}

module.exports = { AdapterPackageRepository };
