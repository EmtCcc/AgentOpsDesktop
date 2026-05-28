# DevOps 工程师招聘方案

## 职位概述

**职位名称：** DevOps 工程师
**优先级：** P1
**项目：** 花影 (AgentOpsDesktop)
**汇报对象：** 技术负责人

## 项目背景

花影是一个跨平台桌面应用（Electron），目标是将 CLI Agent、编码助手和自动化工作流统一编排成可管理、可追踪、可治理的 AI 团队。当前项目已有基础 CI/CD（GitHub Actions）和 macOS 签名发布流程，但缺少系统化的容器化、多平台构建、自动更新和监控体系。DevOps 工程师将负责构建完整的工程基础设施，支撑团队从 0 到 1 的规模化交付。

## 现有基础设施

| 组件 | 状态 | 技术 |
|------|------|------|
| CI | ✅ 已有 | GitHub Actions (lint → test → e2e → build) |
| Release | ✅ 已有 | GitHub Actions + electron-builder + Apple 签名 + notarize |
| 测试 | ✅ 已有 | Vitest (单元) + Playwright (E2E) + smoke test |
| 数据库 | ✅ 已有 | SQLite (better-sqlite3) |
| 自动更新 | ✅ 已有 | electron-updater |
| 容器化 | ❌ 无 | — |
| 多平台构建 | ⚠️ 仅 macOS | 需扩展 Windows/Linux |
| 监控/可观测 | ❌ 无 | — |
| 部署自动化 | ⚠️ 手动 | 需自动化发布流水线 |

## 核心职责

1. **CI/CD 流水线优化**
   - 维护和优化 GitHub Actions 工作流
   - 实现构建缓存和并行化策略
   - 建立 PR 质量门禁（lint + type check + test + coverage）
   - 配置构建矩阵（macOS / Windows / Linux × x64 / arm64）

2. **容器化与环境管理**
   - 设计开发环境容器化方案（devcontainer）
   - 构建 CI/CD 专用构建镜像
   - 管理依赖版本锁定和安全扫描

3. **发布自动化**
   - 完善 electron-builder 多平台构建配置
   - 实现语义化版本自动发布（semantic-release 或 Changesets）
   - 管理代码签名证书（Apple / Windows）
   - 配置 auto-update CDN 和灰度发布策略

4. **监控与可观测性**
   - 设计应用崩溃报告收集方案（Sentry / Crashpad）
   - 建立构建和发布指标看板
   - 配置关键路径告警（构建失败、发布异常、下载异常）

5. **安全与合规**
   - 管理 GitHub Secrets 和密钥轮换
   - 实现依赖漏洞自动扫描（Dependabot / Snyk）
   - 配置 SLSA 供应链安全框架
   - 确保代码签名和公证流程合规

6. **开发者体验**
   - 维护本地开发环境文档和脚本
   - 优化 npm install 和构建速度
   - 建立开发者自助工具链

## 任职要求

### 必备技能

- **CI/CD 精通**
  - 3年以上 CI/CD 流水线设计和维护经验
  - 精通 GitHub Actions（或 GitLab CI / CircleCI）
  - 有 Electron 或桌面应用构建流水线经验
  - 理解构建缓存、矩阵构建、制品管理

- **容器化与编排**
  - 精通 Docker，有容器化开发环境经验
  - 熟悉 Kubernetes 基础（部署、服务、配置管理）
  - 有 docker-compose 编排经验

- **脚本与自动化**
  - 精通 Shell 脚本（Bash / Zsh）
  - 熟悉 Node.js 脚本编写
  - 有自动化工具链构建经验

- **发布管理**
  - 有桌面应用（Electron / Tauri）或移动应用发布经验
  - 熟悉代码签名（Apple / Windows）和公证流程
  - 理解语义化版本和变更日志管理

### 加分项

- 有 Electron Builder / electron-updater 配置经验
- 熟悉 macOS notarization 和 Windows Authenticode
- 有 Sentry / Crashpad 崩溃报告集成经验
- 熟悉 Terraform / Pulumi 基础设施即代码
- 有开源项目维护经验
- 熟悉 SLSA / Sigstore 供应链安全

## 技术栈

| 类别 | 技术 |
|------|------|
| CI/CD | GitHub Actions |
| 构建 | electron-builder, esbuild |
| 容器 | Docker, docker-compose |
| 编排 | Kubernetes (基础) |
| 监控 | Sentry, GitHub Insights |
| 安全 | Dependabot, Snyk, SLSA |
| 语言 | Shell, Node.js, YAML |
| 平台 | macOS, Windows, Linux |

## 面试流程

### 第一轮：技术筛选（30分钟）

- CI/CD 经验讨论
- Electron 构建和发布流程理解
- 运维问题排查思路

### 第二轮：实操测试（60分钟）

- 编写一个 GitHub Actions workflow 实现多平台构建
- 排查一个给定的构建失败场景
- 评估脚本能力和问题解决思路

### 第三轮：系统设计（60分钟）

- 设计 Electron 应用的完整发布流水线方案
- 讨论监控和可观测性架构
- 评估技术决策和权衡能力

### 第四轮：文化匹配（30分钟）

- 团队协作方式
- 自动化理念和开发者体验思维
- 对桌面应用交付的理解

## 评估标准

| 维度 | 权重 | 评估点 |
|------|------|--------|
| CI/CD 能力 | 35% | 流水线设计、构建优化、多平台支持 |
| 容器化与自动化 | 25% | Docker 经验、环境管理、脚本能力 |
| 发布管理 | 20% | 签名公证、版本管理、灰度发布 |
| 安全意识 | 10% | 密钥管理、依赖扫描、供应链安全 |
| 团队协作 | 10% | 沟通能力、开发者体验思维 |

## 薪资范围

根据经验和地区，建议范围：
- 中级（3-5年 DevOps 经验）：35-50万/年
- 高级（5年+，有桌面应用经验）：50-75万/年
- 专家（有 Electron 发布体系经验）：75-100万/年

## 招聘渠道

1. **技术社区**
   - GitHub (Electron / DevOps 相关项目)
   - V2EX / 掘金 DevOps 板块
   - DevOps 社区 / 云原生社区

2. **招聘平台**
   - Boss直聘（DevOps 方向筛选）
   - 猎聘（中高端运维人才）
   - LinkedIn

3. **技术会议/Meetup**
   - KubeCon / CloudNativeCon
   - GitHub Universe
   - DevOps 社区 Meetup

4. **内推**
   - 团队成员推荐
   - 技术社区人脉

## 时间规划

| 阶段 | 时间 | 产出 |
|------|------|------|
| 职位发布 | 第1周 | JD上线，渠道投放 |
| 简历筛选 | 第2-3周 | 候选人名单 |
| 面试流程 | 第4-6周 | 面试完成 |
| Offer发放 | 第7周 | 录用通知 |
| 入职准备 | 第8周 | 入职完成 |

## 风险与应对

| 风险 | 应对措施 |
|------|----------|
| Electron DevOps 人才稀缺 | 扩大搜索范围，接受纯 DevOps 背景 + 快速学习能力 |
| 薪资竞争 | 提供有竞争力的 package，强调技术挑战和成长空间 |
| 候选人缺乏桌面应用经验 | 可接受纯后端/云原生背景，桌面构建技能可培养 |
| 流程过长被抢人 | 缩短面试周期至2周，快速决策 |

---

**下一步行动：**
1. 确认薪资范围和福利待遇
2. 发布职位到各渠道
3. 启动简历筛选流程
4. 同步技术负责人准备面试题库和实操测试环境
