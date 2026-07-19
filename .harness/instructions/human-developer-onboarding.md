# 人类开发者上手指南：带你的 agent 加入 BoardX 开发

> 目标读者：**人类开发者**（不是 agent）。你想带着自己的一支 agent 队伍参与 BoardX
> 的开发，这份文档告诉你：这个项目是怎么用 agent 协作的、有几级协调者、你的 agent
> 该是哪一级、怎么登记接入、怎么被统一管理和度量。
>
> 权威规格见 **ADR-010**（`docs/adr/ADR-010-agent-org-model.md`）；
> 本文是它的可读操作版。**交给你 agent 的接入执行书是 `agent-bootstrap.md`**
> （见 §3.5）；`agent-onboarding-checklist.md` 是平台无关的规则清单，两份都面向
> agent，不是给你读的。
>
> 网页入口：**https://develop.boardx.us/portal → "加入开发" tab** 有本文的引导式
> stepper 版（含每步预计耗时与审批 SLA），第一次来建议从那里开始。

## 0. 一分钟理解这个项目的开发模式

BoardX 的开发不是"一个人写代码"，而是**一支 agent 团队并行开发**，像一个工程组织：

```
        人类（你 + 仓库所有者）
                │  带来 / 授权
                ▼
  ┌─────────────────────────────────────────────┐
  │  总协调 coord-main（唯一，独占合并权）          │
  │     ├─ 模块协调 coord-board（Board 领域）        │
  │     │     ├─ 子 agent role:designer            │
  │     │     ├─ 子 agent role:board-dev           │
  │     │     └─ 子 agent role:verifier            │
  │     ├─ 模块协调 coord-ava（AVA 领域）…           │
  │     └─ 架构协调 coord-architecture（协议本身）    │
  └─────────────────────────────────────────────┘
                │  全员登记 + 全员可见
                ▼
     coord-gateway（按仓 RepoHub Durable Object，ADR-017）← 唯一协调权威
     门户: https://develop.boardx.us/portal
```

两条贯穿全局的铁律，先记住：

- **协调权威在 coord-gateway（按仓 RepoHub DO），不在 GitHub**。认领谁在做什么、
  租约新不新鲜，都由它裁定（协议语义 ADR-009，载体 ADR-017；旧 coord-service D1
  已于 2026-07-18 割接退役）。GitHub issue 只用于 feature 规格 + 人类可读
  的叙述/讨论，不再是协调锁。
- **看不见的活等于不存在的活**。任何在干活的 agent（包括临时派出的子 agent）
  必须在协调层有身份 + 认领记录，否则它就是无法度量、无法回收的"影子劳动力"，
  这是本项目明确禁止的（ADR-010 防断链不变量）。

## 1. 三级协调者：你的 agent 是哪一级？

| 级别 | 一句话职责 | 谁来当 | 有没有合并权 |
|---|---|---|---|
| **总协调 main coordinator**（`coord-main`） | 管整个项目：全局分派、跨模块仲裁、**唯一能合并 PR 的人** | 全仓唯一一个，通常是仓库所有者授权的核心会话 | ✅ 唯一 |
| **模块协调 module coordinator**（`coord-<模块>`） | 管一个领域（Board / AVA / Room / Survey / Platform…）：分派本领域的活、首轮 review、派子 agent 干活 | **你带来的核心 agent 通常就当这个** | ❌（全绿转交 coord-main 合并） |
| **架构协调 architecture coordinator**（`coord-architecture`） | 管协议/控制平面本身：ADR、SOP、coord-gateway/harness、协作文档 | 通常一个，负责让协作规则本身持续演进 | ❌ |

**你带自己的 agent 加入，最常见的定位是 module coordinator**——认领一个模块领域，
对它负责。下面按这个主线讲怎么接入。

## 2. module coordinator 是核心：它的职责与能力

module coordinator 是"该领域的项目经理 + 首轮技术负责人"，职责必须清楚（完整仪式见
`.agents/skills/module-coordinator/SKILL.md`）：

**它必须做的**：
1. **认领本模块的唯一性租约**（RepoHub DO）：`pnpm harness module-lock-acquire --module <名>
   --session coord-<模块>`，之后每个巡检周期续约（acquire-or-renew）。同一模块同一
   时刻只应有一个 module-coordinator，由 coord-gateway（DO 单线程）的原子认领保证。
2. **分派本领域的开发工作**给 worker 或自己派出的子 agent；管 issue、管 PR 品质。
3. **首轮 review + 返工裁决**：本领域的 PR 先由它把关；敏感 area（auth/billing/
   admin/share/invite）强制过安全评审，不因"自己审过"降低标准。
4. **全绿 PR 转交 coord-main 合并**——它自己**没有合并权**，这是保住"合并唯一把关人"
   的不变量。
5. **每 3 小时周期**发 cycle-plan（承诺 1-3 件可验证完成的事）+ cycle-result
   （done/miss/flow），接受 flow-time 度量（见 §4）。

**它可以做的（核心能力）——派角色子 agent**：
module coordinator 不必亲自写所有代码，它可以按需派出**承担专业角色的子 agent**：
`role:designer`（设计）、`role:architect`（架构）、`role:board-dev` / `role:ava-dev`
（领域实现）、`role:verifier`（端到端验证）等。**但每个子 agent 必须登记**——见 §3。

**它不做的**：不合并 PR；不跨模块改文件（跨模块热点交 coord-main 仲裁顺序）。

## 3. 接入步骤：把你的 agent（含子 agent）登记进来

### 第 0 步 — 你自己的环境准备（人类动手，一次性）

1. **拿仓库访问权**：向仓库所有者（usamshen）要 `boardx/boardx-dev-template`
   的 collaborator 权限（私有仓，没有权限后面全部免谈）。
2. **本地环境**：Node（版本见 `.nvmrc`）+ pnpm + Docker（e2e 要起 postgres/redis）。
3. **克隆并自检**：
   ```bash
   git clone git@github.com:boardx/boardx-dev-template.git && cd boardx-dev-template
   ./init.sh        # 安装依赖 + 基础验证 + git hooks；失败先修，别带病接入
   ```
4. **登录门户看一圈**：https://develop.boardx.us/portal ——"脉搏与进度"看项目
   现状，"实时协调"看谁在干活，"加入开发"tab 就是本节的引导式版本。

### 第 1 步 — 给你的 module coordinator 建身份

在 `.harness/agents/registry.yaml` 加一条（走 PR + review，这是控制平面变更，不能
自己硬塞）：
```yaml
  - id: coord-<你的模块>
    active: true
    kind: module-coordinator
    model: <你的模型>
    areas: [<该模块的 area 列表>]
    responsibilities:
      - <一句话职责>
```
没把握选哪个模块 / area 命名，在协调叙述 issue（#323）里 @coord-architecture 或
仓库所有者确认。

### 第 2 步 — 领 coord-gateway 凭据（按仓 scoped token）

> 2026-07-14 起（ADR-011 P2）：**worker/module-coordinator 级身份在
> develop.boardx.us → 加入开发 → 第 5 步自助领取**（registry 合并即有资格，
> 无需等人）。2026-07-18 割接（ADR-017）后领到的就是 coord-gateway 的按仓
> scoped token（p29-F08）；旧 coord-service 凭据通道已删除。

领到后存进本机 gitignored 文件（明文只显示一次），你的会话用：
```bash
export COORD_GATEWAY_URL=https://coord-gateway.boardx.workers.dev
export COORD_REPO=boardx/boardx-dev-template
export COORD_API_TOKEN=$(cat <你的 token 文件路径>)
```
**没有凭据 = 无法参与协调**（命令会直接报错）——这是 ADR-009/017 有意的强制换轨，
不是 bug。coordinator 级身份与自助通道故障时找仓库所有者走 gateway 管理面 mint。

### 第 3 步 — 认领模块租约，开始工作
```bash
pnpm harness module-lock-acquire --module <你的模块> --session coord-<你的模块>
```
之后每个巡检周期续约。在 dashboard（develop.boardx.us/admin/coordination）上你会
看到自己的租约出现在 Active Claims 卡片里。

### 第 4 步 — 派子 agent 时，先登记

你派出的每个子 agent，**在它开始干活前**必须在协调层有身份 + 对其工作
资源的 claim。当前自动化尚未落地（见 ADR-010 差距节），所以这是 **module
coordinator 的手动责任**：
- 子 agent 身份命名：`coord-<模块>.<role>-<n>`（如 `coord-board.designer-1`）。
- 为它登记一条 agent（kind: sub-agent，带 parent=你、role、spawned_at）+ 一条
  对其负责的 feature/文件的 claim。
- 子 agent 干完/退出，释放它的 claim。

不登记就派子 agent 干活 = 制造影子劳动力，违反 ADR-010——coord-main 抽查
dashboard 时发现"有活但协调层里没有对应 agent"会追溯到你。

## 3.5 启用你的 agent：第一条消息发什么

身份、凭据、租约都就绪后，启动你的 agent（Claude Code 或任何能读写 git+GitHub
的工具）之前，**先想清楚这个 agent 是哪一级**（§1 的三级协调者）——第一条消息
必须点名角色，不能只说"加入开发"就让它自己猜，否则它默认按 worker 走
`agent-bootstrap.md`，永远不会去挂 coordinator/module-coordinator 该有的 loop
（5 分钟 / 15 分钟，见 `coordinator`/`module-coordinator` skill），也不会去做
唯一性握手——**这是本节修订前的真实缺口**：模板只有一份、只指向 worker 路径，
派它当 module lead 的人也是照抄这份模板，结果新起的"module coordinator"从没
真正认领过角色、没挂 loop，形同虚设。三选一，照对应模板发：

**① 这个 agent 是 main coordinator**（全仓唯一）：
```
你现在是 BoardX 的 main coordinator。先用 coordinator skill 走完整启动仪式
（唯一性握手 + 挂 5 分钟 loop），不要跳过任何一步。你的信息：
- 身份 id：coord-main（已在 registry.yaml 注册）
- 凭据文件：.harness/state/.cache/coord-credentials.json
有任何一步的完成标志达不到，停下来问我，不要猜。
```

**② 这个 agent 是某模块的 module coordinator**：
```
你现在是 BoardX <模块> 模块的 coordinator。先用 module-coordinator skill
走完整启动仪式（唯一性握手 + 挂 15 分钟 loop），不要跳过任何一步。你的信息：
- 身份 id：coord-<模块>（已在 registry.yaml 注册）
- 凭据文件：.harness/state/.cache/coord-credentials.json
- 负责范围：<模块> 模块
有任何一步的完成标志达不到，停下来问我，不要猜。
```

**③ 这个 agent 是干活的 worker**（不担任何协调角色）：
```
你现在加入 BoardX 开发，做 <模块> 模块的一个 feature。先读
.harness/instructions/agent-bootstrap.md，按它逐步执行（含挂 15 分钟 loop）。
你的信息：
- 身份 id：wrk-<模块>-<n>（已在 registry.yaml 注册）
- 凭据文件：.harness/state/.cache/coord-credentials.json
- 任务：phases/<阶段>/feature_list.json 的 <Fxx>
有任何一步的完成标志达不到，停下来问我，不要猜。
```

三条给你（人类）的注意事项：

1. **凭据只给路径，不贴值**。token 明文一旦出现在聊天记录 / issue / PR 里就视为
   泄露，必须去 Cloudflare 轮换（2026-07-09 发生过一次真实泄露，成本是全量换发）。
2. **角色 skill / `agent-bootstrap.md` 是 agent 的执行书**——从冷启动阅读、环境
   自检、接协调平面、挂 loop，到认领 feature、verify 交付、3h 周期汇报、会话
   退出收尾，每步带完成标志和"前人踩过的坑"清单。你不需要逐条教它，指过去即可。
3. **验收它是否真的接入了**：打开 https://develop.boardx.us/portal 的"实时协调"，
   能看到它的租约 = 真的在协调平面上（三个角色都应该有租约，包括 worker）；
   看不到 = 它只是在你的会话里空转，没有真正走完启动仪式。

## 4. 性能管理：每个 agent 都按 3 小时周期被度量

**不是只有协调者被度量——你的每个 agent（含子 agent）都受 3 小时 C-cycle 约束**
（完整设计见 `work-cycle-proposal.md`）：

- **节拍**：UTC 整点 00/03/06/09/12/15/18/21，每 3 小时一个周期。
- **每周期每 agent**：进周期发 `cycle-plan`（承诺本周期可验证完成的 1-3 件事），
  出周期发 `cycle-result`（真完成的 / 没完成的 + 原因 / flow time）。
- **唯一硬指标：flow time**——你的 PR 从开出到合并的中位时长。这是衡量"快不快"的
  唯一标准，仪式遵守率不算数。**flow time 不下降，就砍掉周期仪式、只留 SLA + Andon**。
- **SOP 持续迭代**：每个周期暴露的低效/质量问题，要回流成协作规则的改进（SOP /
  SKILL / ADR），由 architecture-coordinator 固化。"不断迭代 SOP 提高效率和质量"
  是这个项目的常态，你的实践经验也应该反哺进来。

查自己和全队的周期健康：`pnpm harness cycle-report`（只读，输出当前周期承诺/超时/
flow time 趋势）。

## 5. 不断链：会话会死，协调状态不能丢

长会话会静默失联、子 agent 会变孤儿——这个项目用三条机制保证不断链，你要理解并配合：

1. **每 tick 续约（acquire-or-renew）**：每个 agent 每个巡检周期给自己的租约续约。
   会话没在 tick = 租约按 ttl 正常过期回收 = dashboard 诚实显示席位空缺，下个活跃
   tick 自愈。**席位间歇性空缺是诚实信号，不是故障**；不要为了显示连续去调大 ttl，
   也不要替别人代跑心跳（那会掩盖真实的失联）。
2. **全员登记 = 全员可回收**：你的子 agent 的租约也在 RepoHub DO，你（父 coordinator）失联后，
   你的子树租约一并进入可回收状态，coord-main 能统一回收重分派。这就是为什么 §3
   坚持子 agent 必须登记。
3. **状态不留在会话记忆里**：租约/事件的权威在 coord-gateway（RepoHub DO），
   人类可读的叙述在协调叙述 issue（#323）。任何 agent 冷启动只读这两处就能续上——
   会话死了，协调状态不丢。你的 agent 也应遵守：重要状态写进协调层 / 叙述 issue，
   不要只留在自己的上下文里。

## 6. 最小清单（照着做就能接入）

1. [ ] 拿仓库权限 → clone → `./init.sh` 通过（§3 第 0 步）。
2. [ ] 读本文 + ADR-010 + ADR-009/ADR-017（协调权威在 coord-gateway/RepoHub）+ `module-coordinator/SKILL.md`。
3. [ ] 给 module coordinator 在 registry.yaml 建身份（PR + review）。
4. [ ] 在 devportal 自助领取 coord-gateway 按仓 token（只显示一次，只存 gitignored 文件）。
5. [ ] 启动你的 agent，第一条消息用 §3.5 对应角色的模板（main coordinator /
   module coordinator / worker 三选一，不要都发 worker 模板）。
6. [ ] 在 develop.boardx.us/portal"实时协调"里确认它的租约可见。
7. [ ] 派子 agent 前，先给它登记身份 + 协调层 claim。
8. [ ] 每 3 小时周期发 cycle-plan / cycle-result，接受 flow-time 度量。
9. [ ] 每 tick 续约租约；重要状态写协调层 / 叙述 issue，不留会话记忆。
10. [ ] 全绿 PR 转交 coord-main 合并（你和你的 agent 都没有合并权）。
