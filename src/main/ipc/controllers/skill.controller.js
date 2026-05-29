'use strict';

const { IpcError } = require('../errors');
const { parseSkillMd, serializeSkillMd, validateSkillMd } = require('../../skill-format');

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

  /**
   * Import a skill from SKILL.md content (YAML frontmatter + Markdown body).
   * If a skill with the same name exists, updates it; otherwise creates.
   */
  async importSkillMd(event, { content, overwrite = false }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw IpcError.validation('content must be a non-empty string');
    }

    const { frontmatter, body } = parseSkillMd(content);
    const existing = skillRepo.getByName(frontmatter.name);

    if (existing && !overwrite) {
      throw IpcError.conflict(`Skill "${frontmatter.name}" already exists. Pass overwrite=true to replace.`);
    }

    const skillData = {
      name: frontmatter.name,
      description: frontmatter.description,
      content: body,
      version: frontmatter.version,
      allowedTools: frontmatter['allowed-tools'] || [],
      hooks: frontmatter.hooks || {},
      tags: [],
    };

    if (existing) {
      return skillRepo.update(existing.id, skillData);
    }
    return skillRepo.create(skillData);
  },

  /**
   * Export a skill as SKILL.md content.
   */
  async exportSkillMd(event, { id }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const skill = skillRepo.getById(id);
    if (!skill) throw IpcError.notFound('Skill', id);

    const md = serializeSkillMd({
      name: skill.name,
      version: skill.version || '1.0.0',
      description: skill.description || '',
      allowedTools: skill.allowedTools,
      hooks: skill.hooks,
      body: skill.content,
    });

    return { id: skill.id, name: skill.name, content: md };
  },

  /**
   * Validate raw SKILL.md content without importing.
   */
  async validateSkillMd(event, { content }) {
    if (typeof content !== 'string') {
      throw IpcError.validation('content must be a string');
    }
    return validateSkillMd(content);
  },

  /**
   * Import all SKILL.md files from a directory path.
   */
  async importFromDirectory(event, { dirPath, overwrite = false }) {
    if (!skillRepo) throw IpcError.internal('Skill repository not initialized');
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(dirPath)) {
      throw IpcError.validation(`Directory not found: ${dirPath}`);
    }

    const results = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(dirPath, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      try {
        const raw = fs.readFileSync(skillFile, 'utf-8');
        const { frontmatter, body } = parseSkillMd(raw);
        const existing = skillRepo.getByName(frontmatter.name);

        if (existing && !overwrite) {
          results.push({ name: frontmatter.name, status: 'skipped', reason: 'already exists' });
          continue;
        }

        const skillData = {
          name: frontmatter.name,
          description: frontmatter.description,
          content: body,
          version: frontmatter.version,
          allowedTools: frontmatter['allowed-tools'] || [],
          hooks: frontmatter.hooks || {},
          tags: [],
        };

        if (existing) {
          skillRepo.update(existing.id, skillData);
          results.push({ name: frontmatter.name, status: 'updated' });
        } else {
          skillRepo.create(skillData);
          results.push({ name: frontmatter.name, status: 'created' });
        }
      } catch (err) {
        results.push({ name: entry.name, status: 'error', error: err.message });
      }
    }

    return results;
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
    version: { type: 'string' },
    allowedTools: { type: 'object' },
    hooks: { type: 'object' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'description', 'content', 'tags', 'version', 'allowedTools', 'hooks'];
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
  importSkillMd: {
    content: { type: 'string', required: true },
    overwrite: { type: 'boolean' },
  },
  exportSkillMd: {
    id: { type: 'string', required: true },
  },
  validateSkillMd: {
    content: { type: 'string', required: true },
  },
  importFromDirectory: {
    dirPath: { type: 'string', required: true },
    overwrite: { type: 'boolean' },
  },
};

module.exports = skillController;
