'use strict';

/**
 * Shared type definitions (JSDoc).
 * These match the SQLite schema in src/main/db/schema.js and the
 * camelCase mapping in src/main/repositories/*.repository.js.
 *
 * DB column → JS property mapping:
 *   agents.type        ← agent_type (v1), type (v6+)
 *   agents.exec_path   ← executable_path (v1), exec_path (v6+)
 *   agents.cwd         ← working_directory (v1), cwd (v6+)
 *   agents.command     ← added in v6
 *   agents.config_json ← config_json (JSON string)
 *
 * @typedef {Object} Agent
 * @property {string} id          - UUID primary key
 * @property {string} name        - Display name
 * @property {'claude'|'codex'|'gemini'|'opencode'|'cursor'|'custom'} type
 * @property {'idle'|'running'|'error'|'stopped'|'spawning'} status
 * @property {string|null} command - CLI command string
 * @property {string|null} execPath - Path to CLI binary (DB: exec_path)
 * @property {string|null} cwd    - Default working directory (DB: cwd)
 * @property {Object} config      - Parsed config_json (DB stores JSON string)
 * @property {number} createdAt   - Epoch ms (DB: created_at ISO 8601)
 * @property {number} updatedAt   - Epoch ms (DB: updated_at ISO 8601)
 */

/**
 * @typedef {Object} Goal
 * @property {string} id          - UUID primary key
 * @property {string} title
 * @property {string|null} description
 * @property {'active'|'completed'|'archived'} status
 * @property {number} createdAt   - Epoch ms (DB: created_at ISO 8601)
 * @property {number} updatedAt   - Epoch ms (DB: updated_at ISO 8601)
 */

/**
 * @typedef {Object} Task
 * @property {string} id          - UUID primary key
 * @property {string|null} goalId - FK to goals.id (DB: goal_id)
 * @property {string|null} agentId - FK to agents.id (DB: agent_id)
 * @property {string} title
 * @property {string|null} description
 * @property {'pending'|'assigned'|'running'|'done'|'failed'|'blocked'} status
 * @property {string|null} outputSummary - Summary when task completes (DB: output_summary)
 * @property {number|null} startedAt  - Epoch ms (DB: started_at ISO 8601)
 * @property {number|null} completedAt - Epoch ms (DB: completed_at ISO 8601)
 * @property {number} createdAt   - Epoch ms (DB: created_at ISO 8601)
 * @property {number} updatedAt   - Epoch ms (DB: updated_at ISO 8601)
 */

/**
 * @typedef {Object} TaskLog
 * @property {number} id          - Auto-increment primary key
 * @property {string} taskId      - FK to tasks.id (DB: task_id)
 * @property {'stdout'|'stderr'|'system'} stream
 * @property {string} content
 * @property {number} timestamp   - Epoch ms (DB: timestamp ISO 8601)
 */

/**
 * @typedef {Object} SchemaVersion
 * @property {number} version     - Migration version number
 * @property {string} name        - Migration name
 * @property {string} applied_at  - ISO 8601 timestamp
 */

module.exports = {};
