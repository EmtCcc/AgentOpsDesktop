# Roadmap: AgentOps Desktop

本地优先的多智能体工作中枢——把 CLI Agent、编码助手和自动化工作流统一编排成一个可管理、可追踪、可治理的 AI 团队。

## Phase 1: Foundation（基础建设）

**目标：** 技术选型、架构设计、项目骨架、CI/CD 就绪。

| # | 里程碑 | 关键交付物 | 依赖 |
|---|--------|-----------|------|
| 1.1 | 技术栈选型 | `docs/TECH-STACK.md` 决策文档 | 无 |
| 1.2 | 系统架构设计 | `docs/ARCHITECTURE.md` 组件、数据流、API 边界 | 1.1 |
| 1.3 | 项目仓库初始化 | GitHub repo、README、.gitignore、package.json、基本目录结构 | 1.1 |
| 1.4 | CI/CD 管线 | lint → test → build → deploy 全链路自动化 | 1.3 |
| 1.5 | 分支保护与 PR 规范 | branch protection、PR review 流程、`docs/PR-CONVENTIONS.md` | 1.3 |

**完成标准：** 仓库存在、CI 绿灯、PR 流程可运转。

---

## Phase 2: Core Platform（核心平台）

**目标：** API 骨架成型，数据模型就位，核心 CRUD 可用。

| # | 里程碑 | 关键交付物 | 依赖 |
|---|--------|-----------|------|
| 2.1 | 数据模型与 Schema | database schema、migrations、`docs/ARCHITECTURE.md` 数据模型章节 | 1.2 |
| 2.2 | API 脚手架 | route structure、health check、request validation middleware | 2.1 |
| 2.3 | 核心 CRUD 端点 | 主资源的 Create/Read/Delete，输入校验、状态码、分页 | 2.2 |
| 2.4 | 认证与授权 | JWT/session token、401/403 处理、RBAC | 2.3 |
| 2.5 | API 文档 | OpenAPI/Swagger 自动生成，`/api-docs` 可访问 | 2.3 |
| 2.6 | API 集成测试 | 覆盖 happy path、校验错误、认证失败、边界 case | 2.3 |

**完成标准：** API 可调用、有 auth、有文档、有测试。

---

## Phase 3: MVP Features（MVP 功能）

**目标：** Agent 接入、任务编排、实时监控——核心用户旅程跑通。

| # | 里程碑 | 关键交付物 | 依赖 |
|---|--------|-----------|------|
| 3.1 | MVP 范围定义 | `docs/MVP-SCOPE.md`：核心用户旅程、3 个关键功能、明确 non-goals | 2.4 |
| 3.2 | Agent Runtime 连接 | 支持接入 Claude Code、Codex 等 CLI Agent | 3.1 |
| 3.3 | 任务看板与分配 | 任务创建/分解/分配 UI，Agent 角色管理 | 3.2 |
| 3.4 | 实时日志与状态 | Agent 执行日志流、状态追踪、阻塞点可视化 | 3.2 |
| 3.5 | 多 Agent 并行编排 | 并行执行、后台终端、结果回传 | 3.3, 3.4 |

**完成标准：** 用户可通过桌面端完成一次完整的「需求 → 分解 → 多 Agent 执行 → 测试 → 汇总 → 确认交付」闭环。

---

## Phase 4: Polish & Ship（打磨与交付）

**目标：** 生产就绪，文档齐全，用户体验达标。

| # | 里程碑 | 关键交付物 | 依赖 |
|---|--------|-----------|------|
| 4.1 | 安全审查 | `docs/SECURITY-REVIEW.md`、OWASP Top 10 检查、依赖 CVE 扫描 | 3.5 |
| 4.2 | 威胁建模 | `docs/THREAT-MODEL.md`、STRIDE 分析 | 3.5 |
| 4.3 | 用户文档 | getting-started guide、API reference、contribution guide | 3.5 |
| 4.4 | 部署与监控 | 生产环境部署、健康检查、错误追踪、告警 | 4.1 |
| 4.5 | 用户反馈收集与迭代 | 反馈分类、关键 bug 修复、UX 改进 | 4.4 |

**完成标准：** 生产环境运行、安全审查通过、用户文档可用。

---

## Phase 5: Website Relaunch（官网改版）

**目标：** 全新官网设计上线，内容迁移完整，SEO/性能达标。

| # | 里程碑 | 关键交付物 | 依赖 |
|---|--------|-----------|------|
| 5.1 | 现站审计 | `docs/SITE-AUDIT.md`：页面清单、技术栈、SEO 基线、内容清单 | 无 |
| 5.2 | 设计交付 | 设计稿解析、`docs/DESIGN-SPEC.md`：token、组件、布局 | 5.1 |
| 5.3 | 前端实现 | 核心页面模板、组件库、响应式实现 | 5.2 |
| 5.4 | 内容迁移 | 内容转移、URL redirect map、SEO 保留 | 5.3 |
| 5.5 | QA 与上线 | 跨浏览器测试、性能优化、Core Web Vitals、go-live | 5.4 |

**完成标准：** 新站上线、所有 redirect 生效、Core Web Vitals 达标。

---

## 当前状态

- **活跃阶段：** Phase 1 — Foundation
- **阻塞项：** 设计稿待上传（[CMPAA-27](/CMPAA/issues/CMPAA-27)）
- **上次更新：** 2026-05-28
