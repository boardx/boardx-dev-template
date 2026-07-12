# ADR 011: coord-service 成为唯一身份权威——GitHub 登录自助 onboarding，registry.yaml 降级为派生快照

- 状态: Proposed（人类已拍板方向与两个关键岔路，2026-07-09；同日修订岔路一——
  registry.yaml 不彻底退役，改为 D1 派生的只读快照同步回仓库，理由见决策 §1；
  实现分阶段，未开工）
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
1. **coord-service (D1) 是唯一身份权威；registry.yaml 降级为 D1 派生的只读快照，
   持续同步回仓库**（人类先选"彻底退役"、同日基于"仓库即唯一事实来源"硬约束修订
   为本方案）。身份的建/改/停用只发生在 coord-service；由 coord-main（或其触发的
   export 命令 `pnpm harness registry-export`）在身份变更后/每个周期把 D1 agents
   表导出为 registry.yaml 提交回仓库。文件头标注"脚本派生，禁止手改"——与本仓库
   已有的 active-features.json 惯例完全同构（feature_list 是权威，active-features
   是派生只读视图；这里 D1 是权威，registry.yaml 是派生只读视图）。
   收益：git diff 保留完整身份变更史（审计不降）；"仓库即唯一事实来源"原则通过
   同步快照维持（仓库里永远有一份最新身份事实）；harness CLI 继续像今天一样读
   本地文件——**派生快照本身就是离线缓存**，不再需要单独的 gitignored 缓存机制。
2. **自助 GitHub OAuth onboarding**：`develop.boardx.us`（或 Worker 子路径）提供
   引导式注册 UI，工程师 GitHub 登录后选角色（module-coordinator）、选模块/areas、
   填职责，提交即在 coord-service 建一条 **pending** 身份。
3. **审批走 GitHub issue（人类选择）**：自助流程自动开一个 `onboarding` issue
   （复用现有 GitHub 功能）作为审批凭证 + 审计留痕；pending 身份发的 token 权限
   受限（只能读、不能认领关键资源），coord-main 或仓库所有者在 issue 上 approve
   （评论或 dashboard 按钮）后身份转正、token 提权。
4. **子 agent 走同一自助 API 自动登记**（收口 ADR-010 的手动登记差距）：
   module-coordinator 派子 agent 时经 API 自动建 sub-agent 身份 + claim，不再靠手动。
5. **开发者（Developer，人类）是一等实体，与 agent 配对但不等同**（人类补充拍板，
   2026-07-09）：
   - 数据模型：新增 `developers` 表（github_login 主键、姓名、头像、加入时间）；
     `agents` 表增加 `owner`（→ developers.github_login，**必填**）。每个 agent
     必须归属一个人类开发者——开发者带来他的 agents，onboarding 时 GitHub 登录
     先建/关联 developer，再在其名下建 agent 身份。
   - **两条并存且不可混淆的关系**：`owner`（agent → 人类，归属/问责链）与
     `parent`（sub-agent → agent，派生树，ADR-010）。回收语义各自独立：父 agent
     失联回收其子树租约；开发者退出则其名下全部 agents 停用。
   - **呈现约定（对门户等一切 UI 有约束力）**：开发者永远以人类形态呈现
     （👤 姓名/@github，分组头/身份 chip），**绝不作为 agent 行出现**；agents
     （🤖）分组挂在其开发者之下；当前登录开发者标"我"。开发者的"表现"是其
     agents 表现的聚合视图，不是独立的 agent 指标。

### 与"仓库即唯一事实来源"的关系（修订后不再是原则冲突）
修订后的方案**不违反** AGENTS.md 第一条硬约束：仓库里始终有一份由 D1 同步来的
registry.yaml 快照，身份事实"看得见、可 diff、离线可读"。三层保障：
- **审计双轨**：git diff 保留每次身份变更的可读历史（快照提交）；coord-service
  `events` 表（只增不改）+ onboarding issue 保留细粒度生命周期与审批轨迹。
- **离线**：harness CLI / sync-github 继续读本地 registry.yaml（就是快照），
  coord-service 不可达不影响"这个 id 是谁"的读取；认领类操作仍按 ADR-009
  fail-closed，两不相扰。
- **防漂移**：快照文件头标注"派生只读，禁止手改"；export 命令幂等，手改会在下次
  导出被覆盖并在 diff 中暴露。同步职责归 coord-main（它有仓库写入权与合并权），
  同步动作本身是机械导出，不需要每次走 PR review（同 active-features.json 惯例）。

## 分阶段实现（多 PR，每阶段可独立验证，不 big-bang）

- **P1 — 身份 API + export 命令（零行为变化）**：coord-service 加 authed 身份 CRUD
  端点；新增 `registry-export` 命令并验证"D1 → registry.yaml"往返一致（以现有
  registry.yaml seed 的 D1 导出后 diff 为空）。CLI 读取路径完全不动。
- **P2 — GitHub OAuth + onboarding UI**：Worker 接 GitHub OAuth；`/onboarding`
  引导式页面，登录后自助建 pending 身份。
- **P3 — issue 审批闭环**：自助注册自动开 onboarding issue；approve（issue 评论
  webhook 或 dashboard 按钮）→ 身份转正 + token 提权。pending token 权限受限。
- **P4 — 角色翻转：registry.yaml 变为派生快照**：新增 `pnpm harness registry-export`
  （D1 → registry.yaml，幂等），文件头改标"脚本派生，禁止手改"；coord-main 的
  周期职责加一条"身份变更后同步快照"。消费方（`claim`/`lock-*`/`sync-github`/
  dashboard registry 卡片）**不需要改读取方式**——它们继续读 registry.yaml，只是
  该文件从"手改权威"变成"D1 派生快照"。（相比原方案少了整批消费方迁移，实现面
  显著缩小。）
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
- **权威与快照存在同步窗口**——D1 变更到快照提交之间，仓库里的 registry.yaml
  短暂滞后（分钟到一个周期级）。对身份读取这是可容忍的（新身份在转正前本就受限）；
  规范上以 D1 为准、快照为读缓存，AGENTS.md 补一句"registry.yaml 是 D1 派生快照"
  即可，不再需要例外条款。
- **引入 GitHub OAuth**（Worker secret + 回调 + 会话），是 coord-service 至今最大的
  新增攻击面；pending/受限 token 分级 + issue 人工审批是缓解，但 OAuth 配置错误
  的后果比现在的静态 token 大。
- **同步职责集中在 coord-main**——它失联期间新身份不会出现在快照里（D1 与
  dashboard 仍可见，只是 git 侧滞后）。可接受：身份变更频率低，且 export 命令
  任何有仓库写入权的会话都能代跑。
- 这是多 PR 的大建设；P1（缓存层，零行为变化）先行、可随时叫停，避免未完成的
  中间态影响现有会话。

## 备选（已否决）
- **彻底退役 registry.yaml、身份只在 D1**（人类最初的选择，同日修订推翻）：
  违反"仓库即唯一事实来源"硬约束，且迫使所有消费方改造读取路径 + 另建缓存机制。
  修订为"D1 权威 + git 派生快照"后，原则保住、实现面反而更小。
- **GitHub 登录即信任、零审批**：人类选了走 issue 轻量审批，保留一道人类把关 +
  审计留痕，否决零审批。
