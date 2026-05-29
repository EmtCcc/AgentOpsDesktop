# Security Audit — Phase 2 Round 2

**审计日期**: 2026-05-30
**审计范围**: CMPAAA-539 ~ CMPAAA-543 (5 个功能)
**审计人**: Security Engineer

---

## 总览

| 功能 | 安全评分 | Critical | High | Medium | Low |
|------|---------|----------|------|--------|-----|
| CMPAAA-539 Group Chat | 7/10 | 0 | 0 | 2 | 1 |
| CMPAAA-540 Symlink Escape | 8/10 | 0 | 0 | 2 | 0 |
| CMPAAA-541 Squad Load Balancing | 8/10 | 0 | 0 | 0 | 1 |
| CMPAAA-542 MessageBus Priority | 8/10 | 0 | 0 | 1 | 0 |
| CMPAAA-543 Squad Dynamic Discovery | 8/10 | 0 | 0 | 0 | 1 |

---

## 1. CMPAAA-539 Group Chat — 评分 7/10

### ✅ 合格项

- **SQL 注入防护**: ChatRepository 使用 better-sqlite3 预编译语句，全部参数化查询
- **输入校验**: IPC schema 对 `title`(minLength/maxLength)、`agentIds`(required array)、`strategyType`(enum) 有校验
- **IPC 认证**: 所有 `chat:*` 路由均要求 auth + `orchestrator:*` 权限
- **Session 生命周期**: 有状态机校验防止非法状态转换
- **Agent 存在性校验**: createSession 时校验 agentId 对应的 agent 是否存在

### ⚠️ MEDIUM-01: 消息内容无长度限制

**位置**: `src/main/ipc/controllers/chat.controller.js:175`
```js
content: { type: 'string', required: true, minLength: 1 },
// 缺少 maxLength
```

**风险**: 攻击者可发送超大消息，导致数据库膨胀、UI 渲染卡顿。
**建议**: 添加 `maxLength: 100000`（或合理上限）。

### ⚠️ MEDIUM-02: agentIds 数组元素未校验类型

**位置**: `src/main/ipc/controllers/chat.controller.js:138`
```js
agentIds: { type: 'array', required: true },
// 缺少 items schema
```

**风险**: 传入 `[123, null, {}]` 等非字符串元素会绕过类型检查，导致后续 `agentRepo.getById()` 行为异常。
**建议**: 添加 `items: { type: 'string' }`。

### ℹ️ LOW-01: strategyConfig 无 schema 校验

**位置**: `chatController.schemas.create.strategyConfig`

**风险**: 可传入任意嵌套对象，虽然存储安全，但可能包含意外字段影响引擎行为。
**建议**: 定义 strategyConfig 的具体 schema 或限制深度。

---

## 2. CMPAAA-540 Symlink Escape — 评分 8/10

### ✅ 合格项

- **路径穿越防护**: `resolveSafe()` 使用 `path.resolve` + `startsWith` 双重检查
- **Symlink 逃逸检测**: `lstatSync` → `realpathSync` 链式检查，确保符号链接目标在 workspace 内
- **所有文件操作经过 resolveSafe**: readFile、writeFile、deleteFile、listFiles 均调用
- **文件大小限制**: `_enforceSize` 检查写入前的大小
- **读写锁**: 文件操作有锁保护（但有实现问题，见 LOW-02）

### ⚠️ MEDIUM-03: createForTask 的 injectFiles 源路径无边界校验

**位置**: `src/main/workspace-manager.js:438-446`
```js
const srcFile = path.resolve(projectRoot, relPath);
// projectRoot 无校验 — 可指向任意目录
```

**风险**: 若 `projectRoot` 被设为 `/etc`、`~/.ssh` 等敏感目录，injectFiles 可将系统敏感文件复制到 workspace。虽然这是内部 API，但缺少纵深防御。
**建议**: 添加 `projectRoot` 白名单校验（必须在项目目录内），或至少记录审计日志。

### ⚠️ MEDIUM-04: _injectProjectTree 跟随符号链接

**位置**: `src/main/workspace-manager.js:486`
```js
fs.copyFileSync(srcPath, destPath);
```

**风险**: 若 src 目录中存在指向 workspace 外的符号链接，`copyFileSync` 会跟随链接复制外部文件。虽然 `resolveSafe` 保护了目标路径，但源路径复制未做 symlink 检查。
**建议**: 在 `_injectProjectTree` 的 walk 中添加 `lstat` 检查，跳过符号链接或验证其目标。

### ✅ 防御纵深良好

- `cleanup()` 使用 `fs.rmSync` 配合 `recursive: true, force: true` 安全删除
- `rollback()` 先删后建，有写锁保护
- `_copyRecursive` 不跟随符号链接（使用 `readdirSync` with `withFileTypes`）

---

## 3. CMPAAA-541 Squad Load Balancing — 评分 8/10

### ✅ 合格项

- **参数化查询**: 全部使用 better-sqlite3 prepared statements
- **RBAC**: squad 路由有正确的权限控制（`squads:list/get/update`）
- **workload 计算**: `getMemberWorkloads` 从 agentRepo 获取真实负载数据
- **过载检查**: `isAgentOverloaded` 使用可配置阈值，默认 3

### ℹ️ LOW-03: addMember 未校验 agent 存在性（HTTP 路由）

**位置**: `src/main/api/routes/squads.js:138-148`
```js
squads.post('/:id/members', validateRequest({ body: memberBodySchema }), async (c) => {
  // 缺少 agentRepo.getById(body.agentId) 校验
  const member = repo.addMember(squadId, body.agentId, body.role || 'member');
```

**风险**: 可添加不存在的 agentId 到 squad。IPC 路由有校验（`squadController.addMember`），但 HTTP API 路由缺少。
**建议**: 在 HTTP 路由中添加 agent 存在性校验，或统一走 controller 层。

---

## 4. CMPAAA-542 MessageBus Priority — 评分 8/10

### ✅ 合格项

- **Topic 校验**: 长度限制 (256)、深度限制 (5)、空段检查
- **类型校验**: message type 限定为 `request/response/event/heartbeat`
- **优先级校验**: 限定为 `critical/high/normal/low`
- **队列上限**: `maxQueueSize` 默认 1000，溢出时驱逐最低优先级
- **超时保护**: request/reply 有默认 5s 超时
- **优雅关闭**: `close()` 清理所有 pending timer 和队列

### ⚠️ MEDIUM-05: 消息 payload 无大小限制

**位置**: `src/main/message-bus/message-bus.js:125-151`
```js
publish(topic, type, payload, meta = {}) {
  // payload 可以是任意大小的对象
```

**风险**: 发送超大 payload 可导致内存耗尽（队列中积压大量大消息）。
**建议**: 对 payload 做 JSON.stringify 后的大小检查，或设置单消息最大字节数。

---

## 5. CMPAAA-543 Squad Dynamic Discovery — 评分 8/10

### ✅ 合格项

- **Wildcard 解析**: `resolveWildcardAgent` 正确过滤已分配 agent 和过载 agent
- **负载排序**: 按 workload 升序选择（最空闲优先）
- **Roster 展开**: `expandRoster` 处理了 wildcard 无法解析的情况（`resolved: false`）
- **RBAC**: 读操作要求 `squads:get`，写操作要求 `squads:update`

### ℹ️ LOW-04: expandRoster 未处理 agent 被删除的边界情况

**位置**: `src/main/repositories/squad.repository.js:282-301`

**风险**: 若 squad 成员中有一个 agentId 对应的 agent 已被删除，`expandRoster` 返回的 roster 中该条目 `resolved: true` 但 agent 实际不存在。调用方若不二次校验可能导致空指针。
**建议**: 在 expandRoster 中对非 wildcard 成员也做 agentRepo.getById 校验。

---

## 依赖安全

**npm audit 结果**: ✅ 0 vulnerabilities（官方 registry 扫描通过）

注意: 项目使用的 npmmirror 镜像不支持 audit API，已切换至官方 registry 完成扫描。

---

## 检查清单总结

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 输入验证 | ⚠️ 大部分良好，2 处缺少长度/类型约束 |
| 2 | 权限控制 | ✅ IPC 全部 auth + RBAC，HTTP 路由有 auth |
| 3 | 注入风险 | ✅ SQL 全部参数化，路径有 resolveSafe 保护 |
| 4 | 依赖安全 | ✅ 0 vulnerabilities |

---

## 需创建子 Issue 的问题

### MEDIUM-01: 消息内容无长度限制
- 严重度: Medium
- 文件: `src/main/ipc/controllers/chat.controller.js`
- 修复: 添加 `maxLength` 到 content schema

### MEDIUM-03: createForTask 源路径无边界校验
- 严重度: Medium
- 文件: `src/main/workspace-manager.js`
- 修复: 校验 projectRoot 必须在允许的目录范围内

### MEDIUM-04: _injectProjectTree 跟随符号链接
- 严重度: Medium
- 文件: `src/main/workspace-manager.js`
- 修复: 复制前检查源文件是否为符号链接
