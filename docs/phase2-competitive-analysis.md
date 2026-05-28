# Phase 2: Competitive Deep Analysis — CLI Adapters / Team Mode / Group Chat / Project Isolation

> Last updated: 2026-05-29
> Scope: Deep technical comparison across 4 dimensions beyond Phase 1 baseline
> Competitors: Multica, Paperclip, Golutra, CrewAI, AutoGen, AgentOps Desktop

---

## 1. CLI Adapter Patterns

### 1.1 Multica — Go Backend + Factory Registration

**Architecture**: Single `Backend` interface in Go, one implementation file per agent CLI.

```go
// server/pkg/agent/agent.go
type Backend interface {
    Execute(ctx context.Context, prompt string, opts ExecOptions) (*Session, error)
}
```

| Dimension | Detail |
|-----------|--------|
| **Interface** | Single `Execute()` returning stream `Messages` channel + final `Result` channel |
| **Registration** | Hard-coded `switch` in `New()` factory — 12 providers |
| **Provider files** | `claude.go`, `codex.go`, `copilot.go`, `hermes.go`, `gemini.go`, `pi.go`, `cursor.go`, `kimi.go`, `kiro.go`, `opencode.go`, `openclaw.go`, `antigravity.go` |
| **Spawn method** | `child_process.spawn` equivalent — Go `exec.Command`, stdin/stdout pipes |
| **Output parsing** | Per-provider stdout format (e.g., Claude: `--output-format stream-json`) |
| **Session resumption** | 9/12 support `ResumeSessionID` |
| **MCP support** | Only Claude Code consumes `mcp_config`; others ignore |
| **Auto-detection** | Daemon checks PATH for known CLI binaries at startup |
| **Skill injection** | Per-provider path (`.claude/skills/`, `.github/skills/`, `.kiro/skills/`) |
| **Max concurrency** | Daemon-level `MAX_CONCURRENT_TASKS=20`, agent-level `max_concurrent_tasks=6` |

**Strengths**: Mature, battle-tested across 12 providers. Auto-detection reduces config burden. Provider-specific stdout parsing handles real-world CLI quirks.

**Weaknesses**: Hard-coded factory — adding a new provider requires modifying `agent.go` switch. No runtime plugin loading. Go-only (no JS/Python adapter support without recompilation).

### 1.2 Paperclip (AgentOps) — JavaScript EventEmitter + Dynamic Registry

**Architecture**: Abstract `AgentAdapter` base class with dynamic class loading from `classPath`.

```js
// src/main/adapter-registry.js
class AgentAdapter extends EventEmitter {
  async spawn(params)    // { task, cwd, env } -> { pid?, handle? }
  async kill(instanceId) // string -> void
  async healthCheck()    // -> { ok, error? }
  async execute(task)    // { title, description, config } -> { output, exitCode }
}
```

| Dimension | Detail |
|-----------|--------|
| **Interface** | 4 methods: `spawn`, `kill`, `healthCheck`, `execute` |
| **Registration** | `registerClass(type, Class)` — runtime dynamic, no hard-coded switch |
| **Loading** | `loadFromConfigs([{ type, classPath, config }])` — require from file path |
| **Persistence** | `adapter_configs` SQLite table — enable/disable without restart |
| **Reference impl** | `GenericCliAdapter` — spawn any CLI with timeout, auto-kill, health check via `which` |
| **Concurrency** | Per-adapter `instances: Map<string, ChildProcess>` |
| **Events** | EventEmitter inheritance — adapters emit custom events |
| **Hot-reload** | `load()`/`unload()` at runtime without restart |

**Strengths**: True dynamic plugin loading — new adapters added via config, no code changes to registry. SQLite persistence survives restarts. EventEmitter enables rich event-driven integration.

**Weaknesses**: Only one reference adapter (`GenericCliAdapter`). No provider-specific stdout parsing (relies on `__AGENT_OUTPUT__` marker). No auto-detection of installed CLIs. No session resumption abstraction.

### 1.3 Golutra — Rust + Tauri Sidecar

**Architecture**: Rust backend spawns CLI processes via Tauri sidecar mechanism, Vue 3 frontend receives events.

| Dimension | Detail |
|-----------|--------|
| **Interface** | Rust trait (inferred): `spawn()`, `send_input()`, `read_output()`, `terminate()` |
| **Spawn mechanism** | Tauri sidecar: `app.shell().sidecar("agent-name").spawn()` |
| **IPC** | stdin/stdout pipes with JSON-line protocol |
| **Supported CLIs** | 7: Claude Code, Gemini CLI, Codex CLI, OpenCode, Qwen Code, OpenClaw, Generic |
| **Frontend comm** | Tauri command/event system — Rust emits events to Vue |
| **Memory** | EverOS external memory layer for cross-task continuity |
| **Prompt injection** | Direct stdin write to running terminal streams |
| **Workspace** | Session-level isolation, process-per-agent |

**Strengths**: Native performance (Rust). Tauri sidecar is the proven desktop pattern for CLI integration. Direct prompt injection enables interactive agent control.

**Weaknesses**: BSL 1.1 license (not truly open-source). Rust barrier for community contributions. No governance or budget features.

### 1.4 Comparative Analysis

| Feature | Multica | Paperclip/AgentOps | Golutra |
|---------|---------|-------------------|---------|
| **Language** | Go | JavaScript (Node.js) | Rust |
| **Interface complexity** | 1 method | 4 methods | ~5 methods (inferred) |
| **Dynamic loading** | No (hard-coded switch) | Yes (classPath require) | No (compile-time) |
| **Provider count** | 12 | 1 (generic) | 7 |
| **Auto-detection** | Yes (PATH scan) | No | No |
| **Session resumption** | 9/12 providers | No | Unknown |
| **MCP support** | Claude only | No | Via golutra-mcp |
| **Hot-reload** | No | Yes (load/unload) | No |
| **Persistence** | Config file | SQLite | Config file |
| **Stdout parsing** | Per-provider | `__AGENT_OUTPUT__` marker | Per-provider (inferred) |
| **Skill injection** | Per-provider path | `AGENT_SKILLS` env var | EverOS memory |

### 1.5 AgentOps Gap Assessment — CLI Adapters

| Gap | Severity | Description |
|-----|----------|-------------|
| **Only 1 adapter** | Critical | `GenericCliAdapter` works for any CLI but has no provider-specific intelligence (model selection, session resume, MCP) |
| **No auto-detection** | High | Users must manually configure every agent; Multica auto-detects 12 CLIs on PATH |
| **No session resumption** | High | 9/12 Multica providers support resume; AgentOps has none |
| **No MCP integration** | Medium | MCP is becoming the standard for tool integration; only Claude Code supports it natively |
| **No stdout format negotiation** | Medium | Each agent CLI outputs differently; need per-provider parsers or a format abstraction |
| **No interactive prompt injection** | Medium | Golutra injects prompts into running terminal streams; AgentOps only spawns and captures |

---

## 2. Team / Squad Mode

### 2.1 Multica — Leader-Delegation Squads

**Architecture**: Squad is a first-class assignee. Leader agent receives the task, then delegates to members via @mention comments.

| Dimension | Detail |
|-----------|--------|
| **Data model** | `Squad(name, leader_agent_id, instructions, archived_at)` + `SquadMember(agent_id, role)` |
| **Leader type** | Must be an agent (not human) |
| **Member types** | Agent or human, each with optional role description |
| **Multi-squad** | Same agent can belong to multiple squads |
| **Assignment** | Squad as a whole is assigned to an issue |
| **Execution** | Only leader starts → leader reads issue → leader @mentions selected members → members execute → leader evaluates |
| **Trigger rules** | Non-member comment → trigger leader; member progress → trigger leader; @mention → route to target; leader's own comment → no trigger (loop prevention) |
| **Instructions** | User-defined routing rules injected into leader's system prompt |
| **Deletion** | Soft delete — current issues auto-transfer to leader |

**Key insight**: Multica's squad is NOT "run all agents in parallel." It's "run the leader, let the leader decide who to delegate to." This is intelligent routing, not brute-force parallelism.

### 2.2 AgentOps — Flat Squads with Batch Operations

**Architecture**: Squad as a grouping mechanism with batch start/stop.

| Dimension | Detail |
|-----------|--------|
| **Data model** | `Squad(name, description, leader_id, status)` + `SquadMember(squad_id, agent_id, role[member/leader])` |
| **Operations** | CRUD + add/remove members + batchStart/batchStop |
| **Role** | `member` or `leader` — but leader role is not enforced in execution |
| **Execution** | `batchStart` spawns all members in parallel — no intelligent delegation |
| **No instructions** | No squad-level instructions injected into agents |
| **No trigger rules** | No event-driven re-activation based on member activity |
| **No delegation** | Leader cannot @mention or route tasks to specific members |

### 2.3 CrewAI — Role-Based Crews

**Architecture**: Agents defined by role, goal, backstory. Two orchestration modes.

| Dimension | Detail |
|-----------|--------|
| **Agent definition** | YAML or code: `role`, `goal`, `backstory`, `tools`, `llm` |
| **Orchestration** | Sequential (output feeds next) or Hierarchical (manager delegates) |
| **Context sharing** | Short-term memory, long-term memory, entity memory, cache, knowledge sources |
| **Planning** | `AgentPlanner` injects plans into task descriptions |
| **Async** | Native `akickoff()` for high-concurrency |
| **Replay** | `crewai replay -t <task_id>` for debugging |

### 2.4 AutoGen — Conversational Group Chat

**Architecture**: Agents communicate through message passing in conversation history.

| Dimension | Detail |
|-----------|--------|
| **Patterns** | Two-agent chat, sequential chat, group chat, nested chat |
| **Orchestration** | Selector Group Chat, Swarm (decentralized), Magentic-One, GraphFlow |
| **Messages** | Structured objects: user message → FunctionCall → FunctionExecutionResult → response |
| **Streaming** | `agent.run_stream(task=...)` |
| **Model client** | `ChatCompletionClient` interface (OpenAI-compatible) |

### 2.5 Comparative Analysis

| Feature | Multica | AgentOps | CrewAI | AutoGen |
|---------|---------|----------|--------|---------|
| **Squad as assignee** | Yes | No (grouping only) | N/A | N/A |
| **Leader delegation** | Yes (@mention) | No | Yes (hierarchical) | Yes (selector) |
| **Intelligent routing** | Yes (leader decides) | No (all parallel) | Yes (manager) | Yes (selector) |
| **Member roles** | Free-text descriptions | member/leader enum | role+goal+backstory | system message |
| **Instructions injection** | Yes (squad-level) | No | Yes (crew-level) | Yes (group chat rules) |
| **Trigger rules** | Yes (event-driven) | No | No | No |
| **Context sharing** | Via issue comments | Via task handoffs | Memory systems | Conversation history |
| **Batch operations** | Via leader | Yes (batchStart) | kickoff() | run() |

### 2.6 AgentOps Gap Assessment — Team Mode

| Gap | Severity | Description |
|-----|----------|-------------|
| **No intelligent delegation** | Critical | batchStart runs all members blindly; no leader-driven routing |
| **No squad-level instructions** | High | Cannot inject team-specific guidance into agent prompts |
| **Squad not assignable** | High | Squad is a grouping, not a first-class task assignee |
| **No trigger rules** | Medium | No event-driven re-activation when members complete work |
| **No memory/context sharing** | Medium | Agents in a squad share no context beyond task handoffs |
| **No hierarchical orchestration** | Medium | No manager-worker pattern; only flat parallel execution |

---

## 3. Multi-Agent Communication / Group Chat

### 3.1 Communication Pattern Taxonomy

| Pattern | Coupling | Latency | Complexity | AgentOps Status |
|---------|----------|---------|------------|-----------------|
| **Result Relay** | Medium | High | Low | ✅ Implemented (task_handoffs + TASK_INPUT env) |
| **Pub/Sub** | Loose | Medium | Medium | ✅ Implemented (MessageBus) |
| **Shared State (Blackboard)** | Tight | Low | Medium | ❌ Not implemented |
| **Message Passing (Direct)** | Loose | Medium | Low | ❌ Not implemented |
| **Group Chat** | Medium | High | High | ❌ Not implemented |
| **Graph/Workflow** | Medium | Medium | Medium | ✅ Implemented (DAG orchestrator) |

### 3.2 AgentOps Current IPC Architecture

**What exists**:
1. **MessageBus** — topic-based pub/sub with `*`/`**` wildcards, request/reply, back-pressure, SQLite persistence, crash recovery replay
2. **DAG TaskOrchestrator** — cycle detection, parallel execution (maxParallel=4), retry with backoff, fail-fast/best-effort modes
3. **Task Handoff** — `task_handoffs` table, `__AGENT_OUTPUT__` marker parsing, `TASK_INPUT` env injection
4. **AgentEngine** — state machine, resource monitoring, crash recovery, skill injection

**What's missing vs competitors**:

| Feature | Multica | AutoGen | CrewAI | AgentOps |
|---------|---------|---------|--------|----------|
| **Conversation history** | Via issue comments | Core paradigm | Via memory | ❌ No shared conversation |
| **Real-time streaming** | Stdout parsing | `run_stream()` | Async kickoff | Stdout capture only |
| **Agent-to-agent messaging** | Via @mention comments | Direct message objects | Task delegation | ❌ Only task handoffs |
| **Group discussion** | Issue thread | Group chat pattern | N/A | ❌ No group chat |
| **Shared memory** | Workspace files | Conversation context | Memory systems | ❌ No shared memory |
| **Human-in-the-loop** | Via comments | Built-in | N/A | ✅ Governance gates |

### 3.3 Group Chat Deep Dive (AutoGen Pattern)

AutoGen's group chat is the most sophisticated multi-agent communication model:

1. **GroupChatManager** selects next speaker based on context
2. Each agent sees full conversation history
3. Agents can request human input mid-conversation
4. Speaker selection can be round-robin, random, or LLM-driven
5. Max consecutive auto-reply limit prevents infinite loops

**AgentOps gap**: No equivalent of group chat. Task handoffs are one-directional (upstream → downstream). No mechanism for agents to discuss, debate, or collaboratively refine outputs.

### 3.4 Shared State / Blackboard Pattern (LangGraph/CrewAI)

LangGraph uses a shared state object that flows through the graph:
- Each node (agent) reads from and writes to the state
- State is typed (Pydantic models)
- Conditional edges route based on state values
- Supports cycles (agent can re-evaluate state and loop)

CrewAI's memory systems:
- **Short-term**: current task context
- **Long-term**: cross-task learnings
- **Entity memory**: knowledge about specific entities
- **Cache**: tool result caching
- **Knowledge**: crew-level shared documents

**AgentOps gap**: Task handoffs pass structured data between tasks, but there's no persistent shared state that all agents in a workflow can read/write. The MessageBus supports pub/sub but it's event-driven, not state-driven.

### 3.5 AgentOps Gap Assessment — Communication

| Gap | Severity | Description |
|-----|----------|-------------|
| **No shared conversation context** | Critical | Agents can't see each other's reasoning — only final outputs |
| **No agent-to-agent messaging** | High | Only task handoffs (async, one-directional); no real-time agent comms |
| **No group chat** | High | No mechanism for multi-agent discussion or collaborative refinement |
| **No shared memory/state** | Medium | No blackboard pattern; agents can't read/write shared workspace |
| **MessageBus unused by agents** | Medium | MessageBus exists but agents don't use it for inter-agent communication |
| **No streaming to agents** | Low | Agents receive input only at spawn time; no mid-execution context injection |

---

## 4. Project / Workspace Isolation

### 4.1 Isolation Patterns in the Market

| Approach | Isolation | Startup | Overhead | Used By |
|----------|-----------|---------|----------|---------|
| **Docker Container** | Strong | 1-5s | Medium | OpenHands, E2B |
| **Firecracker MicroVM** | Strongest | <1s | Medium-High | E2B, Modal |
| **Git Worktree** | Weak | Instant | Minimal | Claude Code, AgentOps |
| **Process + CWD** | Medium | ~100ms | Low | Multica, Golutra, AgentOps |
| **tmux Session** | Weak | Instant | Minimal | Power users |
| **VS Code Workspace** | Weak | Instant | Minimal | Cursor, Windsurf |

### 4.2 Multica — Workspace-per-Task

```
~/multica_workspaces/<workspace_id>/<task_id_short>/
  ├── workdir/     # Agent CWD + injected skills/context
  ├── output/      # Task outputs
  ├── logs/        # Execution logs
  └── .gc_meta.json
```

- Each task gets an isolated directory tree
- GC: done tasks 24h, orphan dirs 72h, build artifacts 12h
- Skills and context files injected per-task
- Agent sees only its own workspace

### 4.3 AgentOps — Workspace-per-Agent

```
Workspaces (migration v8):
  - id, agent_id FK, name, root_path, max_size_bytes
  WorkspaceSnapshots: workspace_id FK, name, file_count, size_bytes
```

- Workspaces are per-agent, not per-task
- `WorkspaceManager` handles workspace lifecycle
- Default 100MB size limit
- Snapshots for state capture

### 4.4 Comparative Analysis

| Feature | Multica | AgentOps | Golutra | OpenHands |
|---------|---------|----------|---------|-----------|
| **Isolation unit** | Per-task | Per-agent | Per-session | Per-container |
| **Auto-cleanup** | Yes (GC) | No | No | Container destroy |
| **Skill injection** | Per-task path | `AGENT_SKILLS` env | EverOS memory | Container mount |
| **Context files** | Injected per-task | Not injected | Session-level | Container mount |
| **Size limits** | Soft (GC) | Hard (max_size_bytes) | None | Container disk |
| **Snapshots** | No | Yes | No | Container image |
| **Multi-project** | Workspace ID | Agent-to-workspace | Session-based | Container-based |

### 4.5 AgentOps Gap Assessment — Project Isolation

| Gap | Severity | Description |
|-----|----------|-------------|
| **No per-task isolation** | Medium | Workspaces are per-agent; different tasks share the same working directory |
| **No auto-cleanup/GC** | Medium | No automatic cleanup of completed task workspaces |
| **No context injection** | Medium | Agents don't receive project-specific files/skills at spawn time |
| **No multi-project support** | Low | Single implicit company; no project-level isolation |

---

## 5. Cross-Cutting Insights

### 5.1 AgentOps Strengths (Maintain & Extend)

1. **Dynamic adapter registry** — Only system with runtime plugin loading + SQLite persistence
2. **Full DAG orchestrator** — Cycle detection, parallel execution, retry, failure modes — more sophisticated than Multica's flat task queue
3. **MessageBus** — Production-grade pub/sub with wildcards, request/reply, back-pressure, persistence — exists but underutilized
4. **Governance model** — Budget enforcement, RBAC, approval gates — unique among desktop tools
5. **AgentEngine** — State machine, resource monitoring, crash recovery — more robust than Multica's simple spawn/capture

### 5.2 Critical Gaps Summary

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| P0 | Provider-specific adapters (Claude, Codex, Gemini) | Users get generic experience for all agents | Medium |
| P0 | Auto-detection of installed CLIs | Manual config is friction | Low |
| P1 | Intelligent squad delegation (leader-driven) | Squads are dumb parallel runners | High |
| P1 | Shared conversation context for multi-agent | Agents can't see each other's reasoning | High |
| P1 | Session resumption | Lose context on restart | Medium |
| P2 | Group chat / agent discussion | No collaborative refinement | High |
| P2 | Per-task workspace isolation | Tasks share agent workspace | Medium |
| P2 | MCP integration | Missing the emerging standard | Medium |
| P3 | Interactive prompt injection | Can't steer running agents | Medium |
| P3 | Auto-cleanup / GC for workspaces | Disk usage grows unbounded | Low |

### 5.3 Strategic Positioning

AgentOps Desktop's unique value proposition after Phase 2:

> **"The only desktop tool that combines Multica's multi-CLI flexibility, Paperclip's governance model, and Golutra's native performance — with intelligent squad orchestration that none of them offer."**

| Capability | Multica | Paperclip | Golutra | AgentOps (Target) |
|------------|---------|-----------|---------|-------------------|
| Desktop app | ❌ | ❌ | ✅ | ✅ |
| Multi-CLI support | 12 providers | ❌ | 7 providers | Dynamic registry |
| Governance | ❌ | ✅ | ❌ | ✅ |
| Intelligent squads | ✅ (leader-delegation) | ❌ | ❌ | ✅ (Phase 2) |
| DAG orchestration | ❌ | ❌ | ❌ | ✅ |
| Dynamic plugins | ❌ | ❌ | ❌ | ✅ |
| MessageBus | ❌ | ❌ | ❌ | ✅ |

---

## 6. Recommendations

### Immediate (Phase 2.1 — CLI Adapters)
1. Build `ClaudeCodeAdapter` with `--output-format stream-json` parsing, session resumption, MCP config
2. Build `CodexAdapter` with cloud task submission and polling
3. Build `GeminiCliAdapter` with large-context support
4. Add PATH auto-detection for installed CLIs
5. Extend `AgentAdapter` interface with `sendInput()`, `readStream()`, `resumeSession()`

### Near-term (Phase 2.2 — Squad Intelligence)
1. Add `squadInstructions` field to squad model
2. Implement leader-delegation pattern: only leader starts, leader routes to members
3. Add trigger rules: member completion → re-activate leader
4. Wire MessageBus for agent-to-agent messaging within squads

### Medium-term (Phase 2.3 — Communication)
1. Add shared conversation context (blackboard pattern) to DAG orchestrator
2. Implement group chat mode for multi-agent discussion
3. Enable mid-execution prompt injection via MessageBus
4. Add per-task workspace isolation with auto-GC
