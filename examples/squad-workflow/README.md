# Example 2: Squad Workflow with Leader Delegation

This example shows how to create a Squad — a named group of agents with a designated leader that coordinates work among members.

## What You'll Learn

- How to create and configure Squads
- How a leader agent delegates tasks to squad members
- How to start/stop an entire squad as a unit

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Squad: "Feature Team"             │
│                                                  │
│  ┌────────────────────┐                          │
│  │  Leader: Claude     │                         │
│  │  "Build dashboard   │                         │
│  │   feature"          │                         │
│  └────────┬───────────┘                          │
│           │ delegates                            │
│     ┌─────┴──────┐                               │
│     ▼            ▼                               │
│  ┌────────┐  ┌────────┐                          │
│  │ Codex  │  │ Gemini │                          │
│  │ "Build │  │ "Write │                          │
│  │  UI"   │  │  docs" │                          │
│  └────────┘  └────────┘                          │
│                                                  │
│  All agents share the same working directory     │
└─────────────────────────────────────────────────┘
```

The leader receives the high-level goal, breaks it into subtasks, and assigns them to squad members.

## Prerequisites

- AgentOps Desktop installed and running
- At least two CLI agents installed (e.g., Claude Code + Codex, or Claude Code + Gemini CLI)

## Step-by-Step Guide

### Step 1: Register Agents

Navigate to **Settings → Agents** and register at least two agents.

**Leader — Claude Code:**
- **Name:** `squad-leader`
- **Type:** `claude-code`
- **Executable Path:** `/usr/local/bin/claude`
- **Working Directory:** `/tmp/agentops-squad-demo`

**Member A — Codex:**
- **Name:** `squad-frontend`
- **Type:** `codex`
- **Executable Path:** `/usr/local/bin/codex`
- **Working Directory:** `/tmp/agentops-squad-demo`

**Member B — Gemini CLI (optional):**
- **Name:** `squad-docs`
- **Type:** `gemini-cli`
- **Executable Path:** `/usr/local/bin/gemini`
- **Working Directory:** `/tmp/agentops-squad-demo`

### Step 2: Create a Squad

1. Navigate to **Squads** in the sidebar
2. Click **+ New Squad**
3. Fill in:
   - **Name:** `Feature Team`
   - **Description:** `Cross-functional squad for building features end-to-end`
   - **Leader:** Select `squad-leader` from the dropdown
4. Click **Create**

### Step 3: Add Members

With the "Feature Team" squad open:

1. Click **+ Add Member**
2. Select `squad-frontend`, set role to **member**
3. Click **Add**
4. Repeat for `squad-docs` if you registered it

Your squad should now show:

| Agent | Role |
|-------|------|
| squad-leader | leader |
| squad-frontend | member |
| squad-docs | member |

### Step 4: Create a Goal for the Squad

1. Navigate to **Goals** → **+ New Goal**
2. Fill in:
   - **Title:** `Build Settings Page`
   - **Description:** `Create a settings page with user preferences, theme toggle, and documentation`
3. Create tasks assigned to squad members:

| Task | Assignee | Description |
|------|----------|-------------|
| Design settings page layout | squad-leader | Plan the page structure and component hierarchy |
| Build React components | squad-frontend | Implement the settings form and theme toggle |
| Write user documentation | squad-docs | Document all settings options for end users |

### Step 5: Start the Squad

1. Go back to **Squads**
2. Click the **Start** button on "Feature Team"
3. All agents in the squad begin working on their assigned tasks
4. The squad status changes from `idle` → `running`

### Step 6: Monitor and Review

- The **Squad Status** panel shows aggregate progress (e.g., 2/3 tasks running)
- Click on individual members to see their terminal output
- When all tasks complete, the squad status returns to `idle`

### Step 7: Stop the Squad (if needed)

Click **Stop** on the squad to gracefully terminate all running agents. In-progress tasks are marked as failed; pending tasks are cancelled.

## Programmatic Usage

```js
// Create a squad
const squad = await window.agentOps.squads?.create?.({
  name: 'Feature Team',
  description: 'Cross-functional squad for building features',
  leaderId: 'squad-leader',  // agent ID
});

// Add members (via HTTP API — IPC may vary)
// POST /api/squads/{id}/members
// { "agentId": "squad-frontend", "role": "member" }
```

## HTTP API Equivalent

```bash
# Create squad
curl -X POST http://localhost:3967/api/squads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Feature Team","description":"Cross-functional squad","leaderId":"<leader-agent-id>"}'

# Add members
curl -X POST http://localhost:3967/api/squads/<squad-id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<frontend-agent-id>","role":"member"}'

curl -X POST http://localhost:3967/api/squads/<squad-id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<docs-agent-id>","role":"member"}'

# Start the squad
curl -X POST http://localhost:3967/api/squads/<squad-id>/start \
  -H "Authorization: Bearer $TOKEN"

# Check squad status
curl http://localhost:3967/api/squads/<squad-id>/status \
  -H "Authorization: Bearer $TOKEN"

# Stop the squad
curl -X POST http://localhost:3967/api/squads/<squad-id>/stop \
  -H "Authorization: Bearer $TOKEN"
```

## Leader Delegation Pattern

The leader agent in a squad acts as the coordinator. A typical delegation flow:

1. **Leader receives the high-level goal** — "Build a settings page"
2. **Leader analyzes the work** — identifies frontend components, documentation, and testing needs
3. **Leader creates subtasks** — breaks the goal into concrete tasks with clear acceptance criteria
4. **Leader assigns to members** — maps each task to the best-fit squad member
5. **Members execute** — each agent works on their assigned task independently
6. **Leader reviews output** — checks member results and integrates them

This pattern works best when:
- The goal is complex enough to benefit from specialization
- Members have different strengths (e.g., one for code, one for docs)
- The leader can effectively decompose and integrate the work

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Squad won't start | Ensure all member agents are registered and healthy |
| Leader doesn't delegate | Check that the leader agent's prompt includes delegation instructions |
| Members run same task | Ensure tasks have distinct titles and descriptions |
| Squad stuck in "running" | Check if any member agent has errored — stop and restart |
