# 代码审查报告 — CMPAAA-595

**审查日期**: 2026-05-29
**审查范围**: Round 2 新增代码（CMPAAA-539 ~ CMPAAA-543）
**审查人**: Code Reviewer Agent

---

## 总览

| # | 文件 | 评分 | 严重问题 |
|---|------|------|----------|
| 1 | `tests/e2e/messagebus-priority.spec.js` | A (9/10) | 0 |
| 2 | `tests/e2e/messagebus-priority-harness.html` | B+ (8/10) | 1 |
| 3 | `tests/e2e/squad-wildcard.spec.js` | A (9/10) | 0 |
| 4 | `tests/e2e/squad-wildcard-harness.html` | B (7.5/10) | 2 |
| 5 | `tests/e2e/group-chat.spec.js` | A (9/10) | 0 |
| 6 | `tests/e2e/group-chat-harness.html` | B (7.5/10) | 2 |
| 7 | `tests/e2e/squad-loadbalance.spec.js` | A (9/10) | 0 |
| 8 | `tests/e2e/squad-loadbalance-harness.html` | A- (8.5/10) | 0 |
| 9 | `tests/e2e/symlink-security.spec.js` | A (9.5/10) | 0 |
| 10 | `tests/e2e/symlink-security-harness.html` | A- (8.5/10) | 0 |
| 11 | `tests/round2-regression.test.js` | B+ (8/10) | 1 |

**综合评分**: A- (8.5/10)

---

## 逐文件审查

### 1. `tests/e2e/messagebus-priority.spec.js` — **A (9/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 命名规范，test.describe 分组清晰，BEM 命名一致 |
| 错误处理 | ✅ Playwright 内置等待机制，无裸 catch |
| 安全性 | ✅ 纯测试文件，无安全风险 |
| 性能 | ⚠️ 每个 test 重复 `page.goto` + `waitForLoadState`，可提取 beforeEach |
| 可测试性 | ✅ 每个测试独立，无状态依赖 |
| 文档 | ✅ test.describe 分组即文档 |

**建议**: L41-98 的 Queue Stats 和 Publish Messages 段中每个 test 都重复导航，建议共享 beforeEach 提升可读性。

---

### 2. `tests/e2e/messagebus-priority-harness.html` — **B+ (8/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ CSS BEM 命名一致，语义化 class 名 |
| 错误处理 | ⚠️ `enqueueByPriority` 无输入校验（priority 为 undefined 时 fallback 到 2） |
| 安全性 | ⚠️ **XSS**: L183 `${msg.topic}`, L186 `${msg.payload}` 通过 innerHTML 注入，未转义 |
| 性能 | ✅ 二分插入（L205-213）高效 |
| 可测试性 | ✅ data-testid 和 ID 选择器完备 |
| 文档 | ✅ Valid priorities 信息栏清晰 |

**严重问题**:
- **[中] innerHTML XSS** — `renderQueue()` 中 `msg.topic` 和 `msg.payload` 直接拼入 innerHTML。测试 harness 环境风险低，但若 payload 包含 `<script>` 可导致测试异常。建议使用 `textContent` 或转义。

---

### 3. `tests/e2e/squad-wildcard.spec.js` — **A (9/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 清晰的 describe 分组，测试意图明确 |
| 错误处理 | ✅ 无异常 |
| 安全性 | ✅ 纯测试 |
| 性能 | ✅ 合理 |
| 可测试性 | ✅ 覆盖全面：wildcard 解析、topic 匹配、预定义测试 |
| 文档 | ✅ 注释清晰 |

**亮点**: Topic Wildcard Matching 测试覆盖了 `*`, `**`, exact match, no-match 等场景，非常全面。

---

### 4. `tests/e2e/squad-wildcard-harness.html` — **B (7.5/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 结构清晰 |
| 错误处理 | ⚠️ `resolveWildcardAgent` 返回 null 时 UI 处理正确 |
| 安全性 | ⚠️ **XSS**: L278 `${sub}`, `${msg}` 通过 innerHTML 注入 |
| 安全性 | ⚠️ **ReDoS 风险**: `topicMatches()` L256-261 递归+嵌套循环，恶意 `**` 模式可指数爆炸 |
| 性能 | ⚠️ `topicMatches` 递归实现复杂度 O(n^k)，k 为 `**` 数量 |
| 可测试性 | ✅ data 属性完备 |
| 文档 | ⚠️ `topicMatches` 算法缺少注释说明递归策略 |

**严重问题**:
- **[中] innerHTML XSS** — `btn-test-topic` 事件处理中用户输入直接拼入 innerHTML。
- **[低] topicMatches 递归复杂度** — 多个 `**` 段时递归深度指数增长。测试数据规模小无实际风险，但算法可优化为 DP。

---

### 5. `tests/e2e/group-chat.spec.js` — **A (9/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 优秀的分组结构：Structure → Session List → Participants → Messages → Modal → Controls |
| 错误处理 | ✅ 覆盖了 empty message 不发送的边界 |
| 安全性 | ✅ 纯测试 |
| 性能 | ✅ 合理 |
| 可测试性 | ✅ 覆盖全面，含 accessibility 测试（role="dialog", aria-label） |
| 文档 | ✅ |

**亮点**: 包含 accessibility 断言（aria-label, role="dialog"），这是最佳实践。

---

### 6. `tests/e2e/group-chat-harness.html` — **B (7.5/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ BEM 命名一致 |
| 错误处理 | ✅ 表单验证逻辑完整 |
| 安全性 | 🔴 **XSS**: L199 `${title}`, L202 `${names}` 通过 innerHTML 注入，用户可控输入 |
| 性能 | ✅ 合理 |
| 可测试性 | ✅ 完备的 data-testid |
| 文档 | ✅ |

**严重问题**:
- **[高] innerHTML XSS** — `modal-create-btn` 点击处理器中，`${title}` 和 `${names}` 直接拼入 innerHTML（L197-205）。用户输入 `"><img src=x onerror=alert(1)>` 即可触发。虽然为测试 harness，但模式不佳，可能被复制到生产代码。

---

### 7. `tests/e2e/squad-loadbalance.spec.js` — **A (9/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 优秀的分组：Structure → Agent Pool → Task Queue → Strategy → Auto-Assign → Role-First → Reset |
| 错误处理 | ✅ |
| 安全性 | ✅ |
| 性能 | ✅ |
| 可测试性 | ✅ 覆盖了 3 种策略、重置、负载均衡核心逻辑 |
| 文档 | ✅ |

**亮点**: 测试覆盖了 lowest-workload、round-robin、role-first 三种策略的完整行为。

---

### 8. `tests/e2e/squad-loadbalance-harness.html` — **A- (8.5/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 结构清晰 |
| 错误处理 | ✅ |
| 安全性 | ✅ 无 innerHTML 注入风险（全部操作 textContent/classList） |
| 性能 | ✅ |
| 可测试性 | ✅ |
| 文档 | ✅ |

**亮点**: 所有 DOM 更新使用 `textContent` 而非 `innerHTML`，是所有 harness 中最安全的实现。

---

### 9. `tests/e2e/symlink-security.spec.js` — **A (9.5/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 完美 |
| 错误处理 | ✅ |
| 安全性 | ✅ 测试本身即安全测试 |
| 性能 | ✅ |
| 可测试性 | ✅ 覆盖：路径遍历、symlink 逃逸、安全 symlink、空路径、null-byte |
| 文档 | ✅ |

**亮点**: 最全面的安全测试 — 覆盖了 path traversal、symlink escape、safe symlink、null byte 等场景。评分最高。

---

### 10. `tests/e2e/symlink-security-harness.html` — **A- (8.5/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ |
| 错误处理 | ✅ |
| 安全性 | ✅ |
| 性能 | ✅ |
| 可测试性 | ✅ data-test 属性完备 |
| 文档 | ✅ |

---

### 11. `tests/round2-regression.test.js` — **B+ (8/10)**

| 维度 | 评价 |
|------|------|
| 代码风格 | ✅ 清晰的区块分隔（═══ 注释头），命名规范 |
| 错误处理 | ✅ beforeEach/afterEach 正确管理 DB 生命周期 |
| 安全性 | ✅ |
| 性能 | ✅ in-memory DB，无 I/O 瓶颈 |
| 可测试性 | ⚠️ GroupChatEngine 测试通过 `fs.readFileSync` 检查源码字符串，非真实行为测试 |
| 文档 | ✅ 每个区块有 CMPAAA 编号注释 |

**严重问题**:
- **[中] 字符串匹配测试** — CMPAAA-539 GroupChatEngine 测试（L162-203）使用 `fs.readFileSync` + `expect(code).toContain()` 验证功能。这类测试只验证源码包含特定字符串，不验证运行时行为。若方法被重命名、重构或 dead code 化，测试仍可能通过。建议补充真实的行为测试。

**亮点**:
- CMPAAA-540 Symlink 测试非常扎实：覆盖了正向/负向/链式 symlink/目录 symlink 等边界。
- CMPAAA-542 MessageBus 优先级测试使用 `throwOnce` 模式模拟慢消费者，巧妙验证优先级排序。
- Helper 函数（createTestDb, createAgent, createGoal, createTask）设计良好，可复用。

---

## 问题汇总

### 需要修复的问题

| # | 严重度 | 文件 | 行号 | 问题 | 建议 |
|---|--------|------|------|------|------|
| 1 | 🔴 高 | group-chat-harness.html | 197-205 | innerHTML XSS：用户输入 title/names 直接拼入 DOM | 使用 textContent 或 escapeHtml() |
| 2 | 🟡 中 | messagebus-priority-harness.html | 183, 186 | innerHTML XSS：msg.topic/payload 未转义 | 同上 |
| 3 | 🟡 中 | squad-wildcard-harness.html | 278 | innerHTML XSS：sub/msg 未转义 | 同上 |
| 4 | 🟡 中 | round2-regression.test.js | 162-203 | 字符串匹配代替行为测试 | 补充运行时行为测试 |
| 5 | 🟢 低 | squad-wildcard-harness.html | 248-266 | topicMatches 递归复杂度 O(n^k) | 优化为 DP 或添加深度限制 |
| 6 | 🟢 低 | messagebus-priority.spec.js | 全文 | 每个 test 重复 goto+waitForLoadState | 提取 beforeEach |

### 优秀实践（值得推广）

1. **symlink-security.spec.js** — 安全测试覆盖面最全，是安全测试的模板
2. **squad-loadbalance-harness.html** — 全部使用 textContent，零 XSS 风险
3. **group-chat.spec.js** — 包含 accessibility 断言（aria-label, role）
4. **round2-regression.test.js** — CMPAAA-540 symlink 测试用链式 symlink 验证深度逃逸

---

## 结论

Round 2 代码整体质量 **优良**。测试覆盖面广，命名规范，结构清晰。主要风险集中在测试 harness HTML 中的 innerHTML XSS 模式 — 虽然在测试环境中不构成真实威胁，但该模式若被复制到生产代码将导致严重安全漏洞。建议统一采用 `textContent` + DOM API 替代 innerHTML 拼接。
