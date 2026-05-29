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
  {
    version: 6,
    name: 'align_schema_with_repositories',
    up: `
      -- Add columns that repositories expect but schema v1 didn't define.
      -- SQLite ALTER TABLE only supports ADD COLUMN, so we add missing ones
      -- and let the repository layer handle the renamed semantics:
      --   v1 'agent_type'        → repository reads/writes 'type'        (new column)
      --   v1 'executable_path'   → repository reads/writes 'exec_path'   (new column)
      --   v1 'working_directory' → repository reads/writes 'cwd'         (new column)
      --   'command'              → never existed in v1, repository needs it

      ALTER TABLE agents ADD COLUMN type       TEXT NOT NULL DEFAULT 'custom';
      ALTER TABLE agents ADD COLUMN command    TEXT;
      ALTER TABLE agents ADD COLUMN exec_path  TEXT;
      ALTER TABLE agents ADD COLUMN cwd        TEXT;

      -- Indexes for common query patterns used by repositories
      CREATE INDEX IF NOT EXISTS idx_agents_type   ON agents(type);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_goals_status  ON goals(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_goal_status ON tasks(goal_id, status);
    `,
  },
  {
    version: 7,
    name: 'add_owner_role',
    up: `
      ALTER TABLE agents ADD COLUMN owner_role TEXT;
      ALTER TABLE goals  ADD COLUMN owner_role TEXT;
      ALTER TABLE tasks  ADD COLUMN owner_role TEXT;

      CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_role);
      CREATE INDEX IF NOT EXISTS idx_goals_owner  ON goals(owner_role);
      CREATE INDEX IF NOT EXISTS idx_tasks_owner  ON tasks(owner_role);
    `,
  },
  {
    version: 8,
    name: 'create_workspaces',
    up: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id              TEXT PRIMARY KEY,
        agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        root_path       TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'active',
        max_size_bytes  INTEGER,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_snapshots (
        id              TEXT PRIMARY KEY,
        workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        description     TEXT,
        file_count      INTEGER DEFAULT 0,
        size_bytes      INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workspaces_agent ON workspaces(agent_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
      CREATE INDEX IF NOT EXISTS idx_ws_snapshots_workspace ON workspace_snapshots(workspace_id);
    `,
  },
  {
    version: 9,
    name: 'create_schedules',
    up: `
      CREATE TABLE IF NOT EXISTS schedules (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        cron_expr       TEXT NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        goal_id         TEXT REFERENCES goals(id) ON DELETE SET NULL,
        agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
        task_template   TEXT NOT NULL DEFAULT '{}',
        max_executions  INTEGER,
        execution_count INTEGER NOT NULL DEFAULT 0,
        last_run_at     TEXT,
        next_run_at     TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schedule_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
        task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        status      TEXT NOT NULL CHECK (status IN ('triggered', 'skipped', 'failed')),
        error       TEXT,
        triggered_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
      CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule ON schedule_logs(schedule_id);
    `,
  },
  {
    version: 10,
    name: 'create_dag_tables',
    up: `
      CREATE TABLE IF NOT EXISTS dags (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT,
        status          TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','running','succeeded','failed','cancelled','paused')),
        max_parallel    INTEGER NOT NULL DEFAULT 4,
        retry_max       INTEGER NOT NULL DEFAULT 0,
        retry_backoff_ms INTEGER NOT NULL DEFAULT 1000,
        retry_backoff_mult REAL NOT NULL DEFAULT 2.0,
        retry_max_backoff_ms INTEGER NOT NULL DEFAULT 30000,
        on_failure      TEXT NOT NULL DEFAULT 'fail-fast'
          CHECK (on_failure IN ('fail-fast','best-effort')),
        started_at      TEXT,
        completed_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dag_tasks (
        id              TEXT PRIMARY KEY,
        dag_id          TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
        agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
        title           TEXT NOT NULL,
        description     TEXT,
        task_type       TEXT NOT NULL DEFAULT 'agent'
          CHECK (task_type IN ('agent','noop','manual')),
        status          TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','ready','running','succeeded','failed','skipped','cancelled')),
        agent_config_json TEXT DEFAULT '{}',
        retry_count     INTEGER NOT NULL DEFAULT 0,
        retry_max       INTEGER,
        output_json     TEXT,
        error_message   TEXT,
        started_at      TEXT,
        completed_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dag_edges (
        id              TEXT PRIMARY KEY,
        dag_id          TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
        from_task_id    TEXT NOT NULL REFERENCES dag_tasks(id) ON DELETE CASCADE,
        to_task_id      TEXT NOT NULL REFERENCES dag_tasks(id) ON DELETE CASCADE,
        edge_type       TEXT NOT NULL DEFAULT 'dependency'
          CHECK (edge_type IN ('dependency','data_flow')),
        data_key        TEXT,
        created_at      TEXT NOT NULL,
        UNIQUE(dag_id, from_task_id, to_task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_dags_status ON dags(status);
      CREATE INDEX IF NOT EXISTS idx_dag_tasks_dag ON dag_tasks(dag_id);
      CREATE INDEX IF NOT EXISTS idx_dag_tasks_status ON dag_tasks(dag_id, status);
      CREATE INDEX IF NOT EXISTS idx_dag_edges_dag ON dag_edges(dag_id);
      CREATE INDEX IF NOT EXISTS idx_dag_edges_from ON dag_edges(from_task_id);
      CREATE INDEX IF NOT EXISTS idx_dag_edges_to ON dag_edges(to_task_id);
    `,
  },
  {
    version: 11,
    name: 'create_budget_tables',
    up: `
      CREATE TABLE IF NOT EXISTS agent_budgets (
        id              TEXT PRIMARY KEY,
        agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        monthly_limit   REAL NOT NULL DEFAULT 0,
        current_spend   REAL NOT NULL DEFAULT 0,
        currency        TEXT NOT NULL DEFAULT 'USD',
        warn_pct        INTEGER NOT NULL DEFAULT 80,
        pause_pct       INTEGER NOT NULL DEFAULT 90,
        stop_pct        INTEGER NOT NULL DEFAULT 100,
        period_start    TEXT NOT NULL,
        period_end      TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'paused', 'stopped')),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        UNIQUE(agent_id)
      );

      CREATE TABLE IF NOT EXISTS agent_usage_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        input_tokens    INTEGER NOT NULL DEFAULT 0,
        output_tokens   INTEGER NOT NULL DEFAULT 0,
        total_tokens    INTEGER NOT NULL DEFAULT 0,
        cost_usd        REAL NOT NULL DEFAULT 0,
        model           TEXT,
        provider        TEXT,
        created_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_budgets_agent ON agent_budgets(agent_id);
      CREATE INDEX IF NOT EXISTS idx_budgets_status ON agent_budgets(status);
      CREATE INDEX IF NOT EXISTS idx_usage_agent ON agent_usage_logs(agent_id);
      CREATE INDEX IF NOT EXISTS idx_usage_task ON agent_usage_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_usage_created ON agent_usage_logs(created_at);
    `,
  },
  {
    version: 12,
    name: 'create_squads',
    up: `
      CREATE TABLE IF NOT EXISTS squads (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        leader_id   TEXT REFERENCES agents(id) ON DELETE SET NULL,
        status      TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error')),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS squad_members (
        squad_id    TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
        agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
        added_at    TEXT NOT NULL,
        PRIMARY KEY (squad_id, agent_id)
      );

      CREATE INDEX IF NOT EXISTS idx_squads_status ON squads(status);
      CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);
      CREATE INDEX IF NOT EXISTS idx_squad_members_agent ON squad_members(agent_id);
    `,
  },
  {
    version: 13,
    name: 'create_adapter_configs',
    up: `
      CREATE TABLE IF NOT EXISTS adapter_configs (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        class_path  TEXT,
        config_json TEXT DEFAULT '{}',
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_adapter_configs_type ON adapter_configs(type);
      CREATE INDEX IF NOT EXISTS idx_adapter_configs_enabled ON adapter_configs(enabled);
    `,
  },
  {
    version: 14,
    name: 'create_task_handoffs',
    up: `
      -- Structured output storage for tasks (non-DAG)
      ALTER TABLE tasks ADD COLUMN output TEXT;
      ALTER TABLE tasks ADD COLUMN depends_on TEXT;

      -- Handoff tracking: records when one task's output flows into another
      CREATE TABLE IF NOT EXISTS task_handoffs (
        id              TEXT PRIMARY KEY,
        source_task_id  TEXT NOT NULL,
        target_task_id  TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'delivered', 'failed')),
        output_json     TEXT,
        error_message   TEXT,
        created_at      TEXT NOT NULL,
        delivered_at    TEXT,
        UNIQUE(source_task_id, target_task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_handoffs_source ON task_handoffs(source_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_handoffs_target ON task_handoffs(target_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_handoffs_status ON task_handoffs(status);
    `,
  },
  {
    version: 15,
    name: 'create_skills',
    up: `
      CREATE TABLE IF NOT EXISTS skills (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        content     TEXT NOT NULL,
        tags        TEXT DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

      CREATE TABLE IF NOT EXISTS skill_tags (
        skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        tag         TEXT NOT NULL,
        PRIMARY KEY (skill_id, tag)
      );

      CREATE INDEX IF NOT EXISTS idx_skill_tags_tag ON skill_tags(tag);
    `,
  },
  {
    version: 16,
    name: 'create_adapter_packages',
    up: `
      CREATE TABLE IF NOT EXISTS adapter_packages (
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

      CREATE INDEX IF NOT EXISTS idx_adapter_packages_name ON adapter_packages(name);
      CREATE INDEX IF NOT EXISTS idx_adapter_packages_source ON adapter_packages(source);
      CREATE INDEX IF NOT EXISTS idx_adapter_packages_adapter_type ON adapter_packages(adapter_type);
    `,
  },
  {
    version: 17,
    name: 'create_settings_and_telemetry',
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type  TEXT NOT NULL,
        event_data  TEXT DEFAULT '{}',
        session_id  TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id);
    `,
  },
  {
    version: 18,
    name: 'add_task_workspace_support',
    up: `
      -- Add task_id column to link workspaces to tasks (nullable for agent-level workspaces)
      ALTER TABLE workspaces ADD COLUMN task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

      -- Add injected_files column to track which project files were injected
      ALTER TABLE workspaces ADD COLUMN injected_files TEXT DEFAULT '[]';

      -- Add gc_at column for GC scheduling (null = not eligible for GC)
      ALTER TABLE workspaces ADD COLUMN gc_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_workspaces_task ON workspaces(task_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_gc ON workspaces(gc_at);
    `,
  },
  {
    version: 19,
    name: 'add_squad_instructions',
    up: `
      ALTER TABLE squads ADD COLUMN instructions TEXT;
    `,
  },
  {
    version: 20,
    name: 'create_shared_context',
    up: `
      CREATE TABLE IF NOT EXISTS shared_context (
        id          TEXT PRIMARY KEY,
        dag_id      TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL DEFAULT '{}',
        updated_by  TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(dag_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_shared_context_dag ON shared_context(dag_id);
      CREATE INDEX IF NOT EXISTS idx_shared_context_dag_key ON shared_context(dag_id, key);
    `,
  },
  {
    version: 21,
    name: 'add_squad_assignment',
    up: `
      -- Make Squads first-class assignees for Goals, Tasks, and DAG Tasks
      ALTER TABLE goals ADD COLUMN squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL;
      ALTER TABLE dag_tasks ADD COLUMN squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_goals_squad ON goals(squad_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_squad ON tasks(squad_id);
      CREATE INDEX IF NOT EXISTS idx_dag_tasks_squad ON dag_tasks(squad_id);
    `,
  },
  {
    version: 22,
    name: 'add_squad_trigger_rules',
    up: `
      ALTER TABLE squads ADD COLUMN trigger_rules TEXT DEFAULT '{}';
    `,
  },
  {
    version: 23,
    name: 'add_skill_format_fields',
    up: `
      -- Paperclip SKILL.md compatible fields for import/export portability
      ALTER TABLE skills ADD COLUMN version       TEXT;
      ALTER TABLE skills ADD COLUMN allowed_tools TEXT DEFAULT '[]';
      ALTER TABLE skills ADD COLUMN hooks         TEXT DEFAULT '{}';
    `,
  },
  {
    version: 24,
    name: 'create_group_chat',
    up: `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id              TEXT PRIMARY KEY,
        title           TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'paused', 'completed')),
        strategy_type   TEXT NOT NULL DEFAULT 'round-robin'
          CHECK (strategy_type IN ('round-robin', 'manager-assign', 'topic-trigger', 'human-assign')),
        strategy_config TEXT DEFAULT '{}',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id     TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        role        TEXT NOT NULL DEFAULT 'expert'
          CHECK (role IN ('manager', 'expert', 'observer')),
        status      TEXT NOT NULL DEFAULT 'idle'
          CHECK (status IN ('speaking', 'listening', 'idle')),
        added_at    TEXT NOT NULL,
        PRIMARY KEY (chat_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id          TEXT PRIMARY KEY,
        chat_id     TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        agent_id    TEXT,
        content     TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'chat'
          CHECK (type IN ('chat', 'instruction', 'system')),
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(chat_id, created_at);
    `,
  },
];

module.exports = { migrations };
