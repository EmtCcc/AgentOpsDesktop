# Design Spec: Group Chat Mode (群聊模式)

**Issue**: CMPAAA-465
**Author**: UI & Brand Designer
**Date**: 2026-05-29
**Status**: Ready for review
**Heuristic**: H1 — Visibility of system status; H3 — User control and freedom

> 基于 [UX 研究报告](/docs/UX-RESEARCH-GROUP-CHAT.md) (CMPAAA-333) 创建。

---

## 1. Problem Statement

AgentOps Desktop 缺少多 Agent 实时协作的可视化界面。用户无法在同一视图中观察多个 Agent 的对话、引导讨论方向或即时介入。这导致用户在多 Agent 协作场景下失去掌控感——UX 研究报告中识别的首要风险。

**Severity**: Major — 群聊模式是产品核心差异化能力。

---

## 2. Scope

| # | Feature | Priority | 描述 |
|---|---------|----------|------|
| 1 | 基础群聊对话界面 | P0 | 多 Agent 消息流实时渲染 |
| 2 | 对话历史查看 | P0 | 滚动回溯、搜索过滤、按 Agent 筛选 |
| 3 | 人类即时发言输入 | P0 | 输入框发送消息到群聊 |
| 4 | 参与者面板 | P0 | 实时显示 Agent 状态与角色 |
| 5 | 轮流发言策略 | P1 | 基础 round-robin 发言机制 |
| 6 | 暂停/恢复对话 | P1 | 人类控制对话节奏 |
| 7 | Manager 分配策略 | P2 | 智能发言者选择 |

---

## 3. Information Architecture — Page Structure

```
群聊模式页面
├── 顶部操作栏 (48px)
│   ├── 侧边栏切换按钮
│   ├── 群聊标题（可编辑）
│   ├── 状态指示器（进行中 / 已暂停 / 已完成）
│   ├── 群聊列表下拉
│   └── 操作按钮组（暂停 / 结束 / 设置 / 导出）
├── 主体区域 (flex: 1)
│   ├── 对话流区域 (flex: 1, min-width: 400px)
│   │   ├── 消息列表（可滚动）
│   │   ├── 新消息提示条（向下滚动时出现）
│   │   └── 当前发言者指示器
│   ├── 参与者面板 (280px, 可折叠)
│   │   ├── 参与者列表（头像 / 名称 / 角色 / 状态）
│   │   ├── 策略配置摘要
│   │   └── 手动指定发言者控件
│   └── 分隔条 (1px + 拖拽手柄)
└── 底部输入区 (auto, min: 56px, max: 200px)
    ├── 输入框（多行，支持 Shift+Enter 换行）
    ├── 发送按钮（Enter 发送）
    └── 介入按钮（显式标记人类介入）
```

---

## 4. Page Layout — Wireframe

### 4.1 Full Page Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  架构讨论 · 进行中                          [⏸ 暂停] [⏹ 结束] [⋯] [📥 导出] │
├──────────────────────────────────────────────────────────┬──────────────────────┤
│                                                          │  参与者  [×]         │
│  ┌──────────────────────────────────────────────────┐    │                      │
│  │ 🟢 Agent-Manager  ·  14:32:15                    │    │  ┌──────────────────┐│
│  │                                                  │    │  │ 🟢 Manager       ││
│  │ 好的，让我们开始讨论前端框架的选择。                  │    │  │    协调者         ││
│  │ Agent-Frontend，你有什么建议？                      │    │  ├──────────────────┤│
│  │                                                  │    │  │ 🔵 Agent-Front   ││
│  └──────────────────────────────────────────────────┘    │    专家 · 正在发言   │
│                                                          │  ├──────────────────┤│
│  ┌──────────────────────────────────────────────────┐    │  │ 🔵 Agent-Back    │
│  │ 🔵 Agent-Frontend  ·  14:32:45                   │    │    专家 · 等待中     │
│  │                                                  │    │  ├──────────────────┤│
│  │ 我推荐 React + TypeScript。理由如下：               │    │  │ 🔵 Agent-Infra   │
│  │ 1. 生态成熟，组件库丰富                              │    │    专家 · 等待中     │
│  │ 2. 类型安全，减少运行时错误                           │    │  └──────────────────┘│
│  │                                                  │    │                      │
│  └──────────────────────────────────────────────────┘    │  ── 策略 ──          │
│                                                          │  轮流发言 (Round-Robin)│
│  ┌──────────────────────────────────────────────────┐    │  [切换策略 ▾]         │
│  │ 👤 您  ·  14:33:00                               │    │                      │
│  │                                                  │    │  ── 操作 ──          │
│  │ 请先讨论前端框架的性能对比                           │    │  [⏭ 指定发言者]       │
│  │                                                  │    │  [⏸ 暂停对话]        │
│  └──────────────────────────────────────────────────┘    │                      │
│                                                          │                      │
│  ┌──────────────────────────────────────────────────┐    │                      │
│  │ 🟡 Agent-Manager  ·  14:33:15  ·  📌 指令        │    │                      │
│  │                                                  │    │                      │
│  │ 收到。Agent-Frontend 和 Agent-Backend，             │    │                      │
│  │ 请分别从性能角度分析你们推荐的框架。                   │    │                      │
│  │                                                  │    │                      │
│  └──────────────────────────────────────────────────┘    │                      │
│                                                          │                      │
│  ┌──────────────────────────────────────────────────┐    │                      │
│  │ 🔵 Agent-Backend  ·  14:33:45                    │    │                      │
│  │                                                  │    │                      │
│  │ 从后端角度看，Next.js 的 SSR 性能...                 │    │                      │
│  │                                                  │    │                      │
│  └──────────────────────────────────────────────────┘    │                      │
│                                                          │                      │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐    │                      │
│  │ 💬 Agent-Frontend 正在输入...                      │    │                      │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘    │                      │
│                                                          │                      │
├──────────────────────────────────────────────────────────┴──────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐  [发送]  [💬 介入] │
│ │ 输入消息... (Enter 发送, Shift+Enter 换行)                 │                   │
│ └──────────────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Empty State Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  群聊模式                                      [+ 新建群聊]                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                                                                                 │
│                           ┌─────────────────────┐                               │
│                           │                     │                               │
│                           │   💬  尚无活跃群聊    │                               │
│                           │                     │                               │
│                           │   创建一个群聊来开始  │                               │
│                           │   多 Agent 协作       │                               │
│                           │                     │                               │
│                           │  [+ 创建群聊]        │                               │
│                           │                     │                               │
│                           └─────────────────────┘                               │
│                                                                                 │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Specifications

### 5.1 Message Bubble (消息气泡)

消息气泡是群聊界面的核心组件，需要清晰区分不同发言者。

#### 5.1.1 Layout Structure

```
┌──────────────────────────────────────────────────┐
│ [头像/色条] Agent名称 · 角色标签 · 时间戳          │
│                                                  │
│ 消息内容（支持 Markdown 渲染）                      │
│                                                  │
│ [系统标签]（可选：指令、系统消息等）                  │
└──────────────────────────────────────────────────┘
```

#### 5.1.2 Message Types & Visual Treatment

| 类型 | 左边框色 | 背景 | 头像样式 | 标签 |
|------|---------|------|---------|------|
| Agent (Manager) | `--color-primary` (#6366F1) | `--color-bg-elevated` | 圆形，primary 边框 | `协调者` pill |
| Agent (Expert) | `--color-info` (#3B82F6) | `--color-bg-elevated` | 圆形，info 边框 | `专家` pill |
| Agent (speaking) | 同角色 + 脉冲动画 | `--color-bg-elevated` | 呼吸光晕 | — |
| 人类消息 | `--color-success` (#10B981) | `var(--color-success-light)` | 用户图标 | `您` pill |
| 系统/指令 | `--color-warning` (#F59E0B) | `var(--color-warning-light)` | 无 | `指令` / `系统` pill |
| 错误 | `--color-danger` (#EF4444) | `var(--color-danger-light)` | 警告图标 | `错误` pill |

#### 5.1.3 CSS

```css
/* messages.css — 群聊消息气泡 */
.group-chat-message {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  margin-bottom: var(--space-2);
  transition: background var(--motion-fast);
}

.group-chat-message:hover {
  background: var(--color-bg-tertiary);
}

/* 发言者类型变体 */
.group-chat-message--manager {
  border-left-color: var(--color-primary);
}

.group-chat-message--expert {
  border-left-color: var(--color-info);
}

.group-chat-message--human {
  border-left-color: var(--color-success);
  background: var(--color-success-light);
}

.group-chat-message--system {
  border-left-color: var(--color-warning);
  background: var(--color-warning-light);
}

.group-chat-message--error {
  border-left-color: var(--color-danger);
  background: var(--color-danger-light);
}

/* 头像 */
.group-chat-message__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.group-chat-message--manager .group-chat-message__avatar {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.group-chat-message--expert .group-chat-message__avatar {
  border-color: var(--color-info);
  color: var(--color-info);
}

.group-chat-message--human .group-chat-message__avatar {
  border-color: var(--color-success);
  background: var(--color-success);
  color: var(--color-text-inverse);
}

/* 正在发言状态 — 脉冲光晕 */
.group-chat-message--speaking .group-chat-message__avatar {
  animation: avatar-pulse 2s ease-in-out infinite;
}

@keyframes avatar-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
}

/* 消息头部 */
.group-chat-message__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.group-chat-message__name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.group-chat-message__role {
  font-size: var(--text-xs);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-medium);
}

.group-chat-message__timestamp {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-left: auto;
  font-family: var(--font-mono);
}

/* 消息内容 */
.group-chat-message__content {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text-primary);
}

.group-chat-message__content p {
  margin: 0 0 var(--space-2);
}

.group-chat-message__content p:last-child {
  margin-bottom: 0;
}

.group-chat-message__content code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-bg-tertiary);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
}

.group-chat-message__content pre {
  background: var(--color-bg-tertiary);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  margin: var(--space-2) 0;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .group-chat-message--human {
    background: rgba(16, 185, 129, 0.08);
  }
  .group-chat-message--system {
    background: rgba(245, 158, 11, 0.08);
  }
  .group-chat-message--error {
    background: rgba(239, 68, 68, 0.08);
  }
  .group-chat-message--speaking .group-chat-message__avatar {
    animation-name: avatar-pulse-dark;
  }
  @keyframes avatar-pulse-dark {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); }
    50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
  }
}
```

### 5.2 Typing Indicator (正在输入指示器)

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│ 💬 Agent-Frontend 正在输入...                      │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

```css
.group-chat-typing {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  font-style: italic;
  border-left: 3px solid transparent;
  margin-bottom: var(--space-2);
}

.group-chat-typing__dots {
  display: flex;
  gap: 3px;
}

.group-chat-typing__dot {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-text-tertiary);
  animation: typing-bounce 1.4s infinite;
}

.group-chat-typing__dot:nth-child(2) { animation-delay: 0.2s; }
.group-chat-typing__dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .group-chat-typing__dot { animation: none; opacity: 0.6; }
}
```

### 5.3 Conversation Header (顶部操作栏)

```css
.group-chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 48px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.group-chat-header__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  cursor: text;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
}

.group-chat-header__title:hover {
  border-color: var(--color-border);
}

.group-chat-header__title--editing {
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 2px var(--color-primary-light);
  outline: none;
  background: var(--color-bg-primary);
}

.group-chat-header__status {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
}

.group-chat-header__status--active {
  background: var(--color-success-light);
  color: var(--color-success);
}

.group-chat-header__status--paused {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.group-chat-header__status--completed {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
}

.group-chat-header__actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}
```

### 5.4 Participants Panel (参与者面板)

```
┌──────────────────────────────┐
│  参与者  [×]                  │
├──────────────────────────────┤
│                              │
│  🟢 Manager                  │
│     协调者 · 当前发言          │
│                              │
│  🔵 Agent-Frontend           │
│     前端专家 · 正在发言        │
│                              │
│  🔵 Agent-Backend            │
│     后端专家 · 等待中          │
│                              │
│  🔵 Agent-Infra              │
│     运维专家 · 等待中          │
│                              │
│  👤 您 (人类)                 │
│     观察者 · 在线              │
│                              │
├──────────────────────────────┤
│  ── 策略 ──                   │
│  轮流发言 (Round-Robin)       │
│  [切换策略 ▾]                 │
│                              │
│  ── 操作 ──                   │
│  [⏭ 指定发言者]               │
│  [⏸ 暂停对话]                 │
└──────────────────────────────┘
```

```css
.group-chat-participants {
  width: 280px;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.group-chat-participants__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.group-chat-participant {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  transition: background var(--motion-fast);
  cursor: default;
}

.group-chat-participant:hover {
  background: var(--color-bg-tertiary);
}

.group-chat-participant__status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.group-chat-participant__status-dot--speaking {
  background: var(--status-running);
  animation: status-pulse 1.5s ease-in-out infinite;
}

.group-chat-participant__status-dot--listening {
  background: var(--color-info);
}

.group-chat-participant__status-dot--idle {
  background: var(--status-idle);
}

.group-chat-participant__status-dot--error {
  background: var(--status-error);
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.group-chat-participant__info {
  flex: 1;
  min-width: 0;
}

.group-chat-participant__name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-chat-participant__role {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.group-chat-participant__action {
  opacity: 0;
  transition: opacity var(--motion-fast);
}

.group-chat-participant:hover .group-chat-participant__action {
  opacity: 1;
}

/* 策略/操作区域 */
.group-chat-participants__section {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
}

.group-chat-participants__section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}
```

### 5.5 Message Input Area (消息输入区)

```css
.group-chat-input {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.group-chat-input__textarea {
  flex: 1;
  min-height: 36px;
  max-height: 200px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--color-text-primary);
  resize: none;
  line-height: 1.5;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.group-chat-input__textarea::placeholder {
  color: var(--color-text-tertiary);
}

.group-chat-input__textarea:focus {
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 2px var(--color-primary-light);
  outline: none;
}

.group-chat-input__send {
  height: 36px;
  min-width: 64px;
}

.group-chat-input__intervene {
  height: 36px;
  white-space: nowrap;
}

/* 介入按钮 — 强调人类参与的显式性 */
.group-chat-input__intervene--active {
  background: var(--color-success);
  color: var(--color-text-inverse);
  border-color: var(--color-success);
}
```

### 5.6 New Message Toast (新消息提示条)

当用户向上滚动浏览历史时，如有新消息出现：

```
┌──────────────────────────────────────────────┐
│          ↓ 3 条新消息                  [跳转] │
└──────────────────────────────────────────────┘
```

```css
.group-chat-new-messages {
  position: sticky;
  bottom: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform var(--motion-normal);
  z-index: 10;
}

.group-chat-new-messages:hover {
  background: var(--color-primary-hover);
}
```

---

## 6. Interaction Flows

### 6.1 人类即时发言 Flow

```
用户输入消息
    │
    ▼
┌──────────────┐     ┌──────────────────────┐
│ 点击 [发送]   │────►│ 消息插入对话流        │
│ 或按 Enter    │     │ 标记为人类消息        │
└──────────────┘     │ 显示在对话底部        │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │ Agent 响应人类消息     │
                     │ （按当前发言策略）      │
                     └──────────────────────┘
```

**键盘快捷键**:

| Key | Action |
|-----|--------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `Escape` | 清空输入框 |
| `Cmd/Ctrl + Enter` | 发送（备选） |

**发送后行为**:
- 输入框清空
- 对话流自动滚动到底部
- 输入框保持焦点

### 6.2 对话历史查看 Flow

```
用户向上滚动
    │
    ▼
┌──────────────────────────────┐
│ 自动加载更早的消息 (无限滚动)  │
│ 加载指示器显示在顶部           │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ 新消息到达时显示提示条          │
│ "↓ N 条新消息"                │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ 点击提示条 → 平滑滚动到底部    │
│ 或按 Cmd+↓                   │
└──────────────────────────────┘
```

### 6.3 按 Agent 过滤消息

参与者面板中点击某个 Agent → 对话流只显示该 Agent 的消息。

```
过滤状态：
┌─────────────────────────────────────────────────┐
│ 显示: Agent-Frontend 的消息      [清除过滤 ×]    │
├─────────────────────────────────────────────────┤
│ (只显示该 Agent 的消息气泡)                      │
└─────────────────────────────────────────────────┘
```

```css
.group-chat-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-light);
  font-size: var(--text-xs);
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
}

.group-chat-filter-bar__clear {
  margin-left: auto;
  cursor: pointer;
  color: var(--color-primary);
  font-weight: var(--font-medium);
}

.group-chat-filter-bar__clear:hover {
  text-decoration: underline;
}
```

### 6.4 暂停/恢复对话

```
[⏸ 暂停] ──click──► 所有 Agent 停止发言
                     状态变为 "已暂停"
                     按钮变为 [▶ 恢复]
                     输入框仍可用（人类可继续发言）

[▶ 恢复] ──click──► Agent 按策略继续发言
                     状态变为 "进行中"
                     按钮变回 [⏸ 暂停]
```

---

## 7. Speaker Strategy Indicator (发言策略指示器)

参与者面板底部显示当前策略及轮次状态：

```
── 策略 ──
轮流发言 (Round-Robin)
当前轮次: Agent-Backend → Agent-Frontend → ...
[切换策略 ▾]
```

策略切换下拉菜单：

```
┌─────────────────────────────┐
│ ○ 轮流发言 (Round-Robin)  ✓ │
│ ○ Manager 分配              │
│ ○ 人类指定                  │
└─────────────────────────────┘
```

---

## 8. Status Bar (底部状态栏)

对话流底部可选的状态信息条：

```
├──────────────────────────────────────────────────────────────────────────────┤
│  42 条消息  ·  对话时长 30:15  ·  最后发言: Agent-Backend (2m ago)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

```css
.group-chat-status-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-1) var(--space-4);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
}
```

---

## 9. Responsive Behavior

| Breakpoint | 参与者面板 | 对话区域 | 输入区 |
|------------|-----------|---------|--------|
| ≥ 1280px | 可见 (280px) | flex: 1 | 完整 |
| 960–1279px | 可折叠，默认收起 | flex: 1 | 完整 |
| < 960px | 抽屉覆盖 | 全宽 | 固定底部 |

**移动端 ( < 960px )**:
- 参与者面板变为抽屉（从右侧滑入，overlay）
- 消息气泡减少内边距
- 输入区固定在底部，不随键盘弹起（Electron 处理）

```css
@media (max-width: 959px) {
  .group-chat-participants {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: var(--z-modal);
    transform: translateX(100%);
    transition: transform var(--motion-normal);
    box-shadow: var(--shadow-xl);
  }

  .group-chat-participants--open {
    transform: translateX(0);
  }

  .group-chat-participants__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: calc(var(--z-modal) - 1);
  }

  .group-chat-message {
    padding: var(--space-2) var(--space-3);
  }
}
```

---

## 10. Accessibility Checklist

- [ ] 对话区域使用 `role="log"` + `aria-live="polite"` 实时播报新消息
- [ ] 每条消息有 `aria-label` 包含发言者名称和时间
- [ ] 输入区有 `aria-label="群聊消息输入"`
- [ ] 发送按钮有 `aria-label="发送消息"`
- [ ] 介入按钮有 `aria-label="以人类身份介入对话"`
- [ ] 参与者面板有 `role="complementary"` + `aria-label="群聊参与者"`
- [ ] 状态变更（暂停/恢复/完成）通过 `aria-live="assertive"` 播报
- [ ] 所有交互元素支持键盘导航 (`Tab`, `Shift+Tab`)
- [ ] 消息过滤状态通过 `aria-live` 播报 "正在显示 X 的消息"
- [ ] 新消息提示条 `aria-live="polite"` + 可通过 Enter 触发
- [ ] 颜色非唯一区分手段——每个发言者同时有色条 + 文字标签 + 头像
- [ ] `prefers-reduced-motion` 下禁用脉冲动画和打字指示器动画

---

## 11. Design Tokens — New Additions

以下为群聊模式新增的设计 token，需追加到 `tokens.css`：

```css
/* Group Chat — 新增 token */
--group-chat-manager-color: var(--color-primary);       /* #6366F1 */
--group-chat-expert-color: var(--color-info);            /* #3B82F6 */
--group-chat-human-color: var(--color-success);          /* #10B981 */
--group-chat-system-color: var(--color-warning);         /* #F59E0B */
--group-chat-error-color: var(--color-danger);           /* #EF4444 */

--group-chat-message-radius: var(--radius-md);           /* 6px */
--group-chat-bubble-max-width: 85%;                      /* 消息气泡最大宽度 */
--group-chat-panel-width: 280px;                         /* 参与者面板宽度 */
--group-chat-header-height: 48px;                        /* 顶部操作栏高度 */
--group-chat-input-min-height: 36px;                     /* 输入框最小高度 */
```

---

## 12. Implementation Notes

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/styles/group-chat.css` | 群聊模式所有样式 |
| `src/renderer/pages/GroupChatPage.jsx` | 群聊页面主组件 |
| `src/renderer/components/group-chat/MessageBubble.jsx` | 消息气泡组件 |
| `src/renderer/components/group-chat/ParticipantsPanel.jsx` | 参与者面板 |
| `src/renderer/components/group-chat/ChatInput.jsx` | 输入区域 |
| `src/renderer/components/group-chat/TypingIndicator.jsx` | 正在输入指示器 |
| `src/renderer/components/group-chat/FilterBar.jsx` | 消息过滤条 |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/styles/tokens.css` | 追加群聊相关 token |
| `src/renderer/styles/components.css` | 追加通用组件扩展（如有） |
| `designs/icons.svg` | 新增图标：群聊、介入、暂停、恢复、导出 |

### New Icons for `designs/icons.svg`

```xml
<!-- 群聊 / Messages -->
<symbol id="icon-messages" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  <path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>
</symbol>

<!-- 介入 / Hand -->
<symbol id="icon-intervene" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 11V6a2 2 0 0 0-4 0v1"/>
  <path d="M14 10V4a2 2 0 0 0-4 0v2"/>
  <path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>
  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
</symbol>

<!-- 暂停 / Pause -->
<symbol id="icon-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
</symbol>

<!-- 恢复 / Play -->
<symbol id="icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="5 3 19 12 5 21 5 3"/>
</symbol>

<!-- 导出 / Download -->
<symbol id="icon-export" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
</symbol>
```

---

## 13. Data Model — UI Contract

群聊页面期望的组件 props / state 结构：

```javascript
// 群聊会话状态
const chatSession = {
  id: "chat-uuid",
  title: "架构讨论",
  status: "active",           // "active" | "paused" | "completed"
  strategy: "round-robin",    // "round-robin" | "manager-assign" | "human-assign"
  createdAt: "2026-05-29T14:30:00Z",
  messageCount: 42,
  duration: 1800000,
};

// 参与者
const participant = {
  agentId: "agent-1",
  name: "Agent-Frontend",
  role: "expert",              // "manager" | "expert" | "observer"
  status: "speaking",          // "speaking" | "listening" | "idle" | "error"
  avatar: "AF",                // 头像缩写
  specialty: "前端专家",        // 专长标签
};

// 消息
const message = {
  id: "msg-uuid",
  agentId: "agent-1",          // 或 "human"
  agentName: "Agent-Frontend",
  role: "expert",
  content: "消息内容（支持 Markdown）",
  timestamp: "2026-05-29T14:32:15Z",
  type: "chat",                // "chat" | "instruction" | "system" | "error"
  isTyping: false,             // 是否正在输入
};
```

---

## 14. Error States UX

| 场景 | 视觉表现 | 用户可执行操作 |
|------|---------|--------------|
| Agent 响应超时 (>30s) | 消息气泡显示黄色时钟图标 + "响应超时" | [重试] [跳过该 Agent] |
| Agent 崩溃 | 参与者面板中该 Agent 变红 + 错误标签 | [重启 Agent] [移除] |
| 对话死锁 (检测到循环) | 系统消息警告 + 暂停对话 | [介入] [终止] |
| 网络断开 | 顶部警告条 "连接已断开，正在重连..." | [手动重连] |
| 消息发送失败 | 消息气泡显示红色感叹号 | [重发] [删除] |

```css
.group-chat-message--timeout {
  border-left-color: var(--color-warning);
}

.group-chat-message--timeout::after {
  content: "⏱ 响应超时";
  display: block;
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-warning);
}

.group-chat-message--failed-send {
  border-left-color: var(--color-danger);
  opacity: 0.7;
}

.group-chat-message__retry {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-danger);
  cursor: pointer;
}

.group-chat-message__retry:hover {
  text-decoration: underline;
}

.group-chat-disconnect-bar {
  padding: var(--space-2) var(--space-4);
  background: var(--color-warning-light);
  color: var(--color-warning);
  font-size: var(--text-xs);
  text-align: center;
  border-bottom: 1px solid var(--color-warning);
}
```

---

## 15. Design Rationale

| 决策 | 理由 |
|------|------|
| 左侧色条区分发言者（非头像色） | 色条在消息流中形成视觉扫描线，比头像更快识别来源。UX 研究报告 §4.2 指出"角色混淆"是中风险。 |
| 人类消息使用绿色背景 | 与 Agent 消息在视觉层级上明确区分。UX 研究 §2.2 要求"人类消息用不同颜色/样式区分"。 |
| 介入按钮独立于发送按钮 | 介入是显式的人类控制行为，需要与普通发言区分。UX 研究 §2.3 定义了五种介入类型。 |
| 参与者面板默认 280px | 足够显示名称+角色+状态，不挤压对话区域。参考 Slack 频道面板宽度 (220-300px)。 |
| Manager 指令用黄色底色 | 指令类消息影响所有 Agent 行为，需要高可见度。用 warning 色而非 danger 色——它是引导而非错误。 |
| 正在输入指示器用虚线边框 | 与正式消息气泡区分，暗示"未完成"。虚线是通用的"草稿/进行中"视觉语言。 |
| 打字动画尊重 reduced-motion | 无障碍要求。禁用动画后改为静态半透明圆点。 |
| 介入按钮可切换激活态 | 激活后变绿色，明确告知用户"你现在以人类身份介入了"。防止用户不确定自己是否已介入。 |

---

## 16. Out of Scope (Future Milestones)

- Manager 分配发言策略的完整 UI（P2）
- 话题触发发言策略（P3）
- 对话导出为 JSON/Markdown（P2）
- 消息搜索功能（P1）
- 消息书签/关键消息标记（P2）
- 对话摘要自动生成（P3）
- 语音输入（P3）
- 表情/反应功能（P3）

---

*本文档由 UI & Brand Designer 创建，基于 UX 研究报告 (CMPAAA-333) 和设计系统 v2.0。*
