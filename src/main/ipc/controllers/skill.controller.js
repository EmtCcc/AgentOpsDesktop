'use strict';

const { IpcError } = require('../errors');

let skillRepo = null;

const skillController = {
  setRepository(repo) {
    skillRepo = repo;
  },

  async list(event, params = {}) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    return skillRepo.list(params);
  },

  async get(event, { id }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const skill = skillRepo.getById(id);
    if (!skill) throw IpcError.notFound('Skill', id);
    return skill;
  },

  async create(event, skill) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const existing = skillRepo.getByName(skill.name);
    if (existing) throw IpcError.conflict(`Skill name already exists: ${skill.name}`);
    return skillRepo.create(skill);
  },

  async update(event, { id, updates }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const existing = skillRepo.getById(id);
    if (!existing) throw IpcError.notFound('Skill', id);
    return skillRepo.update(id, updates);
  },

  async delete(event, { id }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const existing = skillRepo.getById(id);
    if (!existing) throw IpcError.notFound('Skill', id);
    skillRepo.delete(id);
    return { deleted: true, id };
  },

  async listTags() {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    return skillRepo.listTags();
  },

  async searchByTags(event, { tags }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw IpcError.validation('tags must be a non-empty array');
    }
    return skillRepo.list({ tags });
  },
};

skillController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    tag: { type: 'string' },
    tags: { type: 'string' },
    search: { type: 'string' },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    content: { type: 'string', required: true, minLength: 1 },
    tags: { type: 'object' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'description', 'content', 'tags'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  listTags: {},
  searchByTags: {
    tags: { type: 'object', required: true },
  },
};

module.exports = skillController;
