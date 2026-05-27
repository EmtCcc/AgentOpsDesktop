import { describe, it, expect, beforeEach } from 'vitest';
const { validate, ValidationError } = require('../src/main/ipc/middleware/validate');
const { IpcError } = require('../src/main/ipc/errors');
const { paginate } = require('../src/main/ipc/pagination');

// ── Validation Middleware ──

describe('validate', () => {
  it('returns payload when no schema', () => {
    const payload = { foo: 'bar' };
    expect(validate(null, payload)).toBe(payload);
  });

  it('passes valid payload', () => {
    const schema = {
      name: { type: 'string', required: true },
      count: { type: 'number' },
    };
    const result = validate(schema, { name: 'test', count: 5 });
    expect(result.name).toBe('test');
    expect(result.count).toBe(5);
  });

  it('throws on missing required field', () => {
    const schema = { name: { type: 'string', required: true } };
    expect(() => validate(schema, {})).toThrow(ValidationError);
  });

  it('throws on wrong type', () => {
    const schema = { count: { type: 'number', required: true } };
    expect(() => validate(schema, { count: 'abc' })).toThrow(ValidationError);
  });

  it('throws on enum violation', () => {
    const schema = { status: { type: 'string', enum: ['active', 'done'] } };
    expect(() => validate(schema, { status: 'invalid' })).toThrow(ValidationError);
  });

  it('validates minLength and maxLength', () => {
    const schema = { name: { type: 'string', minLength: 2, maxLength: 10 } };
    expect(() => validate(schema, { name: 'a' })).toThrow(ValidationError);
    expect(() => validate(schema, { name: 'a'.repeat(11) })).toThrow(ValidationError);
    expect(() => validate(schema, { name: 'ok' })).not.toThrow();
  });

  it('skips optional absent fields', () => {
    const schema = { name: { type: 'string' } };
    expect(() => validate(schema, {})).not.toThrow();
  });

  it('passes through unknown fields', () => {
    const schema = { name: { type: 'string' } };
    const result = validate(schema, { name: 'test', extra: 'value' });
    expect(result.extra).toBe('value');
  });
});

// ── Pagination ──

describe('paginate', () => {
  it('paginates a Map', () => {
    const map = new Map();
    for (let i = 0; i < 50; i++) map.set(`id-${i}`, { id: `id-${i}`, createdAt: i });
    const result = paginate(map, { offset: 10, limit: 5 });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(50);
    expect(result.offset).toBe(10);
    expect(result.limit).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it('paginates an Array', () => {
    const arr = Array.from({ length: 30 }, (_, i) => ({ id: i, createdAt: i }));
    const result = paginate(arr, { limit: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(30);
  });

  it('caps limit at 100', () => {
    const arr = Array.from({ length: 200 }, (_, i) => ({ id: i, createdAt: i }));
    const result = paginate(arr, { limit: 500 });
    expect(result.items).toHaveLength(100);
    expect(result.limit).toBe(100);
  });

  it('applies filter predicate', () => {
    const arr = [
      { id: 1, status: 'active', createdAt: 1 },
      { id: 2, status: 'done', createdAt: 2 },
      { id: 3, status: 'active', createdAt: 3 },
    ];
    const result = paginate(arr, { filter: (item) => item.status === 'active' });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('sorts by createdAt descending by default', () => {
    const arr = [
      { id: 1, createdAt: 100 },
      { id: 2, createdAt: 300 },
      { id: 3, createdAt: 200 },
    ];
    const result = paginate(arr);
    expect(result.items[0].id).toBe(2);
    expect(result.items[1].id).toBe(3);
    expect(result.items[2].id).toBe(1);
  });

  it('sorts ascending when specified', () => {
    const arr = [
      { id: 1, createdAt: 300 },
      { id: 2, createdAt: 100 },
    ];
    const result = paginate(arr, { sortOrder: 'asc' });
    expect(result.items[0].id).toBe(2);
    expect(result.items[1].id).toBe(1);
  });
});

// ── IpcError ──

describe('IpcError', () => {
  it('creates not found error', () => {
    const err = IpcError.notFound('Agent', 'agent-1');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.message).toContain('agent-1');
  });

  it('creates validation error', () => {
    const err = IpcError.validation('bad input', 'name');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.field).toBe('name');
  });
});

// ── Task Controller ──

describe('taskController', () => {
  let taskController;

  beforeEach(async () => {
    // Fresh import to reset in-memory state
    taskController = await import('../src/main/ipc/controllers/task.controller.js');
    taskController = taskController.default || taskController;
  });

  it('creates a task', async () => {
    const task = await taskController.create(null, { title: 'Test task', description: 'A test' });
    expect(task.id).toMatch(/^task-/);
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('pending');
    expect(task.createdAt).toBeDefined();
  });

  it('lists tasks', async () => {
    await taskController.create(null, { title: 'Task 1' });
    await taskController.create(null, { title: 'Task 2' });
    const tasks = await taskController.list();
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('updates task status', async () => {
    const task = await taskController.create(null, { title: 'Update me' });
    const updated = await taskController.update(null, { id: task.id, updates: { status: 'running' } });
    expect(updated.status).toBe('running');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(task.createdAt);
  });

  it('deletes a task', async () => {
    const task = await taskController.create(null, { title: 'Delete me' });
    const result = await taskController.delete(null, { id: task.id });
    expect(result.deleted).toBe(true);
  });

  it('throws on get nonexistent task', async () => {
    await expect(taskController.get(null, { id: 'nonexistent' })).rejects.toThrow();
  });
});

// ── Goal Controller ──

describe('goalController', () => {
  let goalController;

  beforeEach(async () => {
    goalController = await import('../src/main/ipc/controllers/goal.controller.js');
    goalController = goalController.default || goalController;
  });

  it('creates a goal', async () => {
    const goal = await goalController.create(null, { title: 'Build API' });
    expect(goal.id).toMatch(/^goal-/);
    expect(goal.title).toBe('Build API');
    expect(goal.status).toBe('active');
    expect(goal.taskIds).toEqual([]);
  });

  it('lists goals', async () => {
    await goalController.create(null, { title: 'Goal 1' });
    const goals = await goalController.list();
    expect(goals.length).toBeGreaterThanOrEqual(1);
  });

  it('updates goal fields', async () => {
    const goal = await goalController.create(null, { title: 'Old title' });
    const updated = await goalController.update(null, { id: goal.id, updates: { title: 'New title', status: 'completed' } });
    expect(updated.title).toBe('New title');
    expect(updated.status).toBe('completed');
  });

  it('deletes a goal', async () => {
    const goal = await goalController.create(null, { title: 'Delete me' });
    const result = await goalController.delete(null, { id: goal.id });
    expect(result.deleted).toBe(true);
  });

  it('throws on get nonexistent goal', async () => {
    await expect(goalController.get(null, { id: 'nonexistent' })).rejects.toThrow();
  });
});
