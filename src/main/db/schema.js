'use strict';

/**
 * Schema DDL statements.
 * Each entry is a migration: { version, name, up }
 * The migration runner applies them in order and records applied versions.
 */

const migrations = [
  {
    version: 1,
    name: 'create_agents',
    up: `
      CREATE TABLE IF NOT EXISTS agents (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        executable_path TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        agent_type      TEXT NOT NULL CHECK (agent_type IN ('claude-code', 'codex', 'gemini-cli', 'opencode', 'cursor', 'custom')),
        config_json     TEXT DEFAULT '{}',
        status          TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error', 'offline')),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'create_goals',
    up: `
      CREATE TABLE IF NOT EXISTS goals (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'create_tasks',
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        id              TEXT PRIMARY KEY,
        goal_id         TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
        title           TEXT NOT NULL,
        description     TEXT,
        status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'done', 'failed', 'blocked')),
        output_summary  TEXT,
        started_at      TEXT,
        completed_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
    `,
  },
  {
    version: 4,
    name: 'create_task_logs',
    up: `
      CREATE TABLE IF NOT EXISTS task_logs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        stream    TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
        content   TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
    `,
  },
  {
    version: 5,
    name: 'create_schema_version',
    up: `
      CREATE TABLE IF NOT EXISTS _schema_version (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TEXT NOT NULL
      );
    `,
  },
];

module.exports = { migrations };
