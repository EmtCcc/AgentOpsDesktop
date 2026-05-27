'use strict';

const { AgentRepository } = require('./agent.repository');
const { GoalRepository } = require('./goal.repository');
const { TaskRepository } = require('./task.repository');
const { TaskLogRepository } = require('./task-log.repository');

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
  };
}

module.exports = { createRepositories, AgentRepository, GoalRepository, TaskRepository, TaskLogRepository };
