# Code Review Report — CMPAAA-593

**审查范围**: Round 2 新增代码（适配器、消息总线、共享上下文、适配器注册表）
**审查日期**: 2026-05-29
**审查人**: Agent bfc597fa
**测试状态**: ✅ 1263/1263 passed，无回归

---

## 判词

Round 2 架构设计合理，模块边界清晰。发现 **3 个 P1 bug**、**3 个 P2 安全/可靠性问题**、**2 个 P3 改进建议**。P1 的 `delegateToRole` requestId 缺失导致该功能完全不可用（总是超时）。

---

## 🔴 P1 — 功能性 Bug

### 1. delegateToRole 服务端响应未回传 requestId

**文件**: `src/main/message-bus/socket-server.js:409,421`
**影响**: `delegateToRole()` 功能完全不可用，Promise 总是挂起至超时

**根因**: 客户端 `socket-client.js:266` 发送 `{ type: 'delegateToRole', ..., requestId }`，服务端 `_handleDelegateToRole` 成功后回传 `{ type: 'delegateToRole_ok', agentId, targetRole }` — **未包含 requestId**。客户端 `case 'delegateToRole_ok'` 用 `msg.requestId` 查找 pending map，结果为 undefined，Promise 永不 resolve。

**修复**:

```js
// socket-server.js:409 — 错误响应
this._send(socket, { type: 'delegateToRole_error', error: `...`, requestId: msg.requestId });

// socket-server.js:421 — 成功响应
this._send(socket, { type: 'delegateToRole_ok', agentId: agent.id, targetRole, requestId: msg.requestId });
```

---

### 2. 三个适配器 execute() 方法无超时机制

**文件**:
- `claude-code.adapter.js:177-206`
- `codex.adapter.js:118-139`
- `gemini-cli.adapter.js:105-126`

**影响**: 如果 CLI 进程挂起，execute() 返回的 Promise 永不 resolve/reject，调用方永久阻塞

**对比**: `spawn()` 方法都有 `this.timeoutMs` + `setTimeout` + `proc.kill('SIGTERM')` 的超时机制，但 `execute()` 完全缺失。

**修复方案** (以 ClaudeCodeAdapter 为例):

```js
async execute(task) {
  const args = this._buildArgs({ task });
  return new Promise((resolve, reject) => {
    const proc = spawn(this.execPath, args, { ... });
    // ... 现有代码 ...

    // 新增：超时机制
    const timer = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch {}
      reject(new Error(`execute() timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);
    timer.unref();

    proc.on('close', (code) => {
      clearTimeout(timer);
      // ... 现有 resolve 逻辑 ...
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}
```

---

### 3. LineDelimitedJsonParser 不处理跨 chunk 行分割

**文件**: `src/main/parsers/line-delimited-json.parser.js:13-35`

**影响**: 流式场景下，如果一个 JSON 行被分割到两个 chunk，第二段会被当作独立行解析失败，静默丢失数据。

**对比**: `ClaudeCodeStreamParser` 正确实现了 `_buffer` 累积 + `\n` 分割。

**修复**: 添加 buffer 累积逻辑，与 ClaudeCodeStreamParser 一致。

---

## 🟡 P2 — 安全 / 可靠性

### 4. shell: true 命令注入风险

**文件**:
- `generic-cli.adapter.js:47,109` — `spawn(this.execPath, args, { shell: true })`
- `gemini-cli.adapter.js:53,113` — 同上

**风险**: 如果 `execPath` 或 `task.description` 包含 shell 元字符（`;`, `|`, `` ` ``, `$(...)`），可导致命令注入。

**建议**: 移除 `shell: true`（如需 PATH 查找，用 `which` 预验证后传绝对路径）。

---

### 5. AdapterRegistryService._extractTarball() 命令注入

**文件**: `src/main/adapter-registry-service.js:488`

```js
execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' });
```

**风险**: `destDir` 由包名 `name` 拼接，若包名含 `"` 或 `$()` 可逃逸引号。

**建议**: 用 `execFileSync('tar', [...args])` 替代 `execSync(template string)`。

---

### 6. AdapterRegistry.loadFromConfigs() 路径遍历

**文件**: `src/main/adapter-registry.js:235`

```js
const AdapterClass = require(cfg.classPath);
```

**风险**: `classPath` 来自用户配置（JSON/YAML），未做路径校验。攻击者可通过 `../../etc/passwd` 等路径加载任意文件。

**建议**: 限制 `classPath` 必须在 `adaptersDir` 下，或使用白名单。

---

## 🟢 P3 — 改进建议

### 7. SharedContextRepository.set() TOCTOU 竞态

**文件**: `src/main/repositories/shared-context.repository.js:64-82`

`set()` 先 `get` 检查 existing 再 `upsert`，两步非原子。并发写同一 key 时可能丢失更新。

**现状**: SQLite 的 `ON CONFLICT DO UPDATE` 本身是原子的，实际风险较低。但如果需要 `id` 稳定（现有逻辑如此），可以用事务包裹。

---

### 8. SocketBusServer 消息缓冲区无累积限制

**文件**: `src/main/message-bus/socket-server.js:158`

当前检查 `state.buffer.length > MAX_FRAME_BYTES * 2`（2MB）只防止单次超大消息。但客户端持续发送小消息但处理速度跟不上时，缓冲区可无限增长。

**建议**: 添加 `MAX_BUFFERED_MESSAGES` 计数器或定期检查队列深度。

---

## 审查范围覆盖

| 检查项 | 状态 | 发现 |
|--------|------|------|
| 适配器文件 bug | ✅ | P1#2 execute 无超时, P1#3 parser 数据丢失 |
| 错误处理完整性 | ✅ | spawn() 好，execute() 缺超时 |
| 资源泄漏 | ✅ | timer.unref() + close 清理，无泄漏 |
| adapter-registry 动态加载安全 | ⚠️ | P2#6 路径遍历 |
| shared-context 并发写入 | ⚠️ | P3#7 TOCTOU，实际风险低 |
| message-bus socket 连接管理 | ✅ | 正常，P1#1 为协议 bug 非连接管理 |
| 空输入/超长输入 | ✅ | 各层有校验 |
| 并发请求/竞态条件 | ⚠️ | P3#7, P3#8 |
| 大量消息性能 | ✅ | priority queue O(log n) 插入，back-pressure 机制完善 |

## 测试结果

```
 Test Files  54 passed (54)
      Tests  1263 passed (1263)
   Duration  3.52s
```

无回归。
