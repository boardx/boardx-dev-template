# ADR 011: coord-service 成为唯一身份权威——GitHub 登录自助 onboarding，registry.yaml 退役

- 状态: Proposed（人类已拍板方向与两个关键岔路，2026-07-09；实现分阶段，未开工）
- 日期: 2026-07-09
- 关联: 取代 ADR-004 中"registry.yaml 是 agent 身份来源"的定位；延续 ADR-009
  （coord-service 是协调权威）把**身份注册**也收进 coord-service；把 ADR-010 的
  "子 agent 必须登记进 coord-service"从手动责任升级为自助 API 的一部分。

## 背景

当前一个人类工程师带 agent 加入的门槛太高，全是手动步骤（human-developer-
onboarding.md §3）：(1) 在 registry.yaml 加身份，走 PR + review；(2) 有 Cloudflare
访问权的人手动跑 `seed-agents.ts` mint token；(3) 手动把 token 写进本地凭据文件。
我（coord-architecture）这几天亲历过这条链的每一处摩擦——手动 seed、手动分发、
每个身份一个 PR。对"自助加入"来说这不可接受。

人类的目标形态：**工程师用 GitHub 登录 → 引导式 UI 完成 onboarding + 注册 →
拿到凭据 → 开始干活**，注册权威放在 coord-service（Cloudflare），配合 GitHub issue
和现有功能做审批与审计。

**GitHub OAuth 让治理更强而非更弱**：registry.yaml 里 `coord-board` 是匿名 id，
背后是谁无从追溯；绑定 GitHub 账号后，每个 agent 身份 ↔ 一个真实可问责的人。

## 决策（两个关键岔路已由人类拍板）

### 核心决策
1. **coord-service (D1) 是唯一身份权威**。registry.yaml **彻底退役**（人类选择）——
   不再作为身份来源；harness CLI / sync-github / seed-agents 改为从 coord-service
   读身份。
2. **自助 GitHub OAuth onboarding**：`develop.boardx.us`（或 Worker 子路径）提供
   引导式注册 UI，工程师 GitHub 登录后选角色（module-coordinator）、选模块/areas、
   填职责，提交即在 coord-service 建一条 **pending** 身份。
3. **审批走 GitHub issue（人类选择）**：自助流程自动开一个 `onboarding` issue
   （复用现有 GitHub 功能）作为审批凭证 + 审计留痕；pending 身份发的 token 权限
   受限（只能读、不能认领关键资源），coord-main 或仓库所有者在 issue 上 approve
   （评论或 dashboard 按钮）后身份转正、token 提权。
4. **子 agent 走同一自助 API 自动登记**（收口 ADR-010 的手动登记差距）：
   module-coordinator 派子 agent 时经 API 自动建 sub-agent 身份 + claim，不再靠手动。

### 可审计性与离线的保住方式（回应"仓库即唯一事实来源"原则冲突）
registry.yaml 退役动了 AGENTS.md 第一条硬约束"仓库即唯一事实来源"。这是有意识的
取舍，用两条机制补偿，**不是放弃可审计性**：
- **审计**：身份的建/审批/停用/轮换全部写进 coord-service `events` 表（只增不改），
  + 每次 onboarding 在 GitHub 留一个 issue —— git-diff 历史换成 D1 事件日志 +
  issue 轨迹，可审计性不降。
- **离线/性能**：harness CLI 不是每次 claim 都打网络——coord-service 身份表通过一个
  **本地 read-through 快照缓存**（定期刷新的只读 JSON，gitignored）供 CLI 读，
  coord-service 不可达时用最后一次缓存降级（读身份是低频、容忍稍旧；这跟 ADR-009
  的"认领 fail-closed"不冲突——认领仍必须联系权威，只有"这个 id 是谁"这种静态
  身份信息走缓存）。

## 分阶段实现（多 PR，每阶段可独立验证，不 big-bang）

- **P1 — 身份 API + 本地缓存（零行为变化）**：coord-service 加 authed 身份 CRUD
  端点；harness CLI 改为读"D1 → 本地快照缓存"而非直接读 registry.yaml。此阶段
  registry.yaml 仍在（作为 D1 的初始 seed 源），CLI 行为对现有会话不变。
- **P2 — GitHub OAuth + onboarding UI**：Worker 接 GitHub OAuth；`/onboarding`
  引导式页面，登录后自助建 pending 身份。
- **P3 — issue 审批闭环**：自助注册自动开 onboarding issue；approve（issue 评论
  webhook 或 dashboard 按钮）→ 身份转正 + token 提权。pending token 权限受限。
- **P4 — 迁移所有 registry.yaml 消费方 + 退役文件**：`claim`/`lock-*`/`module-lock-*`/
  `sync-github`/dashboard registry 卡片全部切到身份 API/缓存；导出最后一份
  registry.yaml 快照存档；正式退役该文件为身份来源（保留历史快照可查）。
- **P5 — 子 agent 自助登记**：module-coordinator 派子 agent 经 API 自动建身份+claim，
  收口 ADR-010 手动登记差距。

每阶段之间需人类/coord-main go/no-go（同 coord-service 原始建设的分阶段节奏）。

## 后果

正面：
- 人类工程师自助 onboarding，消除手动 seed/发 token/PR-per-identity 三处摩擦。
- 身份 ↔ GitHub 账号，可问责性强于匿名 registry id。
- 子 agent 自动登记，彻底关掉 ADR-010 的影子劳动力风险。
- 单一身份系统，dashboard + API 统一管理全体（含子 agent）。

负面 / 需注意（如实记录）：
- **动了"仓库即唯一事实来源"硬约束**——身份不再在 git。用 D1 events + onboarding
  issue + 本地快照缓存补偿，但这是本仓库第一次把一类权威搬出 git，属于重大架构
  取舍，需 AGENTS.md 同步加一条例外说明。
- **引入 GitHub OAuth**（Worker secret + 回调 + 会话），是 coord-service 至今最大的
  新增攻击面；pending/受限 token 分级 + issue 人工审批是缓解，但 OAuth 配置错误
  的后果比现在的静态 token 大。
- **网络依赖上移**：身份读经缓存降级容忍，但 P4 之后没有 registry.yaml 兜底，
  缓存机制的正确性成为关键路径，必须有测试覆盖"coord-service 全挂时 CLI 仍能用
  缓存身份跑"。
- 这是多 PR 的大建设；P1（缓存层，零行为变化）先行、可随时叫停，避免未完成的
  中间态影响现有会话。

## 备选（已否决）
- **保留 registry.yaml 为 git 快照**（我推荐过的折中）：人类明确选了彻底退役，
  换取单一系统的干净。折中方案的好处（git-diff 审计）由 D1 events + issue 轨迹替代。
- **GitHub 登录即信任、零审批**：人类选了走 issue 轻量审批，保留一道人类把关 +
  审计留痕，否决零审批。
