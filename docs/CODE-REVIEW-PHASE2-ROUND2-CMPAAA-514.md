# 代码审查报告 — Phase 2 Round 2 (CMPAAA-514)

**审查日期**: 2026-05-29
**审查范围**: Phase 2 Round 2 新增 E2E 测试及 harness 文件（8 个文件）
**审查人**: Code Reviewer

---

## 审查文件清单

| # | 文件 | 类型 | 评分 |
|---|------|------|------|
| 1 | `tests/e2e/group-chat-harness.html` | Harness | ★★★★☆ 4/5 |
| 2 | `tests/e2e/group-chat.spec.js` | E2E Test | ★★★★☆ 4/5 |
| 3 | `tests/e2e/messagebus-priority-harness.html` | Harness | ★★★★★ 5/5 |
| 4 | `tests/e2e/messagebus-priority.spec.js` | E2E Test | ★★★★★ 5/5 |
| 5 | `tests/e2e/squad-loadbalance-harness.html` | Harness | ★★★★★ 5/5 |
| 6 | `tests/e2e/squad-loadbalance.spec.js` | E2E Test | ★★★★☆ 4/5 |
| 7 | `tests/e2e/squad-wildcard-harness.html` | Harness | ★★★★☆ 4/5 |
| 8 | `tests/e2e/squad-wildcard.spec.js` | E2E Test | ★★★★★ 5/5 |

**整体评分: ★★★★☆ 4.25/5**

---

## 逐文件审查

### 1. `group-chat-harness.html` — ★★★★☆

**代码风格** ✅
- BEM 命名规范一致（`.chat-session__title`, `.chat-participant__dot--speaking`）
- HTML 结构清晰，语义化合理
- 内联 `<style>` 长度适中（35 行），对 harness 文件可接受

**错误处理** ⚠️
- 模态框 backdrop 点击通过 `e.target === modal` 判断，正确
- 表单验证逻辑存在但较简单，无边界输入防护

**性能** ✅
- 无明显泄漏风险
- 事件委托用于 send 按钮（`document.addEventListener('click', ...)`），正确

**问题发现**:

| 严重度 | 位置 | 描述 |
|--------|------|------|
| 🔴 HIGH | L197-205 | **XSS 注入** — `title` 和 `names` 直接插入 `innerHTML`，用户输入未经转义。虽然是测试 harness，但应养成安全编码习惯。 |
| 🟡 MED | L220 | **XSS 注入** — `text`（用户消息）直接拼入 `innerHTML`，同上。 |
| 🟢 LOW | L177 | 模态框 backdrop 关闭使用 `e.target === modal`，若 modal 内部有 padding 可能误触。 |

### 2. `group-chat.spec.js` — ★★★★☆

**代码风格** ✅
- `describe` 分组合理：Page Structure → Session List → Participants → Messages → Create Modal → Session Controls
- 测试命名清晰，遵循 "should ..." 模式
- 辅助函数 `harness()` 简洁

**错误处理** ✅
- Playwright 的 `expect()` 内建超时和重试，无需额外处理

**性能** ✅
- 每个 test 独立 `goto`，无状态泄漏

**问题发现**:

| 严重度 | 位置 | 描述 |
|--------|------|------|
| 🟡 MED | L176 | **Backdrop 点击脆弱** — `modal.click({ position: { x: 50, y: 300 } })` 使用固定坐标，依赖 CSS 尺寸。若 modal 高度 < 300px 则点击到内容区而非 backdrop。原值 `(5,5)` 被改为 `(50,300)` 说明原始坐标已经失败过一次。 |
| 🟢 LOW | L81 | 正则 `/群聊.*已创建/` 匹配中文，若 i18n 会失败。Harness 硬编码中文，当前安全。 |

### 3. `messagebus-priority-harness.html` — ★★★★★

**代码风格** ✅
- 变量命名语义化：`PRIORITY_ORDER`, `MAX_QUEUE`, `deliveryOrder`
- 二分查找插入实现简洁正确（L205-212）
- CSS BEM 一致

**错误处理** ✅
- `enqueueByPriority` 在队列满时正确处理淘汰逻辑
- `publishMessage` 校验 priority 合法性

**性能** ✅
- 二分插入 O(log n)，正确
- `renderQueue()` 每次全量重建 DOM，队列最大 10 条，无性能问题

**可测试性** ✅
- 函数粒度好：`updateStats`, `renderQueue`, `enqueueByPriority`, `publishMessage` 各司其职
- 数据驱动，易于扩展

### 4. `messagebus-priority.spec.js` — ★★★★★

**代码风格** ✅
- 8 个 describe 块覆盖完整：Page Structure → Queue Stats → Publish → Priority Ordering → Queue Overflow → Dispatch → Clear → Validation
- 测试命名精确

**错误处理** ✅
- 无异常场景遗漏

**可测试性** ✅
- 测试独立性好，每个 test 从 `goto` 开始
- 断言丰富：`toHaveClass`, `toHaveText`, `toContainText`, `toBeVisible`

**问题发现**: 无。

### 5. `squad-loadbalance-harness.html` — ★★★★★

**代码风格** ✅
- 常量 `THRESHOLD` 全局定义，语义清晰
- `selectAgent` 策略分支逻辑简洁
- `updateAgentCard` 更新 DOM 的粒度恰当

**错误处理** ✅
- `selectAgent` 在无候选 agent 时返回 `null`
- `updateAgentCard` 有 `if (!card) return` 空值保护

**性能** ✅
- `getAgents()` 和 `getUnassignedTasks()` 每次调用重新查询 DOM，但数据量小（4 agents, 5 tasks），无问题

**可测试性** ✅
- 三种策略（lowest-workload, round-robin, role-first）通过 `strategy` 变量切换，测试友好

### 6. `squad-loadbalance.spec.js` — ★★★★☆

**代码风格** ✅
- describe 分组覆盖：Page Structure → Agent Pool → Task Queue → Strategy Selection → Auto-Assign → Role-First Strategy → Reset
- 测试粒度适中

**问题发现**:

| 严重度 | 位置 | 描述 |
|--------|------|------|
| 🟡 MED | L146-147 | **断言不够精确** — `expect(agent1Workload).toBeGreaterThanOrEqual(agent2Workload - 1)` 允许 agent-1 比 agent-2 少 1 个任务，但理论上 agent-1（初始 workload=0）应严格 >= agent-2（初始 workload=1）。可能是容忍浮点/排序抖动，但应加注释说明。 |
| 🟢 LOW | L156 | `expect(after).not.toBe(before)` 断言较弱 — 只验证变化，不验证方向（增加）。 |

### 7. `squad-wildcard-harness.html` — ★★★★☆

**代码风格** ✅
- `topicMatches` 递归实现 wildcard 匹配，逻辑正确
- BEM 命名一致

**错误处理** ⚠️
- `resolveWildcardAgent` 无显式错误处理，`null` 返回值由调用方 `resolveAll` 正确处理

**性能** ⚠️

| 严重度 | 位置 | 描述 |
|--------|------|------|
| 🟡 MED | L256-260 | **递归回溯** — `topicMatches` 对 `**` 使用递归 + 循环，时间复杂度 O(n^k)（n=段数, k=通配符数）。当前测试用例深度浅（最多 4 段），无实际问题。但缺少注释说明复杂度边界。 |
| 🟢 LOW | L208 | `excludeIds` 使用 `Set` 硬编码排除 `agent-1`，若需扩展应参数化。 |

### 8. `squad-wildcard.spec.js` — ★★★★★

**代码风格** ✅
- 5 个 describe 块：Page Structure → Squad Configuration → Agent Registry → Wildcard Resolution → Topic Wildcard Matching
- 测试覆盖全面

**可测试性** ✅
- wildcard resolution 测试验证：匹配、排除显式成员、偏好低负载、跳过过载、去重
- topic matching 测试覆盖：单段通配、多段通配、精确匹配、不匹配、预定义批量测试

**问题发现**: 无。

---

## 跨文件共性问题

### 1. 🔴 XSS 风险（group-chat-harness.html）

**严重度**: HIGH
**位置**: `group-chat-harness.html:197-205, 220`
**描述**: 用户输入（chat title, participant names, message text）直接拼接进 `innerHTML`，存在 XSS 注入风险。
**影响**: 测试环境中影响有限，但作为模式会被复制到生产代码。
**建议**: 使用 `textContent` 或对 HTML 特殊字符转义。

### 2. 🟡 背景点击坐标硬编码（group-chat.spec.js）

**严重度**: MED
**位置**: `group-chat.spec.js:176`
**描述**: `modal.click({ position: { x: 50, y: 300 } })` 依赖 modal 的 CSS 尺寸。不同分辨率/缩放下可能失效。
**建议**: 改用 `modal.locator('.modal__header').click()` 点击明确的非内容区域，或使用 `page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })` 对 overlay 本身点击。

### 3. 🟡 断言精确度不足（squad-loadbalance.spec.js）

**严重度**: MED
**位置**: `squad-loadbalance.spec.js:146-147, 156`
**描述**: 部分断言过于宽松，可能掩盖回归问题。
**建议**: 加强断言或添加注释说明容忍范围。

### 4. 🟢 常量重复定义

**严重度**: LOW
**位置**: `squad-wildcard-harness.html:174`, `squad-loadbalance-harness.html:139`
**描述**: `THRESHOLD = 3` 在两个 harness 中独立定义。当前无问题，但若需调整阈值需同步修改。
**建议**: 可抽取为共享常量文件（低优先级，harness 文件通常是独立的）。

---

## 验收标准完成情况

- [x] 每个文件给出 review 评分（见上方表格）
- [x] 严重问题创建子 issue（见下方）

## 子 Issue

需创建 1 个子 issue 处理 XSS 风险：

| Issue | 严重度 | 文件 | 描述 |
|-------|--------|------|------|
| CMPAAA-613 | 🔴 HIGH | group-chat-harness.html | 修复 innerHTML XSS 注入：title/names/message 应使用 textContent 或 HTML 转义 |

---

## 总结

Phase 2 Round 2 的代码整体质量良好。8 个文件覆盖 4 个功能模块（Group Chat、MessageBus Priority、Squad Load Balancing、Squad Dynamic Discovery），测试覆盖面广，harness 文件结构清晰。

主要改进点：
1. **XSS 修复**（group-chat-harness.html）— 将 innerHTML 替换为安全的 DOM 操作
2. **Backdrop 点击稳定性**（group-chat.spec.js）— 避免硬编码坐标

其余为低优先级风格/健壮性改进，不影响当前功能正确性。
