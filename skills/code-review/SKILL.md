---
name: code-review
version: "1.0.0"
description: Reviews staged or specified files for common issues — style violations, missing error handling, and potential bugs.
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

Performs a lightweight code review on staged changes or a specified file list.

## Usage

```bash
# Review all staged files
/code-review

# Review specific files
/code-review src/auth.ts src/middleware.ts

# Review with a focus area
/code-review --focus=security
```

## What it does

1. **Collect targets** — reads staged files from `git diff --cached`, or uses the argument list.
2. **Static scan** — greps for common anti-patterns:
   - `console.log` left in production code
   - Missing `try/catch` around async calls
   - Hardcoded secrets or tokens
   - Unchecked `null`/`undefined` access
3. **Report** — outputs findings grouped by file with line references.

## Example

```
> /code-review src/api/users.ts

## Findings

### src/api/users.ts
- Line 23: `console.log(token)` — possible secret leak
- Line 45: async call without try/catch — unhandled rejection risk

Reviewed 1 file, found 2 issues.
```
