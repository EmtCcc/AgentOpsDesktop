'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for skill CRUD operations against SQLite.
 *
 * DB schema:
 *   skills(id, name, description, content, tags, created_at, updated_at)
 *   skill_tags(skill_id, tag)
 *
 * API fields: id, name, description, content, tags[], createdAt, updatedAt
 */
class SkillRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO skills (id, name, description, content, tags, created_at, updated_at)
        VALUES (@id, @name, @description, @content, @tags, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE skills
        SET name = @name, description = @description, content = @content,
            tags = @tags, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM skills WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM skills WHERE id = @id'),
      getByName: this.db.prepare('SELECT * FROM skills WHERE name = @name'),
      list: this.db.prepare('SELECT * FROM skills ORDER BY created_at DESC'),
      searchByName: this.db.prepare(`SELECT * FROM skills WHERE name LIKE @query OR description LIKE @query ORDER BY created_at DESC`),

      // Tag operations
      insertTag: this.db.prepare('INSERT OR IGNORE INTO skill_tags (skill_id, tag) VALUES (@skillId, @tag)'),
      deleteTags: this.db.prepare('DELETE FROM skill_tags WHERE skill_id = @skillId'),
      getTagsBySkill: this.db.prepare('SELECT tag FROM skill_tags WHERE skill_id = @skillId'),
      getSkillsByTag: this.db.prepare(`
        SELECT s.* FROM skills s
        INNER JOIN skill_tags st ON s.id = st.skill_id
        WHERE st.tag = @tag
        ORDER BY s.created_at DESC
      `),
      getSkillsByTags: this.db.prepare(`
        SELECT DISTINCT s.* FROM skills s
        INNER JOIN skill_tags st ON s.id = st.skill_id
        WHERE st.tag IN (@tags)
        ORDER BY s.created_at DESC
      `),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description || null,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(skill) {
    const now = new Date().toISOString();
    return {
      id: skill.id || randomUUID(),
      name: skill.name,
      description: skill.description || null,
      content: skill.content,
      tags: JSON.stringify(skill.tags || []),
      createdAt: skill.createdAt ? new Date(skill.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  /**
   * Sync the skill_tags junction table for a given skill.
   * @param {string} skillId
   * @param {string[]} tags
   */
  _syncTags(skillId, tags) {
    this._stmts.deleteTags.run({ skillId });
    for (const tag of tags) {
      this._stmts.insertTag.run({ skillId, tag: tag.toLowerCase().trim() });
    }
  }

  /**
   * Load tags for a skill record.
   * @param {object} record
   * @returns {object}
   */
  _withTags(record) {
    if (!record) return null;
    const tagRows = this._stmts.getTagsBySkill.all({ skillId: record.id });
    record.tags = tagRows.map((r) => r.tag);
    return record;
  }

  create(skill) {
    const params = this._toDbParams(skill);
    this._stmts.insert.run(params);
    this._syncTags(params.id, skill.tags || []);
    return this._withTags(this._toRecord(this._stmts.getById.get({ id: params.id })));
  }

  update(id, updates) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;

    const merged = { ...this._toRecord(existing), ...updates, id };
    const params = this._toDbParams(merged);
    this._stmts.update.run(params);

    if (updates.tags) {
      this._syncTags(id, updates.tags);
    }

    return this._withTags(this._toRecord(this._stmts.getById.get({ id })));
  }

  delete(id) {
    // Tags cascade via FK
    const result = this._stmts.delete.run({ id });
    return result.changes > 0;
  }

  getById(id) {
    return this._withTags(this._toRecord(this._stmts.getById.get({ id })));
  }

  getByName(name) {
    return this._withTags(this._toRecord(this._stmts.getByName.get({ name })));
  }

  /**
   * List skills with optional filters.
   * @param {{ offset?: number, limit?: number, tag?: string, tags?: string[], search?: string }} params
   * @returns {{ items: object[], total: number, offset: number, limit: number, hasMore: boolean }}
   */
  list(params = {}) {
    const { offset = 0, limit = 50, tag, tags, search } = params;

    let rows;
    if (search) {
      const query = `%${search}%`;
      rows = this._stmts.searchByName.all({ query });
    } else if (tags && tags.length > 0) {
      // Multi-tag search: get skills matching any of the tags
      const placeholders = tags.map(() => '?').join(',');
      const stmt = this.db.prepare(`
        SELECT DISTINCT s.* FROM skills s
        INNER JOIN skill_tags st ON s.id = st.skill_id
        WHERE st.tag IN (${placeholders})
        ORDER BY s.created_at DESC
      `);
      rows = stmt.all(...tags.map((t) => t.toLowerCase().trim()));
    } else if (tag) {
      rows = this._stmts.getSkillsByTag.all({ tag: tag.toLowerCase().trim() });
    } else {
      rows = this._stmts.list.all();
    }

    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._withTags(this._toRecord(r)));

    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * Get all unique tags.
   * @returns {string[]}
   */
  listTags() {
    const rows = this.db.prepare('SELECT DISTINCT tag FROM skill_tags ORDER BY tag').all();
    return rows.map((r) => r.tag);
  }
}

module.exports = { SkillRepository };
