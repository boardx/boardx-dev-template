# 并行多 Agent 开发流程（issue 驱动）

> 目标：把全量 features 明确成「可冷启动开发」的 GitHub issues，标好可并行 / 依赖关系，
> 让多个 agent 像一队工程师一样并行开发；所有开发**只按 issue 内容**进行。
> 复用既有 harness 原语（feature_list / claim / sync / verify），只补四条缺失的「轨道」。

## 0. 全景流水线（各阶段复用对应 skill）

```
原始需求/UC ─[requirement-author]→ feature(behavior)
            ─[verification-writer]→ + 可执行验收(verification)
            ─[sprint-planner]→ + depends_on + wave + parallel_safe
            ─[DoR 门控]→ ready-for-dev   （rubrics/ready-for-dev.md）
            ─[harness sync / github-projector]→ GitHub Issue（富正文）
            ─[N 个 agent: claim + worktree]→ 按 issue 验收并行开发
            ─[verify / CI harness-verify]→ DoD 绿 → passing → 关 issue
```

## 1. Definition of Ready（准入）

见 [`.harness/rubrics/ready-for-dev.md`]。issue 必须满足 7 条才 `ready-for-dev`，否则 `needs-spec` 不准开发。

## 2. feature schema 扩展（在现有字段上加 3 个）

现有：`id, priority, area, title, user_visible_behavior, status, sprint, owner, capability, verification[], evidence, notes`。
新增：

| 字段 | 含义 |
|---|---|
| `depends_on: string[]` | 硬前置 feature id；其全部 passing 才解锁本 feature |
| `wave: number` | 依赖拓扑层级（派生，见 §3） |
| `parallel_safe: boolean` | 与同 wave 兄弟改动文件/区域不相交 → 可同时开 |

`status` 增加取值：`ready_for_dev` / `needs_spec`（在 not_started 与 in_progress 之间细分）。

## 3. 依赖 → 并行波次（wave）

1. 由 `depends_on` 建有向无环图（DAG）。
2. 拓扑分层：`wave 0` = 无依赖（**地基**：设计 token、UI 基座组件、data/api schema、auth、app-shell）；
   `wave N` = 依赖全部落在 `< N` 的层。
3. **同一 wave 内**，`area`/文件不相交的 feature → 标 `parallel_safe`，可分给不同 agent 同时开。
4. **铁律**：跨切面地基（token / 基座组件 / 共享 API）必须在 wave 0 先完成，再放下游 → 消除 ~80% 合并冲突。
5. 调度：一个 wave 内的 parallel_safe 批次并行；该批次全 passing 后再放下一批 / 下一 wave。

## 4. GitHub Issue 模型（单向投影，文件仍是事实来源）

**Labels**：`area:<module>`、`wave:<N>`、`status:ready-for-dev|needs-spec|in-progress|passing|blocked`、`parallel-safe`、`cap:<capability>`。

**Issue 正文模板（ready-for-dev，agent 可冷启动开发）**：
```
## 用户可见行为
<user_visible_behavior>

## 验收标准（完成契约 / 可执行）
- [ ] <verification[0]>
- [ ] <verification[1]>

## 设计参照
prototype: <区块/截图>  ·  路由/界面: <interface-operation-inventory 条目>

## 依赖（全绿才可开工）
- [ ] #<blocker issue>  (<feature id>)

## 范围 / 不包含
<notes>

## 证据落盘
<evidence path>

## DoR
- [x] 行为可观察  - [x] 有可执行验收  - [x] 粒度可单会话
- [x] 依赖已解  - [x] 落点+设计参照已定  - [x] 无悬决  - [x] 证据位已定
```

`harness sync` 扩展：只为 `ready:true` 的 feature 开 issue；写入上述富正文 + labels；
`depends_on` 渲染成正文 task-list 的 `#issue` 引用（GitHub 自动显示 blocked-by 关系）。

## 5. 并行 agent 执行模型

- **1 agent = 1 owner**；`pnpm harness claim --phase NN --feature Fxx --owner <agent>` 原子认领，
  每 owner 同时只有一个 in_progress（ADR-001）。N 个 owner = N 路并行。
- **隔离**：每个 agent 在自己的 git worktree / 分支 `feat/<issue-id>` 上工作（避免互踩工作树）。
  worktree 建好后先跑一次 `bash scripts/init-worktree-env.sh`，给这个 worktree 分配独占的
  docker compose 端口 + project name（写入 gitignored 的 `apps/web/.env.local` + 根 `.env`），
  再 `docker compose -f infra/docker-compose.yml up -d`——否则多个 worktree 抢默认端口
  5432/6379 会 "port is already allocated"。
  **对称的收尾动作同样是硬约束，不是可选项**：feature 合并/PR 关闭、不再需要实时验证后，
  必须 `docker compose -f infra/docker-compose.yml down` 释放这一份 postgres+redis+minio。
  见 ADR-007（`docs/adr/ADR-007-docker-stack-teardown.md`）——多个
  worktree 各自留着一份没人用的 docker 栈会累积成真实的 host 级资源耗尽（内存被闲置容器
  占满、postgres 在资源紧张下反复 crash-loop 进恢复模式），这不是假设性风险，是本仓库已经
  实测复现过的故障模式。收尾前跑 `pnpm harness sweep-docker` 核实没有遗留孤儿栈。
  **这条规则不只适用于 feature worker**：任何要落地写文件/提交的 agent 会话（含
  coordinator / module-coordinator / architecture-coordinator）同样必须开独立
  worktree，不得在共享主 checkout 上 `commit`/`stash`/`reset`/`branch -f`/`checkout
  <branch>`；分支建好后立即 `git push -u origin <branch>`，不要等收尾再推。见
  ADR-005（`docs/adr/ADR-005-shared-checkout-isolation.md`）——
  该 ADR 也补了一层机械防护（`reference-transaction` git hook），但文档约定仍是
  第一道防线。
- **Agent 单步循环**（只读 issue，不依赖会话历史）：
  1. `claim` 一个 (ready-for-dev ∩ 当前 wave ∩ unclaimed ∩ area-disjoint) 的 feature。
  2. 读对应 issue：按「验收标准」实现，复用设计 token / 既有组件。
  3. 本地 `pnpm verify:full` 自测（构建 + e2e）。
  4. 开 PR（base=主干），CI `harness-verify` 跑权威门。
  5. CI 绿 → `pnpm harness verify` 置 `passing`（落 evidence）→ 关 issue。
- **编排器（人或主 agent）**：维护「就绪队列」，按 wave + parallel_safe + area 不相交分派给空闲 agent；
  一个 wave 批次全 passing 后再放下一批。

## 6. 完成定义（DoD，沿用 AGENTS.md）

verification 全绿 + evidence 落盘 + `init.sh` 基础验证不破 + 行为端到端可见。CI(`harness-verify`) 是权威门。
`passing` 不可逆，且不能手改——只能由 `harness verify` 门控转移。

## 7. 套用到当前 169 features（feature-breakdown）

`feature-breakdown.json` 已有 behavior + 初步 ui/status（gap）。补齐顺序：
1. **地基 wave 0 先定**：设计 token（已建）、UI 基座（已建）、data/api、auth、app-shell。
2. 逐模块补 `verification`（verification-writer）+ `depends_on`/`wave`/`parallel_safe`（sprint-planner）。
3. 跑 DoR → 合格的 flip `ready_for_dev`。
4. `harness sync` 分批投影 issue（建议按 wave 分批，不要一次开 169 个）。
5. 按 wave 启动并行 agent 开发。

## 8. 跨 agent 认领锁

> **2026-07-08 起（ADR-009）**：跨会话认领互斥由 coord-service (D1) 承担——label
> 没有 compare-and-swap，两个 agent 抢同一个 issue 可能都"成功"，这正是 D1
> `uq_active_claim` 唯一索引要解决的原始问题。GitHub label 认领锁（旧 §8）退役。

现行：
1. **认领**：`pnpm harness claim --phase NN --feature Fxx --owner <id>`（feature_list
   原子归属，ADR-001，不变）。跨会话互斥以 D1 claim 为准（`issue:<n>` resource）。
2. **状态可见性**：`status:*` label 继续由 `sync-github.ts` 从 feature_list 单向投影
   （叙述层）；但**不要**把 label 当锁读——判断"是否已被认领"看 feature_list 的
   `owner` 字段与 D1 claims，不看 label。
3. **完成/放弃**：feature_list 状态流转照旧（verify 门控 / 回退 not_started），
   sync 会把 label 投影跟上。

~~旧机制（GitHub label 分布式锁，已退役，仅历史记录）：领取前查 `status:in-progress`
label → 领取即改 label → 完成关 issue → 放弃回退 label。~~
