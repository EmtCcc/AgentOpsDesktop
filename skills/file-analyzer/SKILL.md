---
name: file-analyzer
version: "1.0.0"
description: Analyzes a file or directory and produces a summary of structure, size, language distribution, and complexity metrics.
allowed-tools:
  - Bash(wc:*)
  - Bash(find:*)
  - Bash(du:*)
  - Read
  - Glob
  - Grep
hooks:
  pre_run:
    - echo "Analyzing target..."
  post_run:
    - echo "Analysis complete."
---

# File Analyzer Skill

Generates a structural summary of files or directories — line counts, language breakdown, and complexity indicators.

## Usage

```bash
# Analyze current directory
/file-analyzer .

# Analyze a specific file
/file-analyzer src/index.ts

# Analyze with depth limit
/file-analyzer . --depth=2
```

## What it does

1. **Enumerate** — walks the target path (recursively for directories).
2. **Measure** — collects:
   - File count and total size
   - Lines of code per file
   - Language breakdown (by extension)
3. **Report** — outputs a structured summary.

## Example

```
> /file-analyzer src/

## Analysis: src/

| Metric       | Value  |
|-------------|--------|
| Files       | 42     |
| Total size  | 128 KB |
| Total lines | 3,847  |

### Language Breakdown

| Language | Files | Lines |
|----------|-------|-------|
| TypeScript | 30 | 2,910 |
| JavaScript | 8  | 612   |
| JSON       | 4  | 325   |

### Largest Files

1. src/core/engine.ts — 420 lines
2. src/api/routes.ts — 380 lines
3. src/utils/helpers.ts — 210 lines
```
