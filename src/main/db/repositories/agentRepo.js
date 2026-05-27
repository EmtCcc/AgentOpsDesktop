'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('better-sqlite3').Database} db
 */
function createAgentRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO agents (id, name, executable_path, working_directory, agent_type, config_json, status, created_at, updated_at)
      VALUES (@id, @name, @executable_path, @working_directory, @agent_type, @config_json, @status, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE agents
      SET name = @name, executable_path = @executable_path, working_directory = @working_directory,
          agent_type = @agent_type, config_json = @config_json, status = @status, updated_at = @updated_at
      WHERE id = @id
    `),
    deleteById: db.prepare('DELETE FROM agents WHERE id = ?'),
    getById: db.prepare('SELECT * FROM agents WHERE id = ?'),
    list: db.prepare('SELECT * FROM agents ORDER BY created_at DESC'),
    listByStatus: db.prepare('SELECT * FROM agents WHERE status = ? ORDER BY created_at DESC'),
  };

  return {
    /**
     * Create a new agent configuration.
     * @param {{ name: string, executable_path: string, working_directory: string, agent_type: string, config_json?: string }} input
     * @returns {object} The created agent row.
     */
    create(input) {
      const now = new Date().toISOString();
      const row = {
        id: uuidv4(),
        name: input.name,
        executable_path: input.executable_path,
        working_directory: input.working_directory,
        agent_type: input.agent_type,
        config_json: input.config_json ?? '{}',
        status: 'idle',
        created_at: now,
        updated_at: now,
      };
      stmts.insert.run(row);
      return row;
    },

    /**
     * Update an existing agent.
     * @param {string} id
     * @param {Partial<{ name: string, executable_path: string, working_directory: string, agent_type: string, config_json: string, status: string }>} changes
     * @returns {object|null} Updated row or null if not found.
     */
    update(id, changes) {
      const existing = stmts.getById.get(id);
      if (!existing) return null;

      const row = {
        ...existing,
        ...changes,
        id,
        updated_at: new Date().toISOString(),
      };
      stmts.update.run(row);
      return stmts.getById.get(id);
    },

    /**
     * Delete an agent by ID.
     * @param {string} id
     * @returns {boolean} true if a row was deleted.
     */
    delete(id) {
      const result = stmts.deleteById.run(id);
      return result.changes > 0;
    },

    /**
     * Get an agent by ID.
     * @param {string} id
     * @returns {object|undefined}
     */
    getById(id) {
      return stmts.getById.get(id);
    },

    /**
     * List all agents, optionally filtered by status.
     * @param {string} [status]
     * @returns {object[]}
     */
    list(status) {
      if (status) return stmts.listByStatus.all(status);
      return stmts.list.all();
    },
  };
}

module.exports = { createAgentRepo };
