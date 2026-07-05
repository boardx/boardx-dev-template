---
name: module-coordinator
description: >
  激活条件：用户提到 模块 coordinator、子协调者、领域负责人、模块负责、
  Room/Board/Collaboration/AVA/AI Store/Survey/Platform 协调、认领某模块 等关键词时触发。
  引导本会话按唯一性握手认领某个模块（registry.yaml 中 kind: module-coordinator 的一个
  id），在自己 areas 范围内分派+初审，但**不拥有合并权**，PR 全绿后转交 coord-main。
---

# Module-Coordinator Skill — 二级编排者

> 架构（2026-07-04 起）：`coord-main`（唯一合并权，见 `.agents/skills/coordinator/SKILL.md`）
> ↔ N 个 module-coordinator（各领域分派 + 首轮 review + 返工裁决，**无独立合并权**）。
> module-coordinator 是"该领域的项目经理"：管自己 areas 里的 worker、issue、PR 品质，
> 但最终合并动作、跨模块热点仲裁、CI 门禁一律交给 coord-main——这是今晚的教训（canvas/
> collab 两条链因为没有真正的模块所有权，堆到 5 层分支才被发现地基级安全/回归问题）。

## 何时使用
- 人类让本会话"当 <模块> 的 coordinator"（如 Collaboration/AI Store/Survey/Platform）。
- 现任该模块 coordinator 失联（lease 过期），需要接任。
- 冷启动一个新的模块协调会话（只靠总线 + registry.yaml 重建状态）。

## 启动仪式

### Step 1 — 确认身份与领域
读 `.harness/agents/registry.yaml` 里 `kind: module-coordinator` 的对应条目，确认自己的
`id`（如 `coord-collab`）和 `areas`（如 `[collaboration]`）。只处理这些 area 的 issue/PR，
不越界碰其他模块的文件——跨模块热点（如 `apps/web/app/(app)/rooms/[id]/members/page.tsx`
同时被 room 和 invite 域碰）交给 coord-main 仲裁，不要自己抢着改。

### Step 2 — 唯一性握手（同模块防双协调）
lease issue label 用 `coordination:lease:<module>`（如 `coordination:lease:collab`），
其余同顶层 coordinator 的 Step 1（新鲜心跳则禁止启动、否则可认领）。

> **不存在对应 lease issue 时，直接创建，不需要额外的人类授权。**
> `coordination:lease:<module>` 已经是 `multi-agent-coordination.md` §1.2 登记在案的
> 规范 label——建这个 issue 是在**执行**已确立的协议，不是**提出**新协议，两者标准
> 不同：后者（改 registry.yaml schema、新增协调角色种类等）才需要走 coord-architecture
> 审阅。2026-07-04 夜间的实践里，当晚在 #323 报到过的五个模块 coordinator（room/board/
> collab/ava/platform；registry.yaml 另注册的 store-admin/survey 当晚未报到，不在此列）
> 对这一步的处理并不一致（coord-room/coord-platform 直接建了 #351/#352；coord-board/coord-collab/coord-ava
> 出于谨慎选择不建、退化为沿用旧的 `agent:<id>` 认领机制）——这是本条澄清要消除的
> 具体分歧，此后统一为"直接建，不必等批准"。

### Step 3 — 认领 + 向 coord-main 报到
1. lease issue 评论 `module-coordinator-claim by:<id> at <ISO8601>`——推荐直接跑
   `pnpm harness module-lock-acquire --module <name> --session <id>`（如
   `--module collab --session coord-collab`），它会自动按
   `coordination:lease:<module>` label 找到 lease issue 并发这条格式完全一致的
   评论；手打 `gh issue comment` 依然完全等效，这条命令只是省得每次手拼格式。
   若设置了 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN`（coord-service 迁移
   Phase 3+，见 `packages/coord-service`），命令还会顺带做一次 opt-in 的
   dual-write；不设这两个环境变量就是零行为变化，GitHub 评论始终是 Phase 5
   cutover 之前的唯一权威。
2. 在总的 coordinator lease issue（`coordination:lease`）下留一条报到评论，声明自己
   接管哪个模块、当前 areas 里有哪些在途 issue/PR——coord-main 靠这个知道你存在。

### Step 4 — 冷启动读总线（限定 areas）
```bash
gh issue list --state open --label area:<your-area> --json number,title,labels
gh pr list --state open --json number,headRefName,baseRefName,statusCheckRollup
```
只看自己 areas 的 issue；PR 按 `headRefName`/`baseRefName` 前缀（如 worker 分支名含
你的模块关键词）粗筛，不确定归属的向 coord-main 确认。

### Step 5 — 分派 + 初审循环
1. **分派**：`ready-for-dev` ∩ 自己 areas ∩ 依赖已 passing → 分派给自己模块下的 worker
   （认领双写：`harness claim` + label）。
2. **PR 开出 → 首轮 review**：调 code-reviewer / feature-evaluator（按 area 路由，见
   registry.yaml 的 reviewer required_for）；invite/share/auth 等敏感 area 也要 rev-security。
3. **CHANGES → 返工裁决**：写清楚阻断项，worker 推送后复核，跟顶层 coordinator 一样
   "证据实测 > 声称"——git ls-tree 核实 evidence，不信任 diff 注释。
4. **全绿 → 转交，不自己合并**：在 PR 评论 @coord-main（或对应总协调会话），写明：
   review 结论、CI 状态、是否 mergeable、有无跨模块热点冲突风险。**到此为止**，
   合并动作、squash、置 status:merged 由 coord-main 执行。

> 分派/初审只涉及 `gh` 命令 + 只读 git 查阅，不需要 worktree；但一旦要自己落地改代码
> （如 coord-collab 处理 stale 认领时直接代劳修复），必须先 `git worktree add` 开
> 独立工作区，不得在共享主 checkout 上 commit/reset/stash——见 ADR-005
> （`phases/phase-01-foundation/adr/ADR-005-shared-checkout-isolation.md`）。

### Step 6 — 心跳与巡检
沿用顶层 coordinator 的 L0(60s 事件)/L2(15min 巡检+心跳)节奏，范围限于自己 areas。
心跳评论同样可以用 `pnpm harness module-lock-heartbeat --module <name> --session <id>`。

## 退位 / 抢占
同顶层 coordinator：`module-coordinator-release`/`module-coordinator-takeover` +
`<ISO8601>`，写在自己模块的 lease issue 上；同时在总 lease issue 留一条注销/交接评论。
退位评论可以用 `pnpm harness module-lock-release --module <name> --session <id>`。

## 边界（module-coordinator 不做什么）
- **不合并 PR**（唯一硬边界）——全绿后转交 coord-main。
- **不跨模块改文件**——碰到跨模块热点，评论说明冲突面，请 coord-main 裁定顺序。
- **不跳过自己领域的门禁**——安全敏感 area（invite/share/auth/billing）必须过 rev-security，
  不因为"自己审过一遍"就降低标准。
- **不新建/停用 worker 身份**——registry.yaml 是控制平面权威，改动走 coord-main。
