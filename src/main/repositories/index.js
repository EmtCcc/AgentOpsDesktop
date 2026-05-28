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
const { SkillRepository } = require('./skill.repository');

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
    skills: new SkillRepository(db),
  };
}

module.exports = { createRepositories, AgentRepository, GoalRepository, TaskRepository, TaskLogRepository, OrchestratorRepository, ScheduleRepository, SquadRepository, CostRepository, AdapterRepository, SkillRepository };
