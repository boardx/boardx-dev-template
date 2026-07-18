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

### Step 0 — 挂上你的 loop（ADR-014，先做这个）

**module-coordinator 的 loop 周期 = 15 分钟**，每个 loop 跑一条命令：

```bash
pnpm harness tick --session coord-<你的模块>
# 权威时钟（不信本机 date）+ 时钟漂移告警 + 续模块租约（防静默过期）+ 拉任务收件箱
```

每 tick 除 tick 外还做：本模块收件箱/PR 队列扫一眼、首轮 review、按需派子 agent。
每 3h C-cycle 边界发 cycle-plan/result + 补漏模块 skill 的经验回流。
实现随 runtime（CC 用 /loop 或 Monitor，Codex 用等价物，cron 亦可）。

### Step 1 — 确认身份与领域
**先读你模块的活知识库 `.agents/skills/mod-<模块名>/SKILL.md`**（代码地图/契约/前人踩坑），
并承担它的 C-cycle 复盘义务：每周期检查本模块合并的 PR，有经验没回流的补写进去
（ADR-010 "SOP 持续迭代"的落点）。

读 `.harness/agents/registry.yaml` 里 `kind: module-coordinator` 的对应条目，确认自己的
`id`（如 `coord-collab`）和 `areas`（如 `[collaboration]`）。只处理这些 area 的 issue/PR，
不越界碰其他模块的文件——跨模块热点（如 `apps/web/app/(app)/rooms/[id]/members/page.tsx`
同时被 room 和 invite 域碰）交给 coord-main 仲裁，不要自己抢着改。

### Step 2 — 唯一性握手（同模块防双协调）

**2026-07-08 起（ADR-009）**：唯一性由 coord-service (D1) 的 `role:coord-<module>`
claim 裁定，需要 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 凭据（没有就先找人类或
coord-main 领取，无凭据无法担任 module-coordinator）：
```bash
pnpm harness module-lock-status --module <name>   # 权威状态：谁持有、心跳多久前
```
- **被占且心跳新鲜** → 禁止启动，联系现任或等 sweeper 过期回收。
- **空闲/已过期** → Step 3 直接认领。
- ~~lease issue（label `coordination:lease:<module>`）+ 评论仪式~~ 已退役；存量
  lease issue（#351/#352 等）保留为历史记录，不再读写，也不需要为新模块创建。

### Step 3 — 认领 + 向 coord-main 报到
1. `pnpm harness module-lock-acquire --module <name> --session <id>`（如
   `--module collab --session coord-collab`）——直接对 D1 做原子认领
   （uq_active_claim 唯一索引判定，两个会话抢恰好一个成功），不再发任何
   GitHub 评论。认领冲突（409）说明别人刚抢先，不要重试抢占。
2. 在协调叙述 issue（如 #323）下留一条人类可读的报到评论，声明自己接管哪个模块、
   当前 areas 里有哪些在途 issue/PR——coord-main 靠这个知道你存在（叙述层，
   非权威；权威在 D1）。

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
> （`docs/adr/ADR-005-shared-checkout-isolation.md`）。

### Step 6 — 心跳与巡检
沿用顶层 coordinator 的 L0(60s 事件)/L2(15min 巡检+心跳)节奏，范围限于自己 areas。
**明确适用**：`.harness/instructions/coordinator-sop.md`"Deadline 与分级补救"表 + 铁律 #6
（不可静默等待）对 module-coordinator 和 coord-main 一视同仁——发现自己模块下的 lease
停滞（如 worker 认领锁 6h 无进展），必须先在总线上贴出带明确时限的通牒，窗口到期仍无
可验证进展才回收重分派，不能只是"注意到了"就默默等，也不能不打招呼直接回收（先例：
coord-board 对 #282 给 2 小时窗口）。
心跳：每个 L2 tick 跑 `pnpm harness module-lock-heartbeat --module <name>
--session <id>`（写 D1，新鲜度由服务端 sweeper 按 ttl 裁定；命令报错 = 租约异常，
必须处理不能吞掉）。~~lease issue 心跳评论~~ 已退役（ADR-009）。

**C-cycle 义务（2026-07-08 起，见 work-cycle-proposal.md + coordinator-sop.md
C-cycle 章节）**：每个 3h 周期（UTC 整点 00/03/06/…锚定）在专用
`[coordination] work-cycle` issue 发 `cycle-plan`（周期开始 10 分钟内，承诺 1-3 件
小批量可验证完成的事，没有就诚实写 none）与 `cycle-result`（done/miss/flow，可与
下周期 plan 合并成一条）。动 hotspots.md 所列文件的 PR 必须在 cycle-plan 申报。
自己 areas 的 WIP（同时 in_progress 的 feature）≤ 2。

## 退位 / 抢占
同顶层 coordinator：退位跑 `pnpm harness module-lock-release --module <name>
--session <id>` 释放 D1 租约；抢占先 `module-lock-status` 确认持有者心跳已过期再
acquire。交接要点在协调叙述 issue 留一条人类可读评论（叙述层，非权威）。

## 边界（module-coordinator 不做什么）
- **不合并 PR**（唯一硬边界）——全绿后转交 coord-main。
- **不跨模块改文件**——碰到跨模块热点，评论说明冲突面，请 coord-main 裁定顺序。
- **不跳过自己领域的门禁**——安全敏感 area（invite/share/auth/billing）必须过 rev-security，
  不因为"自己审过一遍"就降低标准。
- **不新建/停用 worker 身份**——registry.yaml 是控制平面权威，改动走 coord-main。
