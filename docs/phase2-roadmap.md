# Phase 2 Roadmap — CLI Adapters / Squad Intelligence / Agent Communication

> Last updated: 2026-05-29 (Round 2)
> Based on: `docs/phase2-competitive-analysis.md` and `docs/phase2-gap-matrix.csv`
> Dependencies: Phase 1 P0 (CMPAAA-282 ~ CMPAAA-285) — ALL DONE

---

## Overview

Phase 2 closes the critical gaps identified in competitive analysis across 3 pillars:

1. **CLI Adapters** — Provider-specific intelligence (not just generic CLI wrapping)
2. **Squad Intelligence** — Leader-driven delegation (not just parallel batch start)
3. **Agent Communication** — Shared context and agent-to-agent messaging

---

## Pillar 1: CLI Adapters (P0)

### Goal
AgentOps should offer the same provider-specific intelligence as Multica (12 providers) while maintaining its unique dynamic plugin architecture.

### Phase 2.1: Provider-Specific Adapters

**Issues to create:**

| Issue | Title | Priority | Effort | Description |
|-------|-------|----------|--------|-------------|
| CMPAAA-319 | Claude Code Adapter | P0 | M | Stream-json parsing, session resumption, MCP config injection, `--model` selection, skill path (`.claude/skills/`) |
| CMPAAA-321 | Codex Adapter | P0 | M | Cloud task submission/polling, model selection, sandbox environment config |
| CMPAAA-322 | Gemini CLI Adapter | P1 | S | Large context support, model selection, `--model` flag mapping |
| CMPAAA-318 | Auto-detection of installed CLIs | P0 | S | Scan PATH for `claude`, `codex`, `gemini`, `opencode`, `cursor-agent` binaries; register found adapters automatically at startup |
| CMPAAA-317 | Adapter interface extension | P0 | M | Add `sendInput(instanceId, data)`, `readStream(instanceId)` returning async iterator, `resumeSession(instanceId, sessionId)` to `AgentAdapter` base class |
| CMPAAA-320 | Stdout format abstraction | P1 | M | Define `OutputParser` interface with implementations for stream-json (Claude), line-delimited JSON (Codex), plain text (generic); adapters select parser at construction |

### Adapter Interface (Target)

```js
class AgentAdapter extends EventEmitter {
  // Existing
  async spawn(params)          // { task, cwd, env } -> { pid, instanceId }
  async kill(instanceId)       // string -> void
  async healthCheck()          // -> { ok, error? }
  async execute(task)          // { title, description, config } -> { output, exitCode }

  // New
  async sendInput(instanceId, data)   // Write to agent stdin
  async readStream(instanceId)        // Returns AsyncIterator<StreamEvent>
  async resumeSession(instanceId, sessionId)  // Resume previous session
  getOutputParser()                   // Returns OutputParser instance
}
```

### Auto-Detection Flow

```
startup()
  → scan PATH for known binaries
  → for each found binary:
    → check adapter_configs table for existing config
    → if not configured: create disabled config with detected execPath
    → if configured: verify execPath still valid
  → emit 'adapters:detected' event with findings
```

---

## Pillar 2: Squad Intelligence (P0)

### Goal
Transform squads from "parallel batch runners" to "intelligent delegation teams" matching Multica's leader-delegation pattern.

### Phase 2.2: Leader-Driven Squads

**Issues to create:**

| Issue | Title | Priority | Effort | Description |
|-------|-------|----------|--------|-------------|
| CMPAAA-323 | Squad instructions field | P0 | S | Add `instructions TEXT` column to `squads` table; inject into leader's system prompt at spawn time |
| CMPAAA-325 | Leader-only initial spawn | P0 | M | When a squad is assigned a task, only spawn the leader agent. Leader receives: squad roster, member capabilities, instructions, and the task. Leader decides which members to delegate to. |
| CMPAAA-326 | Member delegation via MessageBus | P0 | M | Leader publishes to `squad.{squadId}.delegate` topic with `{ memberId, task, context }`. Orchestrator subscribes and spawns the targeted member. Member completion publishes to `squad.{squadId}.complete`. |
| CMPAAA-327 | Leader re-activation on member completion | P1 | M | When all delegated members complete (or a member signals need for leader input), re-activate the leader with member outputs injected as context. Leader evaluates and either finishes or delegates further. |
| CMPAAA-328 | Squad trigger rules | P1 | L | Configurable rules: "on member completion → notify leader", "on error → notify leader", "on all complete → finalize". Stored as JSON in `squads.trigger_rules`. |
| CMPAAA-324 | Squad assignable to goals/tasks | P0 | S | Make `squad_id` a valid assignee for goals and tasks (alongside `agent_id`). Orchestrator handles squad assignment by spawning leader. |

### Squad Execution Flow (Target)

```
Goal assigned to Squad
  → Orchestrator reads squad config (leader, members, instructions)
  → Spawn leader agent with:
    - Squad Roster: [{ id, name, role, capabilities }]
    - Squad Instructions: user-defined routing rules
    - Task description + context
    - MessageBus subscription for squad.{squadId}.*
  → Leader analyzes task
  → Leader publishes delegation: squad.{squadId}.delegate = { memberId, subtask, context }
  → Orchestrator spawns targeted member with subtask + context
  → Member executes, publishes: squad.{squadId}.complete = { memberId, output }
  → Leader re-activated with member outputs
  → Leader evaluates: finish OR delegate more
  → Final output published to task_handoffs
```

---

## Pillar 3: Agent Communication (P1)

### Goal
Enable agents to share context, communicate directly, and collaboratively refine outputs — not just pass data through handoffs.

### Phase 2.3: Shared Context & Agent Messaging

**Issues to create:**

| Issue | Title | Priority | Effort | Description |
|-------|-------|----------|--------|-------------|
| CMPAAA-329 | Shared conversation context (Blackboard) | P1 | L | Add `shared_context` table: `{ dag_id, key, value_json, updated_by_agent, updated_at }`. DAG-level shared state that all agents in a workflow can read/write via env vars or IPC. |
| CMPAAA-330 | Agent-to-agent messaging via MessageBus | P1 | M | Expose MessageBus to agents via a lightweight IPC channel (Unix socket or localhost HTTP). Agents can publish/subscribe to topics. Security: agents can only access their squad's topic namespace. |
| CMPAAA-333 | Group chat mode for multi-agent | P2 | L | New orchestration mode: multiple agents in a shared conversation. Manager selects next speaker. Each agent sees full history. Max consecutive auto-reply limit. Use MessageBus for message routing. |
| CMPAAA-331 | Mid-execution context injection | P1 | M | Allow injecting additional context into a running agent via `sendInput()`. Use case: leader provides additional instructions to a member mid-task. Requires adapter interface extension (CMPAAA-317). |
| CMPAAA-332 | Per-task workspace isolation | P2 | M | Create isolated working directory per task (not per-agent). Inject project context files at spawn time. Auto-cleanup after task completion. Multica pattern: `workspaces/{taskId}/workdir/`. |

### Shared Context Schema

```sql
CREATE TABLE shared_context (
  id TEXT PRIMARY KEY,
  dag_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_by_agent TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (dag_id) REFERENCES dags(id),
  UNIQUE(dag_id, key)
);
```

### Agent MessageBus Access Pattern

```
Agent spawns
  → Orchestrator creates message channel: { agentId, allowedTopics: ["squad.{squadId}.*", "dag.{dagId}.*"] }
  → Agent receives channel config via env: AGENT_MSG_BUS_URL=unix:///tmp/agentops-{agentId}.sock
  → Agent connects, subscribes, publishes within allowed namespace
  → On agent kill: channel destroyed, subscriptions cleaned
```

---

## Implementation Order

```
Phase 2.1 (CLI Adapters) — Weeks 1-2
  ├── CMPAAA-317: Adapter interface extension (unblocks all adapters)
  ├── CMPAAA-318: Auto-detection (quick win, high UX impact)
  ├── CMPAAA-319: Claude Code adapter (highest priority provider)
  ├── CMPAAA-320: Stdout format abstraction
  ├── CMPAAA-321: Codex adapter
  └── CMPAAA-322: Gemini CLI adapter

Phase 2.2 (Squad Intelligence) — Weeks 3-4
  ├── CMPAAA-323: Squad instructions field (quick win)
  ├── CMPAAA-324: Squad assignable to goals (quick win)
  ├── CMPAAA-325: Leader-only initial spawn
  ├── CMPAAA-326: Member delegation via MessageBus
  └── CMPAAA-327: Leader re-activation

Phase 2.3 (Communication) — Weeks 5-6
  ├── CMPAAA-329: Shared context (blackboard)
  ├── CMPAAA-330: Agent-to-agent messaging
  ├── CMPAAA-331: Mid-execution context injection
  ├── CMPAAA-332: Per-task workspace isolation
  └── CMPAAA-333: Group chat mode
```

---

## Success Metrics

| Metric | Baseline (Phase 1) | Target (Phase 2) |
|--------|--------------------|--------------------|
| Supported CLI providers | 1 (generic) | 5+ (with provider-specific parsing) |
| Auto-detected CLIs | 0 | 3+ (Claude, Codex, Gemini) |
| Squad delegation model | Parallel batch | Leader-driven with routing |
| Agent communication | Task handoffs only | Handoffs + shared context + direct messaging |
| Session resumption | None | Claude Code + Codex |
| MCP support | None | Claude Code |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider CLI format changes | Adapter breaks | Per-provider output parser with version detection; `__AGENT_OUTPUT__` marker as universal fallback |
| MessageBus performance under agent load | Agent comms lag | Back-pressure + queue limits already exist; monitor with existing metrics |
| Squad delegation complexity | Leader may make poor routing decisions | Provide default "parallel all" mode alongside leader-delegation; user chooses per squad |
| Shared context race conditions | Data corruption | Use SQLite transactions; agent writes are atomic per-key |
| Scope creep into Phase 3 | Delay delivery | Hard-scope: CLI adapters + squad intelligence + shared context. No UI work in Phase 2. |
