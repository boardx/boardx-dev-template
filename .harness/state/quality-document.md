# 质量快照(Quality Document)

> 评的是「代码库本身在变强还是变弱」,区别于 evaluator-rubric(评单次 agent 输出)。
> 每轮重要会话后、基准对比前、清理简化后、换模型时更新。

## 产品领域评分(每项 0–2)
| 领域 | 验证状态 | Agent 可读性 | 测试稳定性 | 关键缺口 |
|------|---------|-------------|-----------|---------|
| orchestrator | – | – | – | – |
| tools | – | – | – | – |
| memory | – | – | – | – |

## 架构层评分(每项 0–2)
| 层 | 边界执行 | Agent 可读性 |
|----|---------|-------------|
| apps/orchestrator | – | – |
| packages/agent-core | – | – |
| packages/tools | – | – |
| packages/memory | – | – |

## Harness 简化审计(控制变量排除法)
1. 拍一份本快照。2. 移除一个 harness 组件。3. 跑基准。4. 再拍快照。
5. 评级没降→该组件多余,可移除;降了→恢复。记录每次结论。

## 流程审计（2026-06-30）：harness 流程保真度 + 已加防护

**结论**：骨架原则基本守住，但有 3 类系统性偏差（两类反复发作），均因**缺强制闸门**。

偏差与根因：
1. **流程顺序违规**：phase-04 曾跳过 feature_list/issue 直接写码（用户发现）。根因：无强制。
2. **需求非权威**：phase-04/05 臆造 use case（用户发现"不反映真实需求"）。根因：feature 未溯源 `phases/requirements`。
3. **本地 passing≠无回归（反复）**：`verify:base` 不含 e2e/build，跨阶段回归(change-password)、生产构建错(useSearchParams Suspense) 只有 CI 抓到。根因：本地门控弱于 CI。
4. **lockfile 漂移（反复）**：本机 pnpm 8.5.1 静默把 lockfile 写回 6.0，CI 红 2-3 次。根因：无守卫。
5. **巨量误提交**：`git add -A` 卷入 oldcode 5620 文件，push 卡死。根因：未 gitignore + add -A。

已落地的强制防护（git hooks + 脚本，init.sh 自动安装）：
- **`pnpm verify:full`**（scripts/verify-full.sh）：本地镜像 CI = verify:base + web build + 有 docker 时全量 e2e。
- **pre-push hook**：push 前自动跑 verify:full（跳过 `git push --no-verify`）。挡住 #3。
- **pre-commit hook 三防线**：active-features.json / **lockfile 必须 9.0** / oldcode 或 >800 文件阻断。挡住 #4 #5。
- 待补（流程顺序 #1#2）：feature schema 加 `requirements_ref`；`claim` 拒绝空 verification（强制契约先行）。

## 候选改进 / 待办
- [ ] **#4 统一权限配置源（延后）**：`.claude/settings.json` 与 `.codex/config.toml`
  目前各自手维护同一份 allow/deny 命令清单(约 13 行)，存在配置漂移风险。
  可仿 `gen-subagents` 从单一 YAML 生成。**暂不做**：清单小且几乎不变，且
  `.codex/config.toml` 含权限之外的内容(model/skills/agents 路径)，生成器只能拥有
  一个标记块、复杂度偏高。触发条件：清单真的漂移过一次，或新增第三个权限消费者时再做。
- [ ] **OS 沙箱（#5 硬保证）**：shellTool 当前是 best-effort deny 筛查(见 ADR-002)，
  非隔离边界。落地独立低权用户 + `.harness/` 只读挂载 + 无网络 namespace 后，
  shellTool 才可安全暴露给不可信输入。
- [ ] **并发隔离完整版（#1b/#3）**：session 记忆已按 agentId 隔离(见 ADR-001)，
  但同 sprint 多 owner 共享的 `progress.md`/`session-handoff.md` 与 `durable.json`
  仍可能并发写竞争。等 orchestrator 真支持并发派发、或实测出现 lost-update 时，
  对 durable 上「原子写 + 读时合并」或单写者锁，对 progress/handoff 按 owner 后缀拆分。
