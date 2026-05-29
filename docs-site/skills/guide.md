# Skill Guide

Skills are reusable capability modules that agents can load at runtime. They provide domain-specific instructions, tools, and context that extend what an agent can do.

## Architecture

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│  SkillRepository │────►│  SQLite Database  │     │  AgentEngine │
│                  │     │                   │     │              │
│  create()        │     │  skills table     │     │  _loadSkills()│
│  update()        │     │  skill_tags table │     │              │
│  delete()        │     │                   │     │  Injects into│
│  list()          │     └───────────────────┘     │  agent env   │
│  listTags()      │                               └──────────────┘
└──────────────────┘
```

Skills are stored in SQLite and loaded into agent processes via environment variables at spawn time.

## Data Model

### Skills Table

```sql
CREATE TABLE skills (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  content     TEXT NOT NULL,      -- The skill instructions/prompt
  tags        TEXT,               -- JSON array of tags
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

### Skill Tags Table

```sql
CREATE TABLE skill_tags (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (skill_id, tag)
);
```

## Skill Object Shape

```js
{
  id: string,
  name: string,          // Unique identifier (e.g., "code-review", "testing")
  description: string,   // What this skill does
  content: string,       // The actual skill instructions/prompt
  tags: string[],        // For categorization and filtering
  createdAt: number,     // Timestamp
  updatedAt: number,
}
```

## Creating Skills

### Via Repository

```js
const { SkillRepository } = require('./repositories/skill.repository');

const skillRepo = new SkillRepository(db);

const skill = skillRepo.create({
  name: 'code-review',
  description: 'Reviews code for bugs, style issues, and improvements',
  content: `You are a code reviewer. When reviewing code:
1. Check for bugs and logic errors
2. Verify error handling
3. Look for performance issues
4. Suggest improvements for readability
5. Flag security concerns`,
  tags: ['review', 'quality', 'security'],
});
```

### Via IPC (Renderer)

```js
const skill = await window.agentOps.skills.create({
  name: 'testing',
  description: 'Generates and runs tests for given code',
  content: 'You are a test engineer...',
  tags: ['testing', 'quality'],
});
```

## Listing and Filtering

```js
// List all skills
const all = skillRepo.list();

// Filter by single tag
const reviewSkills = skillRepo.list({ tag: 'review' });

// Filter by multiple tags (matches any)
const qualitySkills = skillRepo.list({ tags: ['review', 'testing'] });

// Search by name or description
const searchResults = skillRepo.list({ search: 'security' });

// Paginated
const page = skillRepo.list({ offset: 0, limit: 10 });

// Get all unique tags
const tags = skillRepo.listTags();
```

## Updating Skills

```js
const updated = skillRepo.update(skill.id, {
  description: 'Updated description',
  content: 'Updated skill instructions...',
  tags: ['review', 'quality', 'security', 'best-practices'],
});
```

## Deleting Skills

```js
const deleted = skillRepo.delete(skill.id);
// Returns true if deleted, false if not found
```

## How Skills Are Injected into Agents

When an agent is spawned via `AgentEngine`, skills are loaded and injected as an environment variable:

```js
// In agent-engine.js
const skillTags = config.skillTags || [];
const skills = this._loadSkills(skillTags.length > 0 ? skillTags : undefined);
if (skills.length > 0) {
  env.AGENT_SKILLS = JSON.stringify(skills);
}
```

The agent process receives `AGENT_SKILLS` as a JSON string in its environment. Agents can parse this to discover available skills.

### Spawning with Skills

```js
const { agentId } = engine.spawnAgent({
  execPath: '/usr/local/bin/claude',
  args: ['--print'],
  cwd: '/path/to/project',
  skillTags: ['review', 'testing'],  // Load skills matching these tags
});
```

## Skill Content Best Practices

### Structure

```markdown
# Skill Name

Brief description of what this skill does.

## Instructions

1. Step one
2. Step two
3. Step three

## Constraints

- Constraint one
- Constraint two

## Examples

Input: ...
Output: ...
```

### Guidelines

1. **Be specific** — vague instructions produce vague results
2. **Include examples** — show the expected input/output format
3. **Set boundaries** — define what the skill should NOT do
4. **Keep it focused** — one skill = one capability
5. **Use tags consistently** — enables reliable filtering at spawn time

## Common Skill Patterns

### Code Review Skill

```js
{
  name: 'code-review',
  tags: ['review', 'quality'],
  content: `Review the provided code changes. Focus on:
- Correctness: Does the code do what it claims?
- Error handling: Are edge cases covered?
- Performance: Any obvious bottlenecks?
- Security: Any injection or exposure risks?
- Readability: Would a new team member understand this?

Output format:
## Summary
[one-line assessment]

## Issues
- [severity] [file:line] [description]

## Suggestions
- [improvement]`
}
```

### Testing Skill

```js
{
  name: 'unit-testing',
  tags: ['testing', 'quality'],
  content: `Generate unit tests for the provided code.
Use the project's existing test framework.
Cover: happy path, edge cases, error conditions.
Each test should be independent and have a clear name.`
}
```

### Documentation Skill

```js
{
  name: 'api-docs',
  tags: ['docs', 'api'],
  content: `Generate API documentation for the provided code.
Include: endpoint, method, parameters, return type, error codes.
Use the project's existing doc format.`
}
```

## Tag Taxonomy

Recommended tag categories:

| Category | Tags | Use |
|----------|------|-----|
| **Task type** | `review`, `testing`, `docs`, `refactor` | What the skill does |
| **Domain** | `security`, `performance`, `accessibility` | Area of expertise |
| **Language** | `javascript`, `python`, `go` | Language-specific skills |
| **Quality** | `quality`, `best-practices`, `linting` | Code quality focus |

## Best Practices

1. **One skill, one job** — don't create mega-skills that try to do everything
2. **Tag deliberately** — tags are the primary filter mechanism
3. **Version your content** — update content when requirements change
4. **Test with real agents** — verify the skill produces expected results
5. **Keep content concise** — agents have context limits; every token counts
