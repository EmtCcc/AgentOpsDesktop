const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * Simple JSON file-based store for agents and tasks.
 * Persists to ~/.agentops/data.json
 */
class Store {
  constructor(filePath) {
    this.filePath = filePath || path.join(
      process.env.HOME || process.env.USERPROFILE,
      '.agentops',
      'data.json'
    );
    this.data = { agents: [], goals: [], tasks: [] };
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this._save();
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  // --- Agents ---

  addAgent({ name, execPath, args, cwd, label }) {
    const agent = {
      id: randomUUID(),
      name,
      execPath,
      args: args || [],
      cwd: cwd || '',
      label: label || name,
      createdAt: Date.now(),
    };
    this.data.agents.push(agent);
    this._save();
    return agent;
  }

  getAgents() {
    return this.data.agents;
  }

  getAgent(id) {
    return this.data.agents.find((a) => a.id === id) || null;
  }

  removeAgent(id) {
    const idx = this.data.agents.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.data.agents.splice(idx, 1);
    this._save();
    return true;
  }

  // --- Goals ---

  addGoal({ title, description }) {
    const goal = {
      id: randomUUID(),
      title,
      description: description || '',
      status: 'active',
      createdAt: Date.now(),
    };
    this.data.goals.push(goal);
    this._save();
    return goal;
  }

  getGoals() {
    return this.data.goals;
  }

  getGoal(id) {
    return this.data.goals.find((g) => g.id === id) || null;
  }

  updateGoal(id, updates) {
    const goal = this.getGoal(id);
    if (!goal) return null;
    Object.assign(goal, updates);
    this._save();
    return goal;
  }

  // --- Tasks ---

  addTask({ goalId, title, description, agentId }) {
    const task = {
      id: randomUUID(),
      goalId,
      title,
      description: description || '',
      agentId: agentId || null,
      status: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };
    this.data.tasks.push(task);
    this._save();
    return task;
  }

  getTasks(goalId) {
    if (goalId) return this.data.tasks.filter((t) => t.goalId === goalId);
    return this.data.tasks;
  }

  getTask(id) {
    return this.data.tasks.find((t) => t.id === id) || null;
  }

  updateTask(id, updates) {
    const task = this.getTask(id);
    if (!task) return null;
    Object.assign(task, updates);
    if (updates.status === 'running' && !task.startedAt) {
      task.startedAt = Date.now();
    }
    if (updates.status === 'done' || updates.status === 'failed') {
      task.completedAt = Date.now();
    }
    this._save();
    return task;
  }

  removeTask(id) {
    const idx = this.data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.data.tasks.splice(idx, 1);
    this._save();
    return true;
  }
}

module.exports = { Store };
