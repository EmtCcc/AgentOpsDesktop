'use strict';

/**
 * Shared type definitions (JSDoc).
 * These match the SQLite schema in src/main/db/schema.js.
 *
 * @typedef {Object} Agent
 * @property {string} id          - UUID primary key
 * @property {string} name        - Display name
 * @property {string} executable_path - Path to CLI binary
 * @property {string} working_directory - Default working directory
 * @property {'claude-code'|'codex'|'gemini-cli'|'opencode'|'cursor'|'custom'} agent_type
 * @property {string} config_json - JSON string of extra config (env vars, args, timeout)
 * @property {'idle'|'running'|'error'|'offline'} status
 * @property {string} created_at  - ISO 8601 timestamp
 * @property {string} updated_at  - ISO 8601 timestamp
 */

/**
 * @typedef {Object} Goal
 * @property {string} id          - UUID primary key
 * @property {string} title
 * @property {string|null} description
 * @property {'active'|'completed'|'archived'} status
 * @property {string} created_at  - ISO 8601 timestamp
 * @property {string} updated_at  - ISO 8601 timestamp
 */

/**
 * @typedef {Object} Task
 * @property {string} id          - UUID primary key
 * @property {string} goal_id     - FK to goals.id
 * @property {string|null} agent_id - FK to agents.id
 * @property {string} title
 * @property {string|null} description
 * @property {'pending'|'assigned'|'running'|'done'|'failed'|'blocked'} status
 * @property {string|null} output_summary - Summary produced when task completes
 * @property {string|null} started_at
 * @property {string|null} completed_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TaskLog
 * @property {number} id          - Auto-increment primary key
 * @property {string} task_id     - FK to tasks.id
 * @property {'stdout'|'stderr'|'system'} stream
 * @property {string} content
 * @property {string} timestamp   - ISO 8601 timestamp
 */

/**
 * @typedef {Object} SchemaVersion
 * @property {number} version     - Migration version number
 * @property {string} name        - Migration name
 * @property {string} applied_at  - ISO 8601 timestamp
 */

module.exports = {};
