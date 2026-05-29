import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SkillRepository } from '../src/main/repositories/skill.repository.js';

describe('SkillRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE skills (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        description   TEXT,
        content       TEXT NOT NULL,
        tags          TEXT DEFAULT '[]',
        version       TEXT,
        allowed_tools TEXT DEFAULT '[]',
        hooks         TEXT DEFAULT '{}',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE INDEX idx_skills_name ON skills(name);

      CREATE TABLE skill_tags (
        skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        tag         TEXT NOT NULL,
        PRIMARY KEY (skill_id, tag)
      );

      CREATE INDEX idx_skill_tags_tag ON skill_tags(tag);
    `);

    repo = new SkillRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('creates a skill with all fields', () => {
      const skill = repo.create({
        name: 'test-skill',
        description: 'A test skill',
        content: '# Test\nThis is a test skill.',
        tags: ['test', 'example'],
      });

      expect(skill).toBeDefined();
      expect(skill.id).toBeDefined();
      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe('A test skill');
      expect(skill.content).toBe('# Test\nThis is a test skill.');
      expect(skill.tags).toEqual(expect.arrayContaining(['test', 'example']));
      expect(skill.tags).toHaveLength(2);
      expect(skill.createdAt).toBeDefined();
      expect(skill.updatedAt).toBeDefined();
    });

    it('creates a skill with minimal fields', () => {
      const skill = repo.create({
        name: 'minimal-skill',
        content: 'Just content.',
      });

      expect(skill.name).toBe('minimal-skill');
      expect(skill.description).toBeNull();
      expect(skill.tags).toEqual([]);
    });

    it('creates a skill with format fields (version, allowedTools, hooks)', () => {
      const skill = repo.create({
        name: 'format-skill',
        description: 'A skill with format fields',
        content: '# Format',
        version: '2.0.0',
        allowedTools: ['Bash(git:*)', 'Read'],
        hooks: { on_enable: ['echo ok'], pre_run: ['git status'] },
      });

      expect(skill.version).toBe('2.0.0');
      expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Read']);
      expect(skill.hooks).toEqual({ on_enable: ['echo ok'], pre_run: ['git status'] });
    });

    it('normalizes tags to lowercase', () => {
      const skill = repo.create({
        name: 'tag-test',
        content: 'Content.',
        tags: ['Tag1', 'TAG2', ' tag3 '],
      });

      expect(skill.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('getById', () => {
    it('retrieves a skill by id', () => {
      const created = repo.create({ name: 'by-id', content: 'Content.' });
      const found = repo.getById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('by-id');
    });

    it('returns null for non-existent id', () => {
      expect(repo.getById('non-existent')).toBeNull();
    });
  });

  describe('getByName', () => {
    it('retrieves a skill by name', () => {
      repo.create({ name: 'by-name', content: 'Content.' });
      const found = repo.getByName('by-name');

      expect(found).toBeDefined();
      expect(found.name).toBe('by-name');
    });

    it('returns null for non-existent name', () => {
      expect(repo.getByName('non-existent')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates skill fields', () => {
      const created = repo.create({ name: 'to-update', content: 'Old content.', tags: ['old'] });
      const updated = repo.update(created.id, {
        name: 'updated',
        content: 'New content.',
        tags: ['new', 'tag'],
      });

      expect(updated.name).toBe('updated');
      expect(updated.content).toBe('New content.');
      expect(updated.tags).toEqual(['new', 'tag']);
    });

    it('returns null for non-existent id', () => {
      expect(repo.update('non-existent', { name: 'x' })).toBeNull();
    });

    it('persists format fields through update', () => {
      const created = repo.create({
        name: 'format-update',
        content: 'Old body.',
        version: '1.0.0',
        allowedTools: ['Read'],
        hooks: { on_enable: ['echo v1'] },
      });
      const updated = repo.update(created.id, {
        version: '2.0.0',
        allowedTools: ['Read', 'Write'],
        hooks: { on_enable: ['echo v2'], on_disable: ['echo bye'] },
      });

      expect(updated.version).toBe('2.0.0');
      expect(updated.allowedTools).toEqual(['Read', 'Write']);
      expect(updated.hooks).toEqual({ on_enable: ['echo v2'], on_disable: ['echo bye'] });
    });
  });

  describe('delete', () => {
    it('deletes a skill', () => {
      const created = repo.create({ name: 'to-delete', content: 'Content.' });
      expect(repo.delete(created.id)).toBe(true);
      expect(repo.getById(created.id)).toBeNull();
    });

    it('returns false for non-existent id', () => {
      expect(repo.delete('non-existent')).toBe(false);
    });

    it('cascades tags on delete', () => {
      const created = repo.create({ name: 'cascade-test', content: 'Content.', tags: ['a', 'b'] });
      repo.delete(created.id);

      const tagRows = db.prepare('SELECT * FROM skill_tags WHERE skill_id = ?').all(created.id);
      expect(tagRows).toHaveLength(0);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      repo.create({ name: 'skill-a', content: 'A', tags: ['frontend', 'react'] });
      repo.create({ name: 'skill-b', content: 'B', tags: ['backend', 'node'] });
      repo.create({ name: 'skill-c', content: 'C', tags: ['frontend', 'css'] });
    });

    it('lists all skills', () => {
      const result = repo.list();
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('filters by single tag', () => {
      const result = repo.list({ tag: 'frontend' });
      expect(result.items).toHaveLength(2);
      expect(result.items.every((s) => s.tags.includes('frontend'))).toBe(true);
    });

    it('filters by multiple tags', () => {
      const result = repo.list({ tags: ['react', 'css'] });
      expect(result.items).toHaveLength(2);
    });

    it('searches by name', () => {
      const result = repo.list({ search: 'skill-a' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('skill-a');
    });

    it('searches by description', () => {
      repo.create({ name: 'described', description: 'Special description', content: 'C' });
      const result = repo.list({ search: 'Special' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('described');
    });

    it('paginates results', () => {
      const result = repo.list({ offset: 1, limit: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('listTags', () => {
    it('returns all unique tags', () => {
      repo.create({ name: 'a', content: 'A', tags: ['x', 'y'] });
      repo.create({ name: 'b', content: 'B', tags: ['y', 'z'] });

      const tags = repo.listTags();
      expect(tags).toEqual(['x', 'y', 'z']);
    });

    it('returns empty array when no tags', () => {
      expect(repo.listTags()).toEqual([]);
    });
  });
});
