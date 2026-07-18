# ADR 001: 从「全局单 in_progress」放宽到「每 owner 单 in_progress」

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-06-29

## 背景

harness 最初的硬约束是「同一时刻全局只能有一个 feature 处于 `in_progress`」，
用来保证「一次只做一件事、可验证、可交接」。

后续为支持多智能体并行（Claude + Codex + 其他 agent 同时推进不同 feature），
在 `feature_list` 引入了 `owner` 字段，并实现了 `pnpm harness claim` 原子认领。
此时代码（`lib/features.ts` 的 `assertSingleInProgress`）已经按 **per-owner** 放行，
但 AGENTS.md 仍写「全局只能有一个」——文档与已上线代码产生矛盾（drift）。

## 决策

正式放宽硬约束，并让文档与代码一致：

- **有 owner**：每个 owner 同一时刻最多一个 `in_progress`。不同 owner 可并行。
- **无 owner（`owner: null`）**：退化为全局最多一个 `in_progress`，保持单 agent 旧行为。

不变量仍由 `assertSingleInProgress` 统一门控；放宽的是「全局 1 个」→「每 owner 1 个」，
不是取消约束。「一次只做一件事」的精神在 **owner 粒度** 上继续成立。

## 后果

正面：
- 文档/代码 drift 消除，符合「仓库即唯一事实来源」。
- 多 agent 可并行推进不同 feature，吞吐提升。

负面 / 需注意：
- 同一 sprint 多 owner 并行时，共享的进度日志（`progress.md`/`session-handoff.md`）
  与共享的 memory 文件（`.memory/session.json` 等）存在并发写竞态。
  对应缓解见「并发隔离」前向兼容改造（session 按 agent 隔离；durable 暂保持共享，
  待真出现并发写再上锁/合并）。
- `passing` 仍不可逆、仍只能经 `pnpm harness verify` 升级——本 ADR 不触碰该门控。

## 备选（已否决）

- **维持全局单 in_progress**：与已上线的 owner/claim 能力冲突，且堵死并行方向。否决。
- **完全取消单 in_progress 约束**：会丢掉「一次做一件可验证的事」的核心纪律，
  导致半成品堆积、交接质量下降。否决。
