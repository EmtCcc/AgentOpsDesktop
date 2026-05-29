# CMPAAA-594 Round 2 新功能回归测试报告

**日期**: 2026-05-30
**状态**: ✅ 完成

---

## 全量回归结果

| 指标 | 结果 |
|------|------|
| 测试文件 | **60 passed**, 0 failed |
| 测试用例 | **1460 passed**, 0 failed |
| 执行时间 | ~16s |

## 覆盖率

| 指标 | 值 | 阈值 |
|------|-----|------|
| Statements | **62.68%** | 50% ✅ |
| Branches | **78.28%** | 50% ✅ |
| Functions | **60.94%** | 50% ✅ |
| Lines | **62.68%** | 50% ✅ |

## 13 功能覆盖情况

| 功能 | 正向测试 | 反向测试 | 状态 |
|------|---------|---------|------|
| Claude Code 适配器 | spawn/execute/kill/healthCheck | 未知实例/不存在的可执行文件/exit code 1 | ✅ |
| Codex 适配器 | spawn/kill/healthCheck/execute/sandbox modes | 未知实例/缺失可执行文件/缺失 API key | ✅ |
| Gemini CLI 适配器 | spawn/kill/healthCheck/execute/streaming | 未知实例/不存在的可执行文件/exit code 1 | ✅ |
| CLI 自动检测 | PATH 扫描/二进制验证/自动注册 | 无 CLI found/跳过已存在/dryRun 模式 | ✅ |
| Squad Leader-only spawn | leader 解析/roster 注入/指令注入 | 空 squad 失败/无 leader 回退 | ✅ |
| Squad Member 委派 | delegateToRole/resolveWildcardAgent | 未知角色返回 null/overloaded 跳过 | ✅ |
| Squad 负载均衡 | getMemberWorkloads/isAgentOverloaded | 阈值检测/wildcard 排除/null repo | ✅ |
| Squad 动态发现 | getWildcardMembers/expandRoster/resolve | 无匹配返回 unresolved/排除已存在成员 | ✅ |
| SharedContext | set/get/upsert/getMany/list | dag 隔离/delete 不存在/FK cascade/并发读写 | ✅ |
| Agent-to-Agent 消息 | pub/sub/request-reply/heartbeat/priority | 超时拒绝/无效类型/无效 topic/关闭后操作 | ✅ |
| 符号链接逃逸 | 正常路径/safe symlink/非存在文件写入 | 路径穿越/外部 symlink/链式 symlink/目录 symlink | ✅ |
| Group Chat UI | CRUD/消息发送/参与者管理 | < 2 agents 拒绝/空消息不发送/删除 cascade | ✅ |
| Per-task workspace | createForTask/injectFiles/GC/snapshots | 路径逃逸/大小限制/跨 workspace rollback | ✅ |

## 本次新增测试

### SharedContext 并发访问测试 (5 个新用例)

1. **多 agent 交错写入数据一致性** — 3 个 agent 交替写入 10 个 key，验证 last-writer-wins 语义
2. **写后读最新值验证** — 100 次快速递增，验证最终值正确
3. **不同 DAG 并发写入隔离** — dag-A 和 dag-B 交替写入同名 key，验证隔离
4. **删除-写入并发状态正确性** — delete 后立即 set，验证状态恢复
5. **批量写入-批量读取一致性** — 50 个 key 批量写入后批量读取验证

## 发现的问题

无新 bug。全量 1460 测试 0 失败。

## 结论

所有 13 个 Round 2 功能均满足验收标准：
- ✅ 每个功能至少 2 个测试场景（正向+反向）
- ✅ 运行全量回归测试（60 文件，1460 用例，0 失败）
- ✅ 检查测试覆盖率变化（全部高于 50% 阈值）
- ✅ 发现的 bug 创建子 issue（无新 bug）
