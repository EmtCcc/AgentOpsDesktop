'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for DAG shared context (blackboard) persistence.
 * Agents within a DAG can read/write key-value pairs isolated by dag_id.
 */
class SharedContextRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      upsert: this.db.prepare(`
        INSERT INTO shared_context (id, dag_id, key, value, updated_by, created_at, updated_at)
        VALUES (@id, @dagId, @key, @value, @updatedBy, @createdAt, @updatedAt)
        ON CONFLICT(dag_id, key) DO UPDATE SET
          value = @value,
          updated_by = @updatedBy,
          updated_at = @updatedAt
      `),
      getByDagAndKey: this.db.prepare(
        'SELECT * FROM shared_context WHERE dag_id = @dagId AND key = @key',
      ),
      listByDag: this.db.prepare(
        'SELECT * FROM shared_context WHERE dag_id = @dagId ORDER BY key',
      ),
      deleteByDagAndKey: this.db.prepare(
        'DELETE FROM shared_context WHERE dag_id = @dagId AND key = @key',
      ),
      deleteByDag: this.db.prepare(
        'DELETE FROM shared_context WHERE dag_id = @dagId',
      ),
      getManyByDag: this.db.prepare(
        'SELECT * FROM shared_context WHERE dag_id = @dagId AND key IN (SELECT value FROM json_each(@keysJson))',
      ),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      dagId: row.dag_id,
      key: row.key,
      value: JSON.parse(row.value),
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  /**
   * Set a key in the shared context for a DAG (upsert).
   * @param {string} dagId
   * @param {string} key
   * @param {*} value - JSON-serializable value
   * @param {string} [updatedBy] - agent id that performed the write
   * @returns {Object} the persisted record
   */
  set(dagId, key, value, updatedBy = null) {
    const now = new Date().toISOString();
    const params = {
      id: randomUUID(),
      dagId,
      key,
      value: JSON.stringify(value),
      updatedBy,
      createdAt: now,
      updatedAt: now,
    };
    // Use existing id on update to keep it stable
    const existing = this._stmts.getByDagAndKey.get({ dagId, key });
    if (existing) params.id = existing.id;
    if (existing) params.createdAt = existing.created_at;

    this._stmts.upsert.run(params);
    return this._toRecord(this._stmts.getByDagAndKey.get({ dagId, key }));
  }

  /**
   * Get a single key from the shared context.
   * @param {string} dagId
   * @param {string} key
   * @returns {Object|null}
   */
  get(dagId, key) {
    return this._toRecord(this._stmts.getByDagAndKey.get({ dagId, key }));
  }

  /**
   * Get multiple keys at once.
   * @param {string} dagId
   * @param {string[]} keys
   * @returns {Object[]}
   */
  getMany(dagId, keys) {
    if (!keys.length) return [];
    const rows = this._stmts.getManyByDag.all({ dagId, keysJson: JSON.stringify(keys) });
    return rows.map((r) => this._toRecord(r));
  }

  /**
   * List all key-value pairs for a DAG.
   * @param {string} dagId
   * @returns {Object[]}
   */
  list(dagId) {
    return this._stmts.listByDag.all({ dagId }).map((r) => this._toRecord(r));
  }

  /**
   * Delete a single key.
   * @param {string} dagId
   * @param {string} key
   * @returns {boolean} true if a row was deleted
   */
  delete(dagId, key) {
    const result = this._stmts.deleteByDagAndKey.run({ dagId, key });
    return result.changes > 0;
  }

  /**
   * Delete all context for a DAG (also handled by FK CASCADE on dag deletion).
   * @param {string} dagId
   */
  deleteAll(dagId) {
    this._stmts.deleteByDag.run({ dagId });
  }
}

module.exports = { SharedContextRepository };
