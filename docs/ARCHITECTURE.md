# Architecture — AgentOps Desktop

> 版本：MVP (v0.1) | 最后更新：2026-05-28

## 设计原则

| 原则 | 含义 |
|------|------|
| **Local-first** | 所有数据存储在用户本机，无云端依赖 |
| **Real-time by default** | 日志和状态变更即时推送，不做轮询 |
| **Agent-agnostic** | 任何 CLI Agent 均可通过配置接入，不绑定特定厂商 |
| **MVP 仅做最小闭环** | 需求 → 拆解 → 多 Agent 执行 → 结果汇总 → 人工确认 |

---

## 系统总览

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Desktop App                  │
│                                                         │
│  ┌───────────────────────┐   ┌────────────────────────┐ │
│  │     Renderer Process  │   │     Main Process       │ │
│  │                       │   │                        │ │
│  │  React + TypeScript   │   │  ┌──────────────────┐  │ │
│  │  ┌─────────────────┐  │   │  │   IPC Handlers   │  │ │
│  │  │  Zustand Stores  │  │   │  └────────┬─────────┘  │ │
│  │  └────────┬────────┘  │   │           │            │ │
│  │           │           │   │  ┌────────┴─────────┐  │ │
│  │  ┌────────┴────────┐  │   │  │  Agent Runtime   │  │ │
│  │  │  React Views    │  │   │  │  (node-pty)      │  │ │
│  │  │  - Agent Panel  │◄─┤IPC├─┤  ┌──────────────┐ │  │ │
│  │  │  - Task Board   │  │   │  │  │ PTY Process  │ │  │ │
│  │  │  - Log Viewer   │  │   │  │  │ Pool         │ │  │ │
│  │  │  - Goal Board   │  │   │  │  └──────────────┘ │  │ │
│  │  └─────────────────┘  │   │  └──────────────────┘  │ │
│  │                       │   │                        │ │
│  │  xterm.js (终端渲染)  │   │  ┌──────────────────┐  │ │
│  │                       │   │  │   SQLite (WAL)   │  │ │
│  └───────────────────────┘   │  └──────────────────┘  │ │
│                              └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                    spawn / pty / stdin+stdout
                              │
                    ┌─────────▼─────────┐
                    │   CLI Agents      │
                    │  ┌──────────────┐  │
                    │  │ Claude Code  │  │
                    │  │ Codex        │  │
                    │  │ Gemini CLI   │  │
                    │  │ OpenCode     │  │
                    │  │ ...          │  │
                    │  └──────────────┘  │
                    └───────────────────┘
```

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| **桌面框架** | Electron 35 | 跨平台（macOS/Win/Linux），成熟生态，原生 IPC |
| **UI 框架** | React + TypeScript | 复杂交互 UI（看板、日志流），类型安全 |
| **状态管理** | Zustand | 轻量、无 boilerplate、原生支持 subscription |
| **终端渲染** | xterm.js + xterm-addon-fit | 浏览器端终端模拟，支持 ANSI 色彩和滚动 |
| **进程管理** | node-pty | 伪终端支持，CLI Agent 需要 TTY 环境 |
| **数据库** | better-sqlite3 (WAL mode) | 同步 API、零配置、单文件、崩溃恢复 |
| **构建** | electron-builder | 平台安装器生成，自动更新 |
| **测试** | Jest (unit) + Playwright (E2E) | 单元测试快速反馈，E2E 覆盖关键路径 |
| **Lint** | ESLint + @typescript-eslint | 代码风格统一 |
| **打包** | Vite (renderer) + tsc (main) | 快速 HMR（开发），可靠构建（生产） |

---

## 目录结构

```
AgentOpsDesktop/
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 入口：窗口创建、应用生命周期
│   │   ├── preload.ts              # contextBridge 安全暴露 IPC
│   │   ├── ipc/                    # IPC 处理器
│   │   │   ├── index.ts            # 注册所有 handler
│   │   │   ├── agent.ts            # agent:* 频道
│   │   │   ├── task.ts             # task:* / goal:* 频道
│   │   │   └── log.ts              # log:* 频道
│   │   ├── agent/                  # Agent 运行时管理
│   │   │   ├── registry.ts         # Agent 配置 CRUD（读写 SQLite）
│   │   │   ├── runtime.ts          # PTY 进程池：spawn / kill / stream
│   │   │   └── health.ts           # 健康检查（--version 探测）
│   │   ├── db/                     # 数据层
│   │   │   ├── connection.ts       # SQLite 连接（WAL mode）
│   │   │   ├── schema.ts           # 建表 DDL
│   │   │   ├── migrations.ts       # Schema 版本迁移
│   │   │   └── repositories/       # 数据访问对象
│   │   │       ├── agentRepo.ts
│   │   │       ├── goalRepo.ts
│   │   │       ├── taskRepo.ts
│   │   │       └── logRepo.ts
│   │   └── errors.ts               # 错误类型定义与处理
│   │
│   ├── renderer/                   # 渲染进程（React SPA）
│   │   ├── index.html              # HTML 入口
│   │   ├── main.tsx                # React 根挂载
│   │   ├── App.tsx                 # 路由 + 布局壳
│   │   ├── components/
│   │   │   ├── layout/             # Sidebar, Header, StatusBar
│   │   │   ├── agents/             # AgentList, AgentConfig, AgentStatusBadge
│   │   │   ├── goals/              # GoalBoard, GoalForm
│   │   │   ├── tasks/              # TaskBoard, TaskCard, TaskForm
│   │   │   ├── logs/               # LogViewer (xterm.js), LogFilter
│   │   │   └── shared/             # Button, Input, Card, Modal, Badge
│   │   ├── hooks/                  # 自定义 hooks
│   │   │   ├── useAgents.ts
│   │   │   ├── useTasks.ts
│   │   │   ├── useGoals.ts
│   │   │   └── useLogs.ts
│   │   ├── stores/                 # Zustand stores
│   │   │   ├── agentStore.ts
│   │   │   ├── taskStore.ts
│   │   │   └── logStore.ts
│   │   └── styles/                 # 全局样式 + CSS 变量
│   │       └── globals.css
│   │
│   └── shared/                     # 主进程 / 渲染进程共享
│       ├── types.ts                # Agent, Goal, Task, LogEntry 类型定义
│       ├── constants.ts            # IPC 频道名、状态枚举、默认值
│       └── ipc-contracts.ts        # 类型安全的 IPC 请求/响应签名
│
├── assets/                         # 图标、字体、音效
├── tests/
│   ├── unit/                       # Jest 单元测试
│   └── e2e/                        # Playwright E2E 测试
├── docs/                           # 文档
├── package.json
├── tsconfig.json
├── vite.config.ts                  # Renderer 构建配置
├── electron-builder.yml            # 打包配置
├── .eslintrc.cjs
└── .gitignore
```

---

## 数据模型

SQLite 数据库文件：`~/.agentops-desktop/data.db`（WAL mode）

### ER 关系

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  goals   │ 1───N │    tasks     │ N───1 │  agents  │
│          │       │              │       │          │
│ id (PK)  │       │ id (PK)      │       │ id (PK)  │
│ title    │       │ goal_id (FK) │       │ name     │
│ desc     │       │ agent_id(FK) │       │ exec_path│
│ status   │       │ title        │       │ work_dir │
│ created  │       │ description  │       │ type     │
│ updated  │       │ status       │       │ config   │
└──────────┘       │ output_summary│      │ status   │
                   │ started_at   │       │ created  │
                   │ completed_at │       │ updated  │
                   │ created_at   │       └──────────┘
                   │ updated_at   │
                   └──────┬───────┘
                          │ 1
                          │
                          │ N
                   ┌──────┴───────┐
                   │  task_logs   │
                   │              │
                   │ id (PK)      │
                   │ task_id (FK) │
                   │ stream       │
                   │ content      │
                   │ timestamp    │
                   └──────────────┘
```

### 表定义

```sql
-- Agent 配置
CREATE TABLE agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  executable_path TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  agent_type      TEXT NOT NULL,       -- 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'custom'
  config_json     TEXT DEFAULT '{}',   -- 额外参数：env vars, CLI args
  status          TEXT DEFAULT 'idle', -- 'idle' | 'running' | 'error' | 'offline'
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 目标
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active', -- 'active' | 'completed' | 'archived'
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 任务
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  goal_id         TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'pending', -- 'pending' | 'assigned' | 'running' | 'done' | 'failed' | 'blocked'
  output_summary  TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 任务日志（仅追加）
CREATE TABLE task_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stream    TEXT NOT NULL,  -- 'stdout' | 'stderr' | 'system'
  content   TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_task_logs_task ON task_logs(task_id);
```

---

## IPC 协议

通过 `contextBridge` 在 preload 脚本中安全暴露 API，渲染进程不直接访问 Node.js。

### 渲染进程 → 主进程（请求/响应）

| 频道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `agent:list` | — | `Agent[]` | 获取所有已配置 Agent |
| `agent:create` | `AgentConfig` | `Agent` | 新增 Agent 配置 |
| `agent:update` | `id, Partial<AgentConfig>` | `Agent` | 更新 Agent 配置 |
| `agent:delete` | `id` | `void` | 删除 Agent（运行中则先 kill） |
| `agent:health-check` | `id` | `HealthResult` | 探测 Agent 可执行文件是否可用 |
| `goal:list` | — | `Goal[]` | 获取所有目标 |
| `goal:create` | `GoalInput` | `Goal` | 创建目标 |
| `goal:update` | `id, Partial<GoalInput>` | `Goal` | 更新目标 |
| `goal:delete` | `id` | `void` | 删除目标（级联删除任务） |
| `task:list` | `goalId?` | `Task[]` | 获取任务（可按目标筛选） |
| `task:create` | `TaskInput` | `Task` | 创建任务 |
| `task:update` | `id, Partial<TaskInput>` | `Task` | 更新任务 |
| `task:delete` | `id` | `void` | 删除任务 |
| `task:assign` | `taskId, agentId` | `Task` | 分配任务给 Agent |
| `task:start` | `taskId` | `void` | 启动任务执行 |
| `task:stop` | `taskId` | `void` | 停止任务（kill agent 进程） |
| `log:get` | `taskId, offset?, limit?` | `LogEntry[]` | 获取任务日志（分页） |
| `log:clear` | `taskId` | `void` | 清除任务日志 |

### 主进程 → 渲染进程（推送事件）

| 频道 | 载荷 | 说明 |
|------|------|------|
| `agent:status` | `{ agentId, status, timestamp }` | Agent 状态变更 |
| `task:status` | `{ taskId, status, timestamp }` | 任务状态变更 |
| `task:log` | `{ taskId, stream, content, timestamp }` | 实时日志条目 |
| `task:output` | `{ taskId, summary }` | 任务完成后的产出摘要 |

---

## Agent 生命周期

```
  配置 Agent          健康检查           分配任务
     │                   │                  │
     ▼                   ▼                  ▼
 ┌────────┐         ┌─────────┐       ┌──────────┐
 │ idle   │────────►│ offline │       │ assigned │
 └────────┘  失败    └─────────┘       └────┬─────┘
     │                                      │
     │ 成功                                 │ task:start
     ▼                                      ▼
 ┌────────┐                            ┌──────────┐
 │ idle   │◄───────────────────────────│ running  │
 └────────┘          进程退出           └────┬─────┘
                                            │
                                   ┌────────┼────────┐
                                   ▼        ▼        ▼
                               ┌──────┐ ┌──────┐ ┌───────┐
                               │ done │ │failed│ │blocked│
                               └──────┘ └──────┘ └───────┘
```

### 进程管理细节（Agent Runtime）

```
task:start 触发：
1. 从 SQLite 读取 task + agent 配置
2. 通过 node-pty.spawn() 创建伪终端进程
   - executable: agent.executable_path
   - args: 根据 agent_type 构造（如 claude 用 --print 模式）
   - cwd: agent.working_directory 或 task 指定目录
   - env: 合并 agent.config_json 中的环境变量
3. 注册 data 事件 → 每条输出写入 task_logs 表 + IPC 推送
4. 注册 exit 事件 → 更新 task 状态（exit code 0 → done，非 0 → failed）
5. 进程句柄存入内存 Map<taskId, IPty>
6. 启动超时计时器（默认 30 分钟，可配置）

task:stop 触发：
1. 从内存 Map 取出进程句柄
2. 调用 process.kill() 发送 SIGTERM
3. 2 秒后若未退出，发送 SIGKILL
4. 更新 task 状态为 failed（reason: user_cancelled）
```

---

## 状态管理（Renderer）

采用 Zustand，每个领域一个 store，通过 IPC 事件订阅保持同步。

```
┌─────────────────────────────────────────────┐
│                Renderer                      │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ agentStore  │  │  goalStore  │           │
│  │             │  │             │           │
│  │ agents[]    │  │ goals[]     │           │
│  │ selected    │  │ selected    │           │
│  │ loading     │  │ loading     │           │
│  └──────┬──────┘  └──────┬──────┘           │
│         │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐           │
│  │  taskStore  │  │  logStore   │           │
│  │             │  │             │           │
│  │ tasks[]     │  │ buffers:    │           │
│  │ filters     │  │  Map<taskId,│           │
│  │ loading     │  │    LogEntry>│           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │        window.electronAPI            │   │
│  │  (contextBridge 暴露的 IPC 方法)      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**数据流原则：**
- 所有写操作通过 `window.electronAPI.method()` 调用主进程
- 主进程处理后返回结果，store 更新本地状态
- 主进程推送事件通过 `ipcRenderer.on()` 订阅，store 自动响应
- 组件通过 `useStore(selector)` 订阅，最小化重渲染

---

## 错误处理

| 场景 | 检测方式 | 恢复策略 |
|------|----------|----------|
| Agent 进程崩溃 | `exit` 事件，exit code ≠ 0 | 标记 task 为 failed，日志记录 stderr，UI 通知 |
| Agent 超时 | setTimeout（默认 30min） | 发送 SIGKILL，标记 task 为 failed（reason: timeout） |
| Agent 可执行文件不存在 | health check spawn 失败 | 标记 agent 为 offline，禁用分配 |
| SQLite 写入失败 | try/catch on db.run | 日志记录错误，UI toast 提示，不阻塞其他操作 |
| IPC 通信断开 | renderer visibilitychange 事件 | 重新注册事件监听，拉取最新状态 |
| 应用崩溃 | 主进程 uncaughtException | 日志写入 `~/.agentops-desktop/crash.log`，下次启动提示恢复 |

**超时配置：**
- 默认任务超时：30 分钟
- 可在 agent 配置中覆盖（`config_json.timeout`）
- 用户可在任务运行时手动延长

---

## 部署模型

```
开发者                    用户
  │                        │
  ├─ npm run dev           │
  │  (Vite HMR + Electron) │
  │                        │
  ├─ npm run build         │
  │  ├─ tsc (main)         │
  │  └─ vite build (renderer)
  │                        │
  ├─ electron-builder      │
  │  ├─ .dmg (macOS)       ├─ 下载安装
  │  ├─ .exe (Windows)     ├─ 启动应用
  │  └─ .AppImage (Linux)  ├─ 配置 Agent
  │                        └─ 开始使用
  └─ GitHub Releases
     + electron-updater
        (自动更新)
```

**构建产物：**
- macOS: `.dmg` + `.zip`（auto-update）
- Windows: `.exe` installer + `.zip`
- Linux: `.AppImage` + `.deb`

**数据目录：**
- macOS: `~/Library/Application Support/agentops-desktop/`
- Windows: `%APPDATA%/agentops-desktop/`
- Linux: `~/.config/agentops-desktop/`

包含：`data.db`（SQLite）、`logs/`（应用日志）、`crash.log`

---

## 安全边界

| 边界 | 措施 |
|------|------|
| **preload 隔离** | contextBridge 暴露最小 API，renderer 无法直接访问 Node.js |
| **输入校验** | IPC handler 校验所有参数类型和长度 |
| **SQL 注入** | better-sqlite3 参数化查询，禁止字符串拼接 |
| **路径遍历** | executable_path 和 working_directory 校验是否在允许范围内 |
| **进程隔离** | Agent 进程以当前用户权限运行，不提权 |

---

## 后续演进（非 MVP）

以下组件在 MVP 完成后按里程碑逐步引入：

| 组件 | 里程碑 | 说明 |
|------|--------|------|
| Paperclip Client | M2 | 目标/任务 CRUD 同步至控制面，审批门禁 |
| Multica Adapter | M3 | Agent 生命周期管理、技能注册 |
| Workflow Engine | M4 | 模板解析、步骤编排、条件分支 |
| 预算/成本控制 | M5 | Token 计量、成本面板、预算告警 |
| 审计日志 | M5 | 操作追溯、合规记录 |
| 多设备同步 | v2 | 云端数据同步、冲突解决 |

---

_此文档由 CTO 维护。架构决策变更需同步更新此文档。_
