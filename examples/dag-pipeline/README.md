# Example 3: DAG Pipeline with Data Flow

This example demonstrates a Directed Acyclic Graph (DAG) workflow where tasks have explicit dependencies and data flows from one task to the next.

## What You'll Learn

- How to define a DAG with dependency edges
- How tasks wait for predecessors before executing
- How to use the orchestrator API for complex multi-stage pipelines
- How `onFailure` strategies (`fail-fast` vs `best-effort`) affect pipeline behavior

## Architecture

```
                    ┌─────────────────┐
                    │  Task A          │
                    │  "Parse config"  │
                    │  (Claude)        │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
           ┌──────────────┐  ┌──────────────┐
           │  Task B       │  │  Task C       │
           │  "Generate    │  │  "Validate    │
           │   schemas"    │  │   config"     │
           │  (Claude)     │  │  (Codex)      │
           └──────┬───────┘  └──────┬───────┘
                  │                 │
                  └────────┬────────┘
                           ▼
                  ┌──────────────────┐
                  │  Task D           │
                  │  "Build project"  │
                  │  (Claude)         │
                  └────────┬─────────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
           ┌──────────────┐  ┌──────────────┐
           │  Task E       │  │  Task F       │
           │  "Run tests"  │  │  "Generate    │
           │  (Codex)      │  │   docs"       │
           │               │  │  (Claude)     │
           └──────────────┘  └──────────────┘

  ── = dependency edge (data flows this direction)
```

**Key properties:**
- Tasks B and C run in parallel (both depend only on A)
- Task D waits for both B and C to complete
- Tasks E and F run in parallel after D
- Total: 6 tasks, 3 execution waves

## Prerequisites

- AgentOps Desktop installed and running
- Claude Code CLI installed
- Codex CLI installed (optional — you can use Claude for all tasks)

## Step-by-Step Guide

### Step 1: Register Agents

Navigate to **Settings → Agents** and register:

**Agent 1 — Claude Code:**
- **Name:** `claude-pipeline`
- **Type:** `claude-code`
- **Executable Path:** `/usr/local/bin/claude`
- **Working Directory:** `/tmp/agentops-dag-demo`

**Agent 2 — Codex (optional):**
- **Name:** `codex-pipeline`
- **Type:** `codex`
- **Executable Path:** `/usr/local/bin/codex`
- **Working Directory:** `/tmp/agentops-dag-demo`

### Step 2: Create the DAG Definition

Navigate to the **Orchestrator** panel (or use the API). Define the pipeline:

```js
const dag = await window.agentOps.orchestrator.create({
  name: 'Config-Driven Build Pipeline',
  description: 'Parse config → generate schemas + validate → build → test + document',
  maxParallel: 3,
  retryMax: 2,
  retryBackoffMs: 2000,
  onFailure: 'fail-fast',

  tasks: [
    {
      id: 'parse-config',
      title: 'Parse configuration',
      agentId: 'claude-pipeline',
      config: {
        prompt: 'Read config.yaml and extract all schema definitions, build targets, and validation rules. Output a structured JSON summary.',
      },
    },
    {
      id: 'gen-schemas',
      title: 'Generate schemas',
      agentId: 'claude-pipeline',
      config: {
        prompt: 'Using the parsed config, generate TypeScript type definitions and JSON schemas for all data models.',
      },
    },
    {
      id: 'validate-config',
      title: 'Validate configuration',
      agentId: 'codex-pipeline',  // or 'claude-pipeline' if no Codex
      config: {
        prompt: 'Run validation checks on the parsed config. Verify all referenced files exist, all values are within bounds, and no circular dependencies exist.',
      },
    },
    {
      id: 'build-project',
      title: 'Build the project',
      agentId: 'claude-pipeline',
      config: {
        prompt: 'Run the build process. Compile TypeScript, bundle assets, and produce the final output in dist/.',
      },
    },
    {
      id: 'run-tests',
      title: 'Run test suite',
      agentId: 'codex-pipeline',  // or 'claude-pipeline'
      config: {
        prompt: 'Execute all unit and integration tests. Report pass/fail counts and any failures.',
      },
    },
    {
      id: 'gen-docs',
      title: 'Generate documentation',
      agentId: 'claude-pipeline',
      config: {
        prompt: 'Generate API documentation from the schemas and build output. Write to docs/ folder.',
      },
    },
  ],

  edges: [
    { from: 'parse-config',   to: 'gen-schemas' },
    { from: 'parse-config',   to: 'validate-config' },
    { from: 'gen-schemas',    to: 'build-project' },
    { from: 'validate-config', to: 'build-project' },
    { from: 'build-project',  to: 'run-tests' },
    { from: 'build-project',  to: 'gen-docs' },
  ],
});
```

### Step 3: Review the DAG

Before starting, verify the pipeline structure:

```js
const full = await window.agentOps.orchestrator.get(dag.id);

console.log('Tasks:', full.tasks.length);      // 6
console.log('Edges:', full.edges.length);       // 6
console.log('Status:', full.status);            // 'pending'

// Check dependency order
full.tasks.forEach(t => {
  console.log(`${t.id}: depends on [${t.dependsOn?.join(', ')}]`);
});
// parse-config: depends on []
// gen-schemas: depends on [parse-config]
// validate-config: depends on [parse-config]
// build-project: depends on [gen-schemas, validate-config]
// run-tests: depends on [build-project]
// gen-docs: depends on [build-project]
```

### Step 4: Start the Pipeline

```js
const result = await window.agentOps.orchestrator.start(dag.id);
console.log(result);  // { ok: true, dagId: 'dag-xxx' }
```

The orchestrator executes tasks in dependency order:

| Wave | Tasks | Parallelism |
|------|-------|-------------|
| 1 | parse-config | 1 task |
| 2 | gen-schemas, validate-config | 2 tasks parallel |
| 3 | build-project | 1 task |
| 4 | run-tests, gen-docs | 2 tasks parallel |

### Step 5: Monitor Progress

```js
// Poll progress
const progress = await window.agentOps.orchestrator.progress(dag.id);
console.log(progress);
// {
//   total: 6,
//   succeeded: 4,
//   running: 2,
//   failed: 0,
//   pending: 0,
//   cancelled: 0,
//   percent: 67
// }
```

Or watch in the **Monitor** panel — each task node lights up as it starts and turns green/red on completion.

### Step 6: Handle Failures

If a task fails, the behavior depends on `onFailure`:

**`fail-fast` (default):**
- The failed task's downstream tasks are skipped
- Other independent branches continue running
- The DAG status becomes `failed` when no more tasks can run

**`best-effort`:**
- The failed task's downstream tasks are skipped
- All other branches continue to completion
- The DAG status becomes `succeeded` if any path completes

To manually complete a `manual`-type task:

```js
await window.agentOps.orchestrator.task.complete(
  dag.id,
  'manual-review-task',
  'Approved — all checks pass',
  true  // success
);
```

### Step 7: Control the Pipeline

```js
// Pause — running tasks finish, no new ones start
await window.agentOps.orchestrator.pause(dag.id);

// Resume — queued tasks begin executing
await window.agentOps.orchestrator.resume(dag.id);

// Cancel — running tasks are killed, pending tasks are cancelled
await window.agentOps.orchestrator.cancel(dag.id);
```

## Advanced: Data Flow Between Tasks

While AgentOps doesn't automatically pipe stdout between tasks, you can implement data flow through the shared workspace:

```js
// In Task A's config:
config: {
  prompt: 'Write the parsed config to /tmp/agentops-dag-demo/.agentops/workspace/parsed-config.json',
}

// In Task B's config:
config: {
  prompt: 'Read /tmp/agentops-dag-demo/.agentops/workspace/parsed-config.json and generate schemas based on it',
}
```

This works because all tasks in the pipeline share the same working directory.

## HTTP API Equivalent

```bash
# Create DAG
curl -X POST http://localhost:3967/api/orchestrator/dags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Config-Driven Build Pipeline",
    "maxParallel": 3,
    "retryMax": 2,
    "onFailure": "fail-fast",
    "tasks": [
      {"id":"parse-config","title":"Parse configuration","agentId":"<agent-id>"},
      {"id":"gen-schemas","title":"Generate schemas","agentId":"<agent-id>"},
      {"id":"validate-config","title":"Validate configuration","agentId":"<agent-id>"},
      {"id":"build-project","title":"Build the project","agentId":"<agent-id>"},
      {"id":"run-tests","title":"Run test suite","agentId":"<agent-id>"},
      {"id":"gen-docs","title":"Generate documentation","agentId":"<agent-id>"}
    ],
    "edges": [
      {"from":"parse-config","to":"gen-schemas"},
      {"from":"parse-config","to":"validate-config"},
      {"from":"gen-schemas","to":"build-project"},
      {"from":"validate-config","to":"build-project"},
      {"from":"build-project","to":"run-tests"},
      {"from":"build-project","to":"gen-docs"}
    ]
  }'

# Start DAG
curl -X POST http://localhost:3967/api/orchestrator/dags/<dag-id>/start \
  -H "Authorization: Bearer $TOKEN"

# Get progress
curl http://localhost:3967/api/orchestrator/dags/<dag-id>/progress \
  -H "Authorization: Bearer $TOKEN"
```

## Common Pipeline Patterns

### Sequential Chain
```
A → B → C → D
```
Each task depends on the previous one. Use when order matters and each step builds on the last.

### Fan-Out / Fan-In
```
    ┌→ B ─┐
A → ├→ C ─┤ → D
    └→ E ─┘
```
One task fans out to parallel workers, then a join task collects results. Good for parallelizable work.

### Diamond
```
    ┌→ B ─┐
A →┤      ├→ D
    └→ C ─┘
```
Two independent branches that must both complete before the final task. Common in validation + generation workflows.

### Pipeline with Manual Gate
```
A → B → [manual-review] → C → D
```
Insert a `taskType: 'manual'` node to pause for human approval before continuing.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tasks never start | Check that all `from` edges reference valid task IDs |
| DAG stuck in "running" | Look for a task that errored — downstream tasks are blocked |
| Tasks run in wrong order | Verify edges point in the right direction (`from` → `to`) |
| Retry not working | Set `retryMax > 0` in the DAG definition |
| All tasks cancelled | Check if you called `cancel()` or if `fail-fast` triggered |
