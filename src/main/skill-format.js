'use strict';

const matter = require('gray-matter');
const yaml = require('js-yaml');

const HOOK_KEYS = ['on_enable', 'on_disable', 'on_invoke', 'pre_run', 'post_run'];

/**
 * Parse a SKILL.md string into a structured skill object.
 *
 * @param {string} raw — full SKILL.md content (frontmatter + body)
 * @returns {{ frontmatter: object, body: string }}
 *   frontmatter: { name, version, description, allowed-tools?, hooks? }
 *   body: Markdown content after the frontmatter
 * @throws on missing required frontmatter fields
 */
function parseSkillMd(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('SKILL.md content must be a non-empty string');
  }

  const { data, content } = matter(raw);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error('SKILL.md frontmatter must include a "name" field (string)');
  }
  if (!data.version || typeof data.version !== 'string') {
    throw new Error('SKILL.md frontmatter must include a "version" field (semver string)');
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error('SKILL.md frontmatter must include a "description" field (string)');
  }

  const frontmatter = {
    name: data.name,
    version: String(data.version),
    description: data.description,
  };

  if (Array.isArray(data['allowed-tools'])) {
    frontmatter['allowed-tools'] = data['allowed-tools'].map(String);
  }

  if (data.hooks && typeof data.hooks === 'object') {
    const hooks = {};
    for (const key of HOOK_KEYS) {
      if (Array.isArray(data.hooks[key])) {
        hooks[key] = data.hooks[key].map(String);
      }
    }
    if (Object.keys(hooks).length > 0) {
      frontmatter.hooks = hooks;
    }
  }

  return { frontmatter, body: content.trim() };
}

/**
 * Serialize a skill object back to SKILL.md format.
 *
 * @param {object} skill
 * @param {string} skill.name
 * @param {string} skill.version
 * @param {string} skill.description
 * @param {string[]} [skill.allowedTools]
 * @param {object} [skill.hooks]
 * @param {string} [skill.body] — Markdown body
 * @returns {string} — complete SKILL.md content
 */
function serializeSkillMd(skill) {
  if (!skill.name || !skill.version || !skill.description) {
    throw new Error('Cannot serialize skill: name, version, and description are required');
  }

  const fm = {
    name: skill.name,
    version: String(skill.version),
    description: skill.description,
  };

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    fm['allowed-tools'] = skill.allowedTools;
  }

  if (skill.hooks && typeof skill.hooks === 'object') {
    const hooks = {};
    for (const key of HOOK_KEYS) {
      if (Array.isArray(skill.hooks[key]) && skill.hooks[key].length > 0) {
        hooks[key] = skill.hooks[key];
      }
    }
    if (Object.keys(hooks).length > 0) {
      fm.hooks = hooks;
    }
  }

  const yamlStr = yaml.dump(fm, { lineWidth: 120, quotingType: '"', forceQuotes: false });
  const body = skill.body || '';
  return `---\n${yamlStr}---\n\n${body}`;
}

/**
 * Validate that a raw string is well-formed SKILL.md.
 * Returns { valid, errors }.
 */
function validateSkillMd(raw) {
  try {
    parseSkillMd(raw);
    return { valid: true, errors: [] };
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

module.exports = { parseSkillMd, serializeSkillMd, validateSkillMd };
