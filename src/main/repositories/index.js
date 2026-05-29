'use strict';

const { AgentRepository } = require('./agent.repository');
const { GoalRepository } = require('./goal.repository');
const { TaskRepository } = require('./task.repository');
const { TaskLogRepository } = require('./task-log.repository');
const { OrchestratorRepository } = require('./orchestrator.repository');
const { ScheduleRepository } = require('./schedule.repository');
const { SquadRepository } = require('./squad.repository');
const { CostRepository } = require('./cost.repository');
const { AdapterRepository } = require('./adapter.repository');
const { AdapterPackageRepository } = require('./adapter-package.repository');
const { SkillRepository } = require('./skill.repository');
const { SharedContextRepository } = require('./shared-context.repository');
const { SettingsRepository } = require('../db/repositories/settings.repository');
const { TelemetryRepository } = require('./telemetry.repository');
const { ChatRepository } = require('./chat.repository');

/**
 * Initialize all repositories with a database connection.
 * @param {import('better-sqlite3').Database} db
 */
function createRepositories(db) {
  return {
    agents: new AgentRepository(db),
    goals: new GoalRepository(db),
    tasks: new TaskRepository(db),
    taskLogs: new TaskLogRepository(db),
    orchestrator: new OrchestratorRepository(db),
    schedules: new ScheduleRepository(db),
    squads: new SquadRepository(db),
    costs: new CostRepository(db),
    adapters: new AdapterRepository(db),
    adapterPackages: new AdapterPackageRepository(db),
    skills: new SkillRepository(db),
    sharedContext: new SharedContextRepository(db),
    settings: new SettingsRepository(db),
    telemetry: new TelemetryRepository(db),
    chats: new ChatRepository(db),
  };
}

module.exports = { createRepositories, AgentRepository, GoalRepository, TaskRepository, TaskLogRepository, OrchestratorRepository, ScheduleRepository, SquadRepository, CostRepository, AdapterRepository, AdapterPackageRepository, SkillRepository, SharedContextRepository, SettingsRepository, TelemetryRepository, ChatRepository };
