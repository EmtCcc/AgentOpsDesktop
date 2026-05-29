import { describe, it, expect } from 'vitest';
import { parseSkillMd, serializeSkillMd, validateSkillMd } from '../src/main/skill-format.js';

const HELLO_WORLD = `---
name: hello-world
version: "1.0.0"
description: A minimal example skill that greets the user and demonstrates the SKILL.md format.
allowed-tools:
  - Bash(echo:*)
hooks:
  on_enable:
    - echo "hello-world skill enabled"
  on_disable:
    - echo "hello-world skill disabled"
---

# Hello World Skill

The simplest possible skill.
`;

const CODE_REVIEW = `---
name: code-review
version: "1.0.0"
description: Reviews staged or specified files for common issues.
allowed-tools:
  - Bash(git:*)
  - Bash(npx:*)
  - Read
  - Grep
  - Glob
hooks:
  on_invoke:
    - git diff --cached --name-only
---

# Code Review Skill
`;

const MINIMAL = `---
name: minimal
version: "2.0.0"
description: A bare minimum skill.
---

Just a body.
`;

describe('parseSkillMd', () => {
  it('parses a full SKILL.md with all fields', () => {
    const { frontmatter, body } = parseSkillMd(HELLO_WORLD);
    expect(frontmatter.name).toBe('hello-world');
    expect(frontmatter.version).toBe('1.0.0');
    expect(frontmatter.description).toContain('minimal example');
    expect(frontmatter['allowed-tools']).toEqual(['Bash(echo:*)']);
    expect(frontmatter.hooks).toEqual({
      on_enable: ['echo "hello-world skill enabled"'],
      on_disable: ['echo "hello-world skill disabled"'],
    });
    expect(body).toContain('# Hello World Skill');
  });

  it('parses skill with multiple allowed-tools and on_invoke hook', () => {
    const { frontmatter } = parseSkillMd(CODE_REVIEW);
    expect(frontmatter['allowed-tools']).toEqual([
      'Bash(git:*)', 'Bash(npx:*)', 'Read', 'Grep', 'Glob',
    ]);
    expect(frontmatter.hooks).toEqual({
      on_invoke: ['git diff --cached --name-only'],
    });
  });

  it('parses minimal SKILL.md with no optional fields', () => {
    const { frontmatter, body } = parseSkillMd(MINIMAL);
    expect(frontmatter.name).toBe('minimal');
    expect(frontmatter.version).toBe('2.0.0');
    expect(frontmatter['allowed-tools']).toBeUndefined();
    expect(frontmatter.hooks).toBeUndefined();
    expect(body).toBe('Just a body.');
  });

  it('throws on empty input', () => {
    expect(() => parseSkillMd('')).toThrow('non-empty string');
    expect(() => parseSkillMd(null)).toThrow('non-empty string');
  });

  it('throws on missing name', () => {
    const raw = `---\nversion: "1.0.0"\ndescription: test\n---\n\nbody`;
    expect(() => parseSkillMd(raw)).toThrow('"name"');
  });

  it('throws on missing version', () => {
    const raw = `---\nname: test\ndescription: test\n---\n\nbody`;
    expect(() => parseSkillMd(raw)).toThrow('"version"');
  });

  it('throws on missing description', () => {
    const raw = `---\nname: test\nversion: "1.0.0"\n---\n\nbody`;
    expect(() => parseSkillMd(raw)).toThrow('"description"');
  });

  it('normalizes version to string', () => {
    const raw = `---\nname: test\nversion: 1.0.0\ndescription: test\n---\n\nbody`;
    const { frontmatter } = parseSkillMd(raw);
    expect(typeof frontmatter.version).toBe('string');
    expect(frontmatter.version).toBe('1.0.0');
  });

  it('ignores unknown hook keys', () => {
    const raw = `---
name: test
version: "1.0.0"
description: test
hooks:
  on_enable:
    - echo ok
  bogus_hook:
    - echo nope
---

body`;
    const { frontmatter } = parseSkillMd(raw);
    expect(frontmatter.hooks).toEqual({ on_enable: ['echo ok'] });
    expect(frontmatter.hooks.bogus_hook).toBeUndefined();
  });
});

describe('serializeSkillMd', () => {
  it('roundtrips a full skill', () => {
    const original = {
      name: 'hello-world',
      version: '1.0.0',
      description: 'A minimal example skill.',
      allowedTools: ['Bash(echo:*)'],
      hooks: {
        on_enable: ['echo "hello-world skill enabled"'],
        on_disable: ['echo "hello-world skill disabled"'],
      },
      body: '# Hello World\n\nThe simplest skill.',
    };

    const md = serializeSkillMd(original);
    const { frontmatter, body } = parseSkillMd(md);

    expect(frontmatter.name).toBe(original.name);
    expect(frontmatter.version).toBe(original.version);
    expect(frontmatter.description).toBe(original.description);
    expect(frontmatter['allowed-tools']).toEqual(original.allowedTools);
    expect(frontmatter.hooks).toEqual(original.hooks);
    expect(body).toBe(original.body);
  });

  it('roundtrips a minimal skill', () => {
    const original = { name: 'min', version: '1.0.0', description: 'bare' };
    const md = serializeSkillMd(original);
    const { frontmatter, body } = parseSkillMd(md);

    expect(frontmatter.name).toBe('min');
    expect(frontmatter['allowed-tools']).toBeUndefined();
    expect(frontmatter.hooks).toBeUndefined();
  });

  it('omits empty hooks arrays', () => {
    const md = serializeSkillMd({
      name: 'test',
      version: '1.0.0',
      description: 'test',
      hooks: { on_enable: [], on_disable: ['echo bye'] },
    });
    const { frontmatter } = parseSkillMd(md);
    expect(frontmatter.hooks).toEqual({ on_disable: ['echo bye'] });
  });

  it('throws on missing required fields', () => {
    expect(() => serializeSkillMd({ name: 'x' })).toThrow('required');
    expect(() => serializeSkillMd({ version: '1' })).toThrow('required');
    expect(() => serializeSkillMd({ description: 'd' })).toThrow('required');
  });
});

describe('validateSkillMd', () => {
  it('returns valid for well-formed SKILL.md', () => {
    const result = validateSkillMd(HELLO_WORLD);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns invalid with errors for bad content', () => {
    const result = validateSkillMd('no frontmatter here');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid for empty string', () => {
    const result = validateSkillMd('');
    expect(result.valid).toBe(false);
  });
});
