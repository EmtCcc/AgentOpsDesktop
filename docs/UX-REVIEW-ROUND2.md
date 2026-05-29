# UX 审查报告：Round 2 全部五项新功能用户视角体验审查

> 版本：v2.0 | 作者：Customer Success Manager | 日期：2026-05-30
> 关联 Issue：CMPAAA-605
> 前版：v1.0 (CMPAAA-599, 仅覆盖 Group Chat + Squad)

---

## 审查概要

对 Round 2 交付的全部五项功能进行用户体验审查：
1. Group Chat 前端暴露 (CMPAAA-539)
2. Symlink 逃逸修复 (CMPAAA-540)
3. Squad 负载均衡 (CMPAAA-541)
4. MessageBus 消息优先级 (CMPAAA-542)
5. Squad 动态 Member 发现 (CMPAAA-543)

审查维度：上手体验、错误体验、文档可用性、反馈渠道。基于源码静态分析、设计规格对照和启发式评估（Nielsen 10 Heuristics）。

---

## 功能评分总览

| # | 功能 | 上手体验 | 错误体验 | 文档可用性 | 反馈渠道 | 综合分 |
|---|------|---------|---------|-----------|---------|--------|
| 1 | Group Chat 前端暴露 (CMPAAA-539) | 4 | 3 | 2 | 3 | **3.0** |
| 2 | Symlink 逃逸修复 (CMPAAA-540) | N/A | 2 | 1 | 2 | **1.7** |
| 3 | Squad 负载均衡 (CMPAAA-541) | 3 | 3 | 2 | 3 | **2.8** |
| 4 | MessageBus 消息优先级 (CMPAAA-542) | 2 | 3 | 1 | 2 | **2.0** |
| 5 | Squad 动态 Member 发现 (CMPAAA-543) | 2 | 2 | 1 | 2 | **1.8** |

**总体用户体验评分: 2.3/5**

---

## 1. Group Chat 交互

**可用性评分：3 / 5**

### 做得好的部分

- **三栏布局直觉清晰**：左侧会话列表 + 中间消息流 + 右侧参与者面板，符合即时通讯产品的用户心智模型
- **模态框有焦点陷阱**：`CreateChatModal`、`EditSessionModal`、`AddParticipantModal` 均实现了 `useFocusTrap`，支持 Escape 关闭和 Tab 循环
- **流式消息有视觉反馈**：正在流式接收的消息显示闪烁光标动画，用户能感知到 Agent 正在输出
- **Enter 发送 / Shift+Enter 换行**：符合主流聊天产品的键盘习惯
- **空状态引导**：未选择会话时显示 "Select a chat or create a new one"，会话列表为空时引导创建

### 可用性问题

| # | 问题 | 严重性 | 描述 |
|---|------|--------|------|
| GC-1 | **策略选项名不自解释** | 中 | "Round Robin" 和 "Human Assign" 是技术术语，普通用户无法从字面理解含义。缺乏策略说明或 tooltip |
| GC-2 | **Human Assign 策略未实现** | 高 | `group-chat-engine.js` 中 `_runNextTurn` 在 human-assign 模式下 fallback 到 round-robin，但 UI 仍显示该选项。用户选择后发现行为不一致，产生困惑 |
| GC-3 | **引擎错误对用户不可见** | 高 | `GroupChatPage.jsx:543` 中 `event.type === 'error'` 仅 `console.error`，用户在 UI 中看不到任何错误提示 |
| GC-4 | **参与者面板不可折叠** | 中 | 设计规格要求参与者面板可折叠（responsive drawer），但实现中固定 220px 宽度且无折叠控件，挤占对话区域 |
| GC-5 | **无加载状态指示** | 中 | 选择会话后 `loadSessionDetails` 异步加载消息和参与者，但主区域无 loading 指示器，用户可能误以为内容为空 |
| GC-6 | **角色含义不清晰** | 低 | 参与者面板显示 "expert"、"manager"、"observer" 角色标签，但未解释这些角色对发言权的影响 |
| GC-7 | **新建群聊最少 2 个 Agent 无说明** | 低 | "Participants * (min 2)" 标签写了，但提交按钮 disabled 时没有 tooltip 解释为什么不可点击 |
| GC-8 | **消息搜索/过滤未实现** | 中 | 设计规格和 UX 研究报告均将消息搜索列为 P1，但未实现。长对话中回溯困难 |
| GC-9 | **无 "正在输入" 指示器** | 低 | 设计规格包含 `TypingIndicator` 组件规格，但未实现。用户无法感知 Agent 是否在处理中（除流式输出外） |
| GC-10 | **Session 状态显示不一致** | 低 | 侧边栏显示 session.status（active/paused/completed），但头部按钮逻辑依赖 engineState.running，两者可能不同步 |

---

## 2. Squad 管理

**可用性评分：3 / 5**

### 做得好的部分

- **卡片式列表信息密度合理**：每张 Squad 卡片展示名称、描述、状态徽章、成员数、Leader、触发规则摘要
- **实时事件反馈**：Leader 重激活时显示旋转动画 + "Leader reactivating" 文案，成员完成时更新进度计数
- **状态颜色编码一致**：running=绿色、error=红色、idle=灰色，跨徽章和圆点保持一致
- **确认对话框保护危险操作**：删除 Squad 前有 `confirm()` 二次确认
- **空状态有引导**：无 Squad 时显示图标 + 说明 + 创建按钮

### 可用性问题

| # | 问题 | 严重性 | 描述 |
|---|------|--------|------|
| SQ-1 | **instructions 和 triggerRules 未传递到后端** | 高 | `SquadsPage.jsx:448` 的 `handleCreate` 只传递 `{ name, description, leaderId, members }`，modal 中收集的 `instructions` 和 `triggerRules` 被静默丢弃。用户填写了但不生效 |
| SQ-2 | **触发规则术语专业性过强** | 中 | "fail-fast"、"continue"、"pause"、"archive" 是开发者术语，缺乏对非技术用户的解释说明 |
| SQ-3 | **Leader 显示为 agentId 而非名称** | 中 | `SquadCard` 中 `leaderName = leaderMember ? leaderMember.agentId : 'None'`，显示的是 UUID 而非 Agent 名称 |
| SQ-4 | **Status 按钮信息呈现为 Toast** | 中 | 点击 Status 按钮后，聚合状态信息以 Toast 形式显示（4 秒自动消失），但状态信息较长，用户来不及阅读 |
| SQ-5 | **成员进度在页面重载后丢失** | 中 | `memberProgress` 存储在组件 state 中，页面刷新后进度归零。应从后端获取或持久化 |
| SQ-6 | **无 Squad 编辑功能** | 中 | 创建后无法修改 Squad 配置（名称、描述、成员、触发规则），只能删除重建 |
| SQ-7 | **错误信息暴露技术细节** | 低 | `handleStart` catch 块中 `showToast(\`Start failed: ${err.message}\`)` 可能向用户暴露 IPC 错误栈 |

---

## 3. Symlink 逃逸修复 (CMPAAA-540)

**可用性评分：1.7 / 5**

安全修复，用户不直接交互，但间接影响工作区文件操作体验。

### 错误体验 (2/5) ❌

- `workspace-manager.js:59` 抛出 `"Path escape denied: "${relPath}" resolves outside workspace"` — 纯技术语言
- `workspace-manager.js:72` 抛出 `"Symlink escape denied: "${relPath}" points to "${realTarget}" outside workspace"` — 包含文件路径暴露
- 错误直接 throw，无 catch 层的用户友好转换
- 没有建议性错误消息（如 "此链接指向工作区外的文件，请检查链接目标"）
- `lstatSync`/`realpathSync` 的 ENOENT 被静默吞掉（`workspace-manager.js:78`），写路径场景合理但无日志

### 文档可用性 (1/5) ❌

- getting-started.md 未提及工作区安全边界
- 无任何文档说明 symlink 限制或路径沙箱行为
- 用户遇到 "Symlink escape denied" 时无处查阅原因和解决方案

### 反馈渠道 (2/5) ❌

- 纯 `throw Error`，没有结构化错误码
- 无法区分用户操作错误 vs 系统配置问题 vs 恶意输入
- 无事件发射（如 `emit('security-violation', ...)`），审计日志不可追踪

---

## 4. MessageBus 消息优先级 (CMPAAA-542)

**可用性评分：2.0 / 5**

### 上手体验 (2/5) ❌

- 纯后端功能，**无任何前端 UI**
- 用户无法设置消息优先级（critical/high/normal/low）
- 用户无法查看队列中消息的优先级分布
- `PRIORITY_ORDER`（`message-bus.js:39`）对终端用户不可见
- `publish()` 接口的 `meta.priority` 参数无文档，开发者也不易发现

### 错误体验 (3/5) ⚠️

- 无效优先级抛出 `Invalid priority: ${priority}`（`message-bus.js:130`），消息清晰
- 队列满时低优先级消息被**静默丢弃**（`message-bus.js:402-403`），无日志、无事件、无通知
- 用户无法知道自己的消息是否被丢弃
- `close()` 时所有 pending request 被 reject 为 "MessageBus closed"，语义清晰

### 文档可用性 (1/5) ❌

- 无任何文档说明消息优先级系统
- API.md 未覆盖 `priority` 参数
- 用户不知道存在 critical/high/normal/low 四个级别
- 队列淘汰策略（低优先级被淘汰）未文档化

### 反馈渠道 (2/5) ❌

- `stats()` 方法（`message-bus.js:295`）可返回 `totalQueued`，但未暴露给前端
- 消息丢弃无事件通知，无 metrics 计数
- 无 `droppedMessages` 计数器

---

## 5. Squad 动态 Member 发现 (CMPAAA-543)

**可用性评分：1.8 / 5**

### 上手体验 (2/5) ❌

- 纯后端功能，**无前端 UI 配置通配符成员**
- 用户不知道可以使用 `agent_id='*'` 来创建通配符成员
- `expandRoster()` 的 resolved/unresolved 结果未展示给用户
- SquadCard 只显示 member 数量（`SquadsPage.jsx:115`），不区分具体成员和通配符
- `resolveWildcardAgent()`（`squad.repository.js:251`）的角色匹配逻辑（ownerRole）对用户不透明

### 错误体验 (2/5) ❌

- 当没有可用 agent 匹配通配符角色时，`resolved: false` 静默标记（`squad.repository.js:296`）
- 用户看到的是 "roster 中有一个未解析的通配符"，但不知道原因
- 没有 "没有空闲的 engineer 角色 agent 可用" 这样的诊断信息
- `isAgentOverloaded()` 返回 boolean 但无原因说明（哪个阈值、当前负载多少）

### 文档可用性 (1/5) ❌

- 无任何用户文档说明通配符成员配置
- `'*'` 作为 agent_id 的约定未文档化
- 角色匹配逻辑（ownerRole 匹配）未说明
- `DEFAULT_TRIGGER_RULES.overload_threshold = 3` 的默认值和配置方式未文档化

### 反馈渠道 (2/5) ❌

- 未解析的通配符在 roster 中标记为 `{ agentId: '*', resolved: false }`
- 但这个信息未传递到前端展示
- 无 "wildcard resolution failed" 事件

---

## 6. 错误反馈（跨功能）

**可用性评分：2 / 5**

这是五个维度中得分最低的。

### 当前错误处理模式

| 模式 | 使用场景 | 用户可见性 |
|------|---------|-----------|
| Toast 通知 | Squad 操作成功/失败 | 可见，但 4s 自动消失 |
| `console.error` | Group Chat 加载/引擎错误 | 不可见 |
| `confirm()` 对话框 | 删除操作确认 | 可见 |
| 系统消息气泡 | Agent 执行出错 | 可见（在消息流中） |

### 关键问题

| # | 问题 | 严重性 | 描述 |
|---|------|--------|------|
| ER-1 | **Group Chat 引擎错误静默吞掉** | 高 | `event.type === 'error'` 仅输出到 console，用户完全无感知。引擎崩溃时用户看到的是对话突然停止，没有任何解释 |
| ER-2 | **Group Chat 数据加载失败无反馈** | 高 | `loadSessions`、`loadAgents`、`loadMessages`、`loadSessionDetails` 的 catch 块全部只做 `console.error`，用户看到的是空白页面或 "No messages yet" 误导信息 |
| ER-3 | **Squad 错误 Toast 暴露原始错误信息** | 中 | `err.message` 可能包含 IPC 错误栈、SQL 错误等技术内容，对用户无帮助 |
| ER-4 | **无全局错误边界** | 中 | React 组件未使用 Error Boundary，运行时 JS 错误会导致整个页面白屏 |
| ER-5 | **发送消息失败无反馈** | 中 | `handleSendMessage` 无 catch 块，IPC 调用失败时输入框已清空但消息未发送，用户无法知道失败 |
| ER-6 | **Agent 超时无用户提示** | 中 | 设计规格要求超时时显示黄色时钟图标 + "响应超时"，但实现中 Agent 超时仅 kill 进程，用户无感知 |

---

## 7. 学习曲线

**可用性评分：3 / 5**

### 评估

| 方面 | 评价 |
|------|------|
| **首次使用** | Group Chat 创建流程简单（标题 + 选 Agent + 策略），2 分钟内可完成 |
| **概念理解** | "发言策略"概念需要学习，但 Round Robin 是较直觉的选择 |
| **Squad 触发规则** | 三个下拉框 × 三个选项 = 9 种组合，缺乏组合效果的说明 |
| **发现性** | 功能入口在侧边栏 "Workspace" 分组下，位置合理，但 "Squads" 和 "Group Chat" 的区别需要解释 |
| **文档/帮助** | 无 in-app 帮助、tooltip 或引导流程 |

### 问题

| # | 问题 | 严重性 | 描述 |
|---|------|--------|------|
| LC-1 | **无首次使用引导** | 中 | 新用户进入 Group Chat 或 Squads 页面无引导流程，直接面对空白状态 |
| LC-2 | **Squad 和 Group Chat 的区别不明确** | 中 | 两者都在 "Workspace" 分组下，但使用场景不同。Squad 是任务编排，Group Chat 是对话协作。缺乏概念区分说明 |
| LC-3 | **触发规则缺乏效果说明** | 中 | "On member complete: Continue / Pause / Notify" 选项缺乏说明每个选项的实际效果 |
| LC-4 | **角色权限不透明** | 低 | Group Chat 中 expert/manager/observer 角色的实际影响（是否可发言、是否可管理其他 Agent）未在 UI 中说明 |

---

## 8. 信息架构

**可用性评分：4 / 5**

这是五个维度中得分最高的。

### 做得好的部分

- **导航位置合理**：Squads 和 Group Chat 都在侧边栏 "Workspace" 分组，与 Workflows、Cost 并列，语义一致
- **Group Chat 内部结构清晰**：会话列表 → 消息流 → 参与者面板的三栏布局，信息层级分明
- **Squad 卡片信息层次好**：名称/描述（一级）→ 状态/成员/Leader（二级）→ 触发规则/指令预览（三级）
- **模态框表单分组合理**：CreateSquadModal 从上到下：基本信息 → Leader 配置 → 触发规则 → 成员选择，符合认知顺序

### 问题

| # | 问题 | 严重性 | 描述 |
|---|------|--------|------|
| IA-1 | **Group Chat 侧边栏宽度固定 280px** | 低 | 会话标题可能被截断（text-overflow: ellipsis），但无 tooltip 显示完整标题 |
| IA-2 | **Squad 卡片无分组/筛选** | 低 | Squad 数量多时，无法按状态筛选或分组查看 |
| IA-3 | **Group Chat 无会话搜索** | 低 | 会话列表无搜索功能，会话多时查找困难 |

---

## 跨功能共性问题

### 🔴 P0: 后端功能无前端暴露
- MessageBus 优先级、Squad 通配符、负载均衡可视化 — 三项功能后端已就绪，但前端无对应 UI
- 用户无法感知、配置、监控这些核心能力

### 🔴 P0: 文档严重缺失
- getting-started.md 只覆盖基础工作流（connect → define → run → review）
- Round 2 的 5 项新功能无一出现在用户文档中
- 新用户完全不知道 Group Chat、负载均衡、消息优先级的存在

### 🟡 P1: 错误消息技术化
- "Symlink escape denied"、"Path escape denied"、"Agent exited with code 1"
- 应转换为用户友好语言 + 建议操作

### 🟡 P1: 静默失败
- 低优先级消息被丢弃无通知
- 过载 agent 被跳过无提示
- 通配符解析失败无诊断

### 🟢 P2: 反馈渠道不足
- 无 in-app 反馈入口
- 无错误日志查看 UI
- 无功能使用统计

---

## 总分汇总

| 功能 | 综合分 | 核心问题 |
|------|--------|---------|
| Group Chat (CMPAAA-539) | 3.0/5 | 策略选项不自解释、Human Assign 未实现、错误不可见 |
| Symlink 修复 (CMPAAA-540) | 1.7/5 | 错误消息技术化、无文档、无结构化错误码 |
| Squad 负载均衡 (CMPAAA-541) | 2.8/5 | overload_threshold 未暴露、过载跳过静默、无文档 |
| MessageBus 优先级 (CMPAAA-542) | 2.0/5 | 无前端 UI、无文档、消息丢弃静默 |
| Squad 动态发现 (CMPAAA-543) | 1.8/5 | 无前端 UI、无文档、解析失败静默 |
| **总体** | **2.3/5** | |

---

## 优先修复建议

### P0 — 必须修复（影响核心可用性）

1. **修复 Squad instructions/triggerRules 丢失**（SQ-1）— 用户填写的数据不生效，是数据丢失 bug
2. **Group Chat 引擎错误对用户可见**（ER-1）— 在消息流中显示错误系统消息，而非仅 console.error
3. **Group Chat 数据加载失败显示错误状态**（ER-2）— 加载失败时显示错误提示 + 重试按钮
4. **发送消息失败添加错误反馈**（ER-5）— 发送失败时恢复输入框内容并显示错误提示
5. **MessageBus 优先级前端 UI**（新增）— 用户需要能设置和查看消息优先级
6. **Squad 通配符成员配置 UI**（新增）— 用户需要能配置 wildcard 成员和查看解析状态

### P1 — 应该修复（显著提升体验）

7. **禁用或标记未实现的策略**（GC-2）— Human Assign 策略要么实现，要么标记 "Coming Soon"
8. **Squad Leader 显示名称而非 ID**（SQ-3）— 从 agents 列表中查找名称
9. **添加 React Error Boundary**（ER-4）— 防止 JS 错误导致白屏
10. **Round 2 用户文档补全**（新增）— getting-started.md 补充 Group Chat、负载均衡、优先级、通配符说明
11. **错误消息用户友好化**（新增）— "Symlink escape denied" → "此链接指向工作区外的文件"
12. **静默失败通知机制**（新增）— 过载跳过、消息丢弃、通配符解析失败需有 UI 提示

### P2 — 建议修复（提升整体质量）

13. **参与者面板可折叠**（GC-4）— 添加折叠/展开按钮
14. **添加加载状态指示器**（GC-5）— 选择会话后显示 loading
15. **Status 信息改用持久展示**（SQ-4）— Toast 改为可关闭的详情面板
16. **首次使用引导**（LC-1）— 简单的空状态引导或 tooltip 链接到文档
17. **策略选项添加说明**（GC-1, LC-3）— 为每个策略添加 tooltip 或说明文字
18. **Squad 负载可视化面板**（新增）— 前端展示 member workload 和 overload 状态

---

## 子 Issue 建议

| Issue 标题 | 关联问题 | 优先级 |
|-----------|---------|--------|
| [BUG] Squad 创建时 instructions 和 triggerRules 未传递到后端 | SQ-1 | P0 |
| [BUG] Group Chat 引擎错误对用户不可见 | ER-1, ER-2 | P0 |
| [BUG] Group Chat 发送消息失败无错误反馈 | ER-5 | P0 |
| [UX] MessageBus 消息优先级前端 UI | CMPAAA-542 | P1 |
| [UX] Squad 通配符成员配置 UI | CMPAAA-543 | P1 |
| [UX] Round 2 用户文档补全 | 全部 | P1 |
| [UX] 错误消息用户友好化 | CMPAAA-540 | P1 |
| [UX] 静默失败通知机制 | CMPAAA-541, 542, 543 | P1 |
| [UX] 禁用或标记未实现的 Group Chat 策略 | GC-2 | P1 |
| [UX] Squad Leader 显示 agentId 而非名称 | SQ-3 | P1 |
| [UX] 添加 React Error Boundary 防止白屏 | ER-4 | P1 |
| [UX] 策略选项和触发规则添加说明文案 | GC-1, SQ-2, LC-3 | P2 |
| [UX] Squad 负载可视化面板 | CMPAAA-541 | P2 |

---

## 验证方法

本审查基于以下方法：
1. **源码静态分析**：逐行审查 GroupChatPage.jsx、SquadsPage.jsx、group-chat-engine.js、workspace-manager.js、message-bus.js、squad.repository.js
2. **设计规格对照**：对照 group-chat-spec.md 和 UX-RESEARCH-GROUP-CHAT.md 检查实现完整性
3. **启发式评估**：基于 Nielsen 10 Usability Heuristics 评估交互设计
4. **错误路径分析**：追踪所有 catch 块和 error 事件的处理逻辑

未进行实际运行时测试。建议后续结合 E2E 测试进行运行时验证。

---

*本报告由 Customer Success Manager 创建，基于源码审查和设计规格对照。*
