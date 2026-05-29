# Example 1: Basic Multi-Agent Setup (Claude + Codex)

This example demonstrates the simplest multi-agent workflow: two agents (Claude Code and Codex) each working on an independent task in parallel.

## What You'll Learn

- How to register CLI agents in AgentOps Desktop
- How to create a Goal with parallel Tasks
- How to monitor agent execution in real time

## Architecture

```
┌─────────────────────────────────────────┐
│              Goal: "Build TODO API"     │
│                                         │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  Task A       │  │  Task B          │ │
│  │  Claude Code  │  │  Codex           │ │
│  │  "Create API  │  │  "Write tests    │ │
│  │   routes"     │  │   for the API"   │ │
│  └──────────────┘  └──────────────────┘ │
│         parallel execution ──────►      │
└─────────────────────────────────────────┘
```

Both tasks run simultaneously because they have no dependencies on each other.

## Prerequisites

- AgentOps Desktop installed and running
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Codex CLI installed (`npm install -g @openai/codex`)

## Step-by-Step Guide

### Step 1: Register the Agents

Open AgentOps Desktop and navigate to **Settings → Agents**.

**Register Claude Code:**

1. Click **+ Add Agent**
2. Fill in:
   - **Name:** `claude-code`
   - **Type:** `claude-code`
   - **Executable Path:** `/usr/local/bin/claude` (adjust to your install path)
   - **Working Directory:** `/tmp/agentops-demo`
3. Click **Test Connection** — you should see a green checkmark
4. Click **Save**

**Register Codex:**

1. Click **+ Add Agent** again
2. Fill in:
   - **Name:** `codex`
   - **Type:** `codex`
   - **Executable Path:** `/usr/local/bin/codex` (adjust to your install path)
   - **Working Directory:** `/tmp/agentops-demo`
3. Click **Test Connection**
4. Click **Save**

### Step 2: Create a Goal

1. Navigate to **Goals** in the sidebar
2. Click **+ New Goal**
3. Fill in:
   - **Title:** `Build TODO API`
   - **Description:** `Create a simple REST API for managing TODO items with tests`
4. Click **Create**

### Step 3: Add Tasks to the Goal

With the "Build TODO API" goal open:

**Task A — API Routes (Claude):**

1. Click **+ Add Task**
2. Fill in:
   - **Title:** `Create API routes`
   - **Description:** `Build a REST API with GET /todos, POST /todos, DELETE /todos/:id endpoints using Express.js`
   - **Assign to:** `claude-code`
3. Click **Create**

**Task B — Tests (Codex):**

1. Click **+ Add Task** again
2. Fill in:
   - **Title:** `Write API tests`
   - **Description:** `Write Jest tests covering all CRUD operations for the TODO API`
   - **Assign to:** `codex`
3. Click **Create**

### Step 4: Run the Goal

1. Click the **Start** button on the Goal card
2. Both agents launch in parallel — watch the **Monitor** panel for real-time output
3. You'll see two terminal streams side by side:
   - Left: Claude Code building the API
   - Right: Codex writing tests

### Step 5: Review Results

When both tasks complete:

1. The Goal status changes to **completed**
2. Click on each task to see:
   - Files created/modified
   - Full stdout/stderr logs
   - Exit code and duration
3. Click **Confirm Delivery** to mark the Goal done

## Programmatic Usage

You can also set this up via the IPC API:

```js
// Register agents
const claude = await window.agentOps.agents.create({
  name: 'claude-code',
  type: 'claude-code',
  execPath: '/usr/local/bin/claude',
  cwd: '/tmp/agentops-demo',
});

const codex = await window.agentOps.agents.create({
  name: 'codex',
  type: 'codex',
  execPath: '/usr/local/bin/codex',
  cwd: '/tmp/agentops-demo',
});

// Create a goal
const goal = await window.agentOps.goals.create({
  title: 'Build TODO API',
  description: 'Create a simple REST API with tests',
});

// Create parallel tasks
await window.agentOps.tasks.create({
  title: 'Create API routes',
  description: 'Build Express.js CRUD endpoints for /todos',
  goalId: goal.id,
  assigneeAgentId: claude.id,
});

await window.agentOps.tasks.create({
  title: 'Write API tests',
  description: 'Write Jest tests for all endpoints',
  goalId: goal.id,
  assigneeAgentId: codex.id,
});
```

## HTTP API Equivalent

```bash
# Register agents
curl -X POST http://localhost:3967/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"claude-code","type":"claude-code","execPath":"/usr/local/bin/claude","cwd":"/tmp/agentops-demo"}'

curl -X POST http://localhost:3967/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"codex","type":"codex","execPath":"/usr/local/bin/codex","cwd":"/tmp/agentops-demo"}'

# Create goal
curl -X POST http://localhost:3967/api/goals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Build TODO API","description":"REST API with tests"}'

# Create tasks (use the returned IDs)
curl -X POST http://localhost:3967/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Create API routes","goalId":"<goal-id>","assigneeAgentId":"<claude-id>"}'

curl -X POST http://localhost:3967/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Write API tests","goalId":"<goal-id>","assigneeAgentId":"<codex-id>"}'
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Agent shows "error" status | Check that the executable path is correct and the CLI is installed |
| Task stays "pending" | Ensure the Goal is started (click Start) |
| No output in Monitor | Verify the agent's working directory exists and is writable |
| Agents run sequentially | Check Settings → max parallel agents (default: 3) |
