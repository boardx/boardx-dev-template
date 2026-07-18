# ADR 010: Agent 组织模型——多级 coordinator + 角色子 agent + 全员注册与性能管理

- 状态: Accepted（人类直接决定，2026-07-09）
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-07-09
- 关联: 建立在 ADR-004（协调总线，协调面已由 ADR-009 迁到 coord-service）、
  ADR-009（coord-service 是唯一协调权威）之上；把此前散落在 registry.yaml 注释、
  各 SKILL.md、multi-agent-coordination.md 里的"谁是什么角色、谁能派谁"正式收敛成
  一个明确的组织模型，并新增两条硬要求：**所有参与开发的 agent（含运行时派生的
  子 agent）必须登记进 coord-service**，以及**每个 agent 按 3 小时周期做性能管理**。

## 背景

BoardX 的开发是 agentic 的：多个 agent 会话像一支工程团队一样并行开发。随着
参与方从"一批 Claude Code 会话"扩展到"人类开发者各自带来的 agent 队伍"，需要一个
清晰、平台无关的组织模型回答三个问题：

1. **有哪几级协调者、各自管什么、边界在哪？**（此前只在 registry.yaml 注释里一句话
   带过，不够正式。）
2. **一个核心 agent 怎么调动更多算力？**——module-coordinator 需要能按需派出承担
   不同专业角色（设计师/架构师/board 开发/ava 开发…）的子 agent，但子 agent 不能是
   项目协调看不见的"影子劳动力"。
3. **怎么保证不断链、持续提效？**——长会话会静默失联、子 agent 会变孤儿、租约会过期。
   需要把"每个 agent 都可见、可度量、可回收"作为不变量，并用固定节拍持续迭代 SOP。

## 决策

### 1. 三级协调者层级（角色与边界正式化）

| 级别 | id / kind | 管辖范围 | 关键权力 | 明确不做 |
|---|---|---|---|---|
| **总协调 main coordinator** | `coord-main` / `coordinator` | 整个项目 | **唯一合并权**；全局分派、wave 调度、跨模块热点仲裁、CI 门禁；对全体 agent（含子 agent）的统一可见性与回收权 | 不写业务代码（拆给下级）；不越过 review 门禁自行合并 |
| **模块协调 module coordinator** | `coord-<module>` / `module-coordinator` | 单个领域（Room / Board / Collaboration / AVA / AI Store & Admin / Survey / Platform 等，见 registry.yaml） | 在自己 areas 内分派+初审+返工裁决；**可派出子 agent**（见 §2）；全绿 PR 转交 coord-main 合并 | **无合并权**；不跨模块改文件（跨模块热点交 coord-main 仲裁顺序） |
| **架构协调 architecture coordinator** | `coord-architecture` / `architecture-coordinator` | 控制平面/协议本身（ADR、SOP、coord-service、registry schema、协作文档） | 迭代 harness 与协作协议；审阅协议级变更 | **无合并权**；不碰产品 feature 的日常分派（那是 coord-main） |

**module-coordinator 是这套模型的核心执行单元**：coord-main 把一个领域整体委托给它，
它对该领域的 worker、issue、PR 品质负责——是"该领域的项目经理 + 首轮技术负责人"。
它的完整职责见 `.agents/skills/module-coordinator/SKILL.md`，要点：认领本模块唯一性
租约（D1）→ 分派本领域工作 → 首轮 review + 返工裁决 → 全绿 PR 转交 coord-main。

### 2. 角色子 agent：module-coordinator 可按需派出，但必须登记

module-coordinator 不必亲自写所有代码——它可以派出**承担特定专业角色的子 agent**
来完成必要工作。角色示例（不封闭，按需扩展）：

- `role:designer`（设计/UIUX）、`role:architect`（架构方案）、
- `role:board-dev` / `role:ava-dev` / `role:room-dev` /…（领域实现）、
- `role:reviewer-*`（专项评审）、`role:verifier`（端到端验证）等。

**硬要求：任何被派出的子 agent，在开始工作前必须登记进 coord-service**（agents 表
一条身份 + 对其工作资源的 claim）。理由：

- **统一可见性**：coord-main 与 dashboard 看到的必须是"全体正在干活的 agent"，
  而不只是几个顶层协调者。看不见的子 agent = 无法度量、无法回收、无法防断链。
- **原子归属**：子 agent 对某个 feature/文件的认领同样走 D1 的 `uq_active_claim`，
  两个子 agent 抢同一资源恰好一个成功，杜绝"影子劳动力互相踩踏"。
- **责任链**：子 agent 的身份带 `parent` 指回派它的 module-coordinator，形成
  可追溯的责任树；父 coordinator 退位/失联时，其子 agent 的租约随之进入可回收状态。

子 agent 身份命名约定：`<parent>.<role>-<n>`（如 `coord-board.designer-1`），
kind 记为 `sub-agent`，带 `parent`、`role`、`spawned_at` 字段。登记方式见
§"实现状态与差距"（当前需手动/脚本登记，自动化是待建项）。

### 3. 全员性能管理：3 小时 C-cycle

**每一个 agent（协调者、worker、子 agent 一视同仁）都受 3 小时工作周期
（C-cycle，见 `work-cycle-proposal.md`）的性能度量与迭代约束**，不是只有协调者发
cycle-plan：

- **节拍**：UTC 整点 00/03/06/09/12/15/18/21 锚定，cycle id = 起始时刻。
- **每周期每 agent 产出**：进入周期时的 `commit`（本周期承诺的 1-3 件可验证完成的
  事）、离开周期时的 `cycle-result`（done/miss/flow）。协调者汇总本领域/全局。
- **唯一硬性成功指标**：**flow time**——PR 从开出到合并的中位时长。不降就砍仪式，
  只留 SLA + Andon（这条退出标准来自 work-cycle-proposal，对全员同样适用）。
- **SOP 迭代是周期的一部分**：每个周期结束，暴露出的低效/质量问题要回流成 SOP
  变更（coordinator-sop.md / 各 SKILL.md / 本 ADR 家族的新条目），由 architecture-
  coordinator 固化——"不断迭代 SOP 以提高效率和质量"是本模型的常态机制，不是一次性的。

### 4. 防断链（不变量）

"断链"= 有 agent 在干活但协调层看不见/管不着，或会话静默失联后资源无人回收。
本模型用三条机制杜绝：

1. **acquire-or-renew 每 tick 续约**（ADR-009 + 租约语义定稿）：每个 agent 每个
   监控 tick 对自己的租约续约；租约新鲜度由 D1 sweeper 按 ttl 机械裁定，会话没在
   tick = 租约正常过期回收 = 席位/认领诚实显示为空缺，下个活跃 tick 自愈。
   **席位间歇性空缺是诚实信号，不是故障**；不代跑别人的心跳、不为了显示连续而调大 ttl。
2. **全员登记 = 全员可回收**：子 agent 也在 D1，父 coordinator 失联后其子树租约
   一并进入可回收状态，coord-main 可统一回收重分派——没有任何"游离在 D1 之外"的活。
3. **叙述与权威分离**：租约/心跳/事件的权威在 coord-service；人类可读叙述（站会、
   Andon、事故复盘）在协调叙述 issue（如 #323）。两者都不留在会话记忆里——任何
   agent 冷启动只读 D1（权威）+ 叙述 issue（上下文）即可续上，会话死亡不丢协调状态。

## 实现状态与差距（诚实分层）

**已落地**：
- 三级 coordinator 层级、各自 SKILL.md、合并权独占（ADR-004/009 + 各 SKILL）。
- coord-service 是认领/心跳/租约唯一权威；acquire-or-renew、sweeper 机械回收、
  dashboard 全员可见（ADR-009，`/admin/coordination`）。
- C-cycle 节拍 + cycle-plan/result + flow-time 指标 + cycle-report 工具
  （work-cycle-proposal，PR #454）。

**目标已定、实现待建（本 ADR 立此为准，后续拆 issue 实现）**：
- **子 agent 自动登记**：目前 coord-service 的 agents 表由 `seed-agents.ts` 从
  registry.yaml 批量登记顶层身份；运行时经 Agent 工具派生的子 agent **尚未**自动
  写入 D1。需要：(a) registry schema 增加 `kind: sub-agent` + `parent`/`role`/
  `spawned_at` 字段；(b) 一个"派子 agent 即登记"的封装（module-coordinator 派活时
  自动 POST 一条 agent + claim），或最简可用版——module-coordinator 手动为其子
  agent 登记。在自动化落地前，**module-coordinator 有责任手动保证其派出的子 agent
  在 D1 有身份 + claim**，不得让子 agent 游离在 D1 之外干活。
- **per-agent flow-time 归因**：cycle-report 目前聚合全局 flow time，尚未按
  agent/子 agent 细分归因。性能管理到"每个 agent"粒度需要 cycle-report 扩展。

这两项差距是本 ADR 之后 architecture-coordinator 与 coord-main 的协作实现项，
在此显式记录，避免把"目标模型"误读成"已完成能力"。

## 后果

正面：
- 人类带 agent 加入有了明确入口（配套 `human-developer-onboarding.md`）：知道自己的
  agent 是哪一级、职责边界、怎么登记、怎么被度量。
- "全员登记 + 全员可回收"消除影子劳动力，coord-main 的统一管理有了完整的对象集合。
- 性能管理下沉到每个 agent + SOP 周期迭代，把"提效提质"从口号变成有指标、有节拍的机制。

负面 / 需注意：
- 子 agent 登记在自动化落地前是 module-coordinator 的手动责任，有遗漏风险——这正是
  差距项要尽快补自动化的原因；在此之前靠 SOP 纪律 + dashboard 抽查兜底。
- 每层每 agent 都要续约 + 发周期条目，有仪式开销；退出标准（flow time 不降就砍仪式）
  是对过度仪式的机械刹车。
- 三级 + 子 agent 树增加了角色复杂度；边界表（§1）+ 责任树（§2 的 parent 链）是
  控制这种复杂度的手段，任何新角色都要在这两处有明确位置，不允许"来路不明的 agent"。

## 备选（已否决）

- **只保留两级（main + worker），不设 module/子 agent**：无法承接"人类各自带一支
  agent 队伍、每支自我组织"的规模；否决。
- **子 agent 不登记，由 module-coordinator 内部自管**：违反"全员可见 + 全员可回收"
  这个防断链的核心不变量——协调层看不见的活等于不存在的活，一旦父会话失联即成
  无主孤儿；否决。人类明确要求子 agent 也必须登记进 coord-service。
