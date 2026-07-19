# p30 feature_list 起草提案（requirement-author，待 ui-signoff 后转正）

> **【勘误注记，2026-07-19 转正时追加——正文保留原样作历史追溯，以下表述已过期】**
> 1. 正文与 §7/G4、requirements/README.md 中「signoff pending」「#750（批次 3）未合并」
>    等前提已全部失效：实况是 #746/#750/#752 已合并、`../ui-signoff.md` 已 `confirmed`
>    （yanbin shen，2026-07-19，签核范围批 1-3）；**批 4（P4/P5/调度中心，#753）亦已于
>    2026-07-19 由人类补签**。转正门控已放行，本文件已按文末「转正步骤」转正为权威
>    `../feature_list.json`——**本文件自此仅为需求追溯档案，不再是提案**。
> 2. **UC-19 排除勘误（coord-main #751 转正约束 1，§6 对应扩充）**：§6 排除项漏列
>    「UC-19 平台后台管理（admin 标签，@usamshen 固定平台管理员）」——其后台管理界面
>    无任何已签核 UI 批次原型（批 1-4 均不含 admin 视图），依 ADR-003 排除出本 phase
>    权威清单，不静默丢项；重进条件 = 补出后台管理界面原型并经人类补签 ui-signoff 后
>    另立 feature。已同步写入 `../feature_list.json` 顶部 `exclusions` 区。
>    UC-14 归属一并点名：由 p29 F04/F09 已交付基础承接，p30 内的按项目分片归 F04
>    （见其 notes）。
> 3. **§7 缺口拍板结果**：G1 已解（批 4 补签，F23 回归清单）；G2 已解（调度中心 UI
>    随批 4 补签，F15 恢复完整范围含调度中心）；G3 拍板 = 沿继承视图内嵌无新版式
>    （F18 免关卡，出新版式须停下走 signoff）；G4 已解（#750 已合并）；
>    G5 拍板 = 影子周期取「24 小时或一个 C-cycle 的较长者」（F10 verification 已写实）；
>    G6 拍板 = 租户 #2 用 agentic-harness-template 仓（GitHub App 安装为前置人工步骤，
>    F04/F20/F21 已按此写实）。

> **状态：提案（draft），不是权威。** 依 ADR-003，`ui-signoff.md` 顶部 `status` 仍为
> `pending`，因此本次产出是提案文档而非 `feature_list.json`。人类完成 UI 签核后，
> 由 coordinator 按文末「转正步骤」把本提案转成权威 `../feature_list.json`。
>
> 输入：`use-cases.md`（19 用例 + 已知边界五条）/ `platform-redesign.md`（D1-D6）/
> `coord-resident.md`（R1-R5）/ ui-signoff.md 批次 1-3（批次 3 = PR #750，转正前须已合并）/
> p29 `feature_list.json`（三元组黄金样例）/ `.harness/instructions/testing-standards.md`。
>
> 起草人：requirement-author agent，2026-07-19。

## 0 · 总览表（24 features，5 waves）

| id | title | wave | 线 | 来源 | 依赖 |
|---|---|---|---|---|---|
| F01 | 平台目录 DO：Project/Membership/Enrollment 领域模型 | 1 | A | §1 领域模型 / UC-01/04/06 | — |
| F02 | GitHub OAuth 登录（D3 阶段 2：公开层免登录 + 工作区 OAuth，原子灰度） | 1 | B | D3 / UC-04① | — |
| F03 | /p/:slug 路由化 + 成员鉴权（服务端角色裁剪 + 无权限态） | 1 | A | §4 IA / N1 / 边界③ | F01, F02 |
| F04 | 工作区数据按项目分片（需求/sprint/对话流入项目 DO） | 1 | A | 边界① / §1 工作原语 | F01 |
| F05 | GitHub App 多仓安装流：/onboard 接真（接入体检真实现） | 2 | A | UC-01 / P3 | F01, F02 |
| F06 | 加入审批流 + SLA：P2 join 向导与 W6 审批队列接真 | 2 | B | UC-04 / UC-02 / D2 | F01, F02, F03 |
| F07 | enroll 真实现：命名空间/一次性 token/首心跳点亮 | 2 | B | UC-06 / D2/D6 | F01, F02 |
| F08 | /me 三栏真数据 + D4 登录落点 | 2 | B | UC-09 / D4 | F01, F02 |
| F09 | 三层意图消息协议 v1（assign…decide，CHANGELOG 演进） | 2 | C | UC-11 / coord-resident §4 | F04 |
| F10 | R1：CoordBrain 影子模式（只读观察 + 零误判周期） | 2 | C | R1 / coord-resident §1 | F01 |
| F11 | R2：机械合并接管（全绿自动合并 + 一键降回人工） | 3 | C | R2 / UC-08 尾段 | F10 |
| F12 | R3：派工接管（tasks 下发 + 租约仲裁 + 开关） | 3 | C | R3 / UC-08 | F11 |
| F13 | agent 直达信箱（平台消息总线 + 回执对齐 + 定时唤醒） | 3 | C | UC-12 | F09 |
| F14 | 新成员 onboarding 5 步清单（/me 顶部，深链 + 自动完成检测） | 3 | B | UC-05 | F06, F07, F08 |
| F15 | @platform/dispatcher 五 loop（跨项目巡检，只路由不改状态） | 3 | C | UC-17 / coord-resident §2 | F10 |
| F16 | 通知分级与降噪（拍板>andon>卡住>站会>巡检，红点只计最高级） | 3 | B | UC-18 / P6 | F08 |
| F17 | R4：LLM 判断面接入（wsx-ai provider + 待拍板摘要/为什么需要我） | 4 | C | R4 / UC-09 卡片 | F12 |
| F18 | 需求提交流水线（五节点可视化 + 容量校验） | 4 | C | UC-07 / 边界②④ | F04, F17 |
| F19 | 晨报叙事 + 命令条（意图覆盖显式化，不沉默失败） | 4 | C | UC-09 晨报 / UC-10 / 边界⑤ | F17 |
| F20 | P1 项目目录接真数据（活跃度自动生成，不可购买位次） | 4 | D | UC-03 / P1 | F01, F05 |
| F21 | P2 招募页接真数据（GitHub 聚合 ≤60s，不可自填） | 4 | D | UC-03 / P2 / N2 | F01, F05 |
| F22 | 性能页跨项目化（👤/🤖 分表，D1 可见性裁剪） | 4 | D | UC-15 / D1 | F01, F03 |
| F23 | 公开档案 + agent 数字分身页（/u/:handle、/a/:handle/:agent） | 5 | D | UC-16 / D1/D6 / P4/P5 | F01, F22 |
| F24 | R5：唯一性移交（role:coord-main 由 CoordBrain 持有） | 5 | C | R5 | F11, F12, F17 |

Wave = priority 值（1-5）。四条线：A 多租户底座 / B 工程师生命周期 / C coord-resident 与协作 / D 市场与档案。

**C 线保序硬约束（coord-resident §渐进接管）**：R1(F10) → R2(F11) → R3(F12) → R4(F17) → R5(F24)
严格串行，前级未 passing 不得开工后级；每级自带「一键降回人工」开关且降级方向永远 fail-open 到人。

---

## 1 · Wave 1 —— 底座与身份

## R1（F01 story 锚点）

### F01 平台目录 DO：Project/Membership/Enrollment 领域模型
- 来源：platform-redesign §1 领域模型；UC-01（项目成为租户）/ UC-04（Membership 状态机）/ UC-06（Enrollment）。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：coord-gateway 挂载平台级目录 DO（PlatformDirectory，单例；与按仓分片的 RepoHub 互补），持久化 Project（slug/可见性/模块划分/SLA/门禁策略）、Engineer（@handle 全局唯一）、Membership（owner/maintainer/approver/contributor × pending/active/suspended）、Agent（owner 必填/parent 可空/心跳时间戳，内部主键不可变 ULID，D6）、Enrollment（agent×项目 + scoped token 引用）。`GET /api/coord/directory/projects|engineers|agents` 返回真实数据；任意 agent 行都能回答「哪个项目的？属于哪个人类？parent 是谁？」（§1 设计推论）；写路径仅限身份/授权/审批/派工（三条铁律）。
- **verification**：
  1. `pnpm --filter @repo/coord-directory test`（新包：状态机合法/非法迁移、@handle 唯一性、ULID 不可变、owner 必填约束全覆盖）
  2. `curl -sf https://coord-gateway.boardx.workers.dev/api/coord/directory/projects -H "Authorization: Bearer $COORD_API_TOKEN" | jq -e '.projects | type == "array"'`
  3. `bash phases/phase-p30-devportal-platform/scripts/verify-directory-invariants.sh`（待写：写入一个 agent 缺 owner → 4xx；重复 @handle → 409；改名后 ULID 不变且旧引用可解析）
- notes：RepoHub 已按仓天然分片，本 feature 只补「平台级目录」这一层，不动 RepoHub 内部。凭据沿用 coord-gateway 认证栈，不引入新长期密钥（coord-resident 非功能）。敏感 area，挂 rev-security。

## R2（F02 story 锚点）

### F02 GitHub OAuth 登录（D3 阶段 2，原子灰度）
- 来源：D3 门禁三阶段灰度（阶段 1→2）；UC-04①「GitHub 登录（平台不另设账号）」。
- area: `auth` / capability: `CAP-AUTH`
- **user_visible_behavior**：devportal 公开层（/explore、/projects/:slug、/u/:handle、/a/:handle/:agent）免登录可访问且组件零身份读取、零 Access header 依赖；工作区与个人层（/p/:slug/*、/me*）走 GitHub OAuth（复用 p29-F08 OAuth 栈），Access 收缩为只罩治理面；切换在同一个 PR 内「先加后删」原子完成（env 原子纪律，mod-devportal 事故）；#588 的 401 整页重认证行为不回退。
- **verification**：
  1. `curl -sf https://develop.boardx.us/explore | grep -q 'explore-directory'`（未带任何凭据可达公开层）
  2. `curl -s -o /dev/null -w '%{http_code}' https://develop.boardx.us/me | grep -qE '30[12]|401'（未登录访问工作区被引导认证，非 200）`
  3. `pnpm --filter devportal test`（公开层组件静态断言：禁止 import lib/access.ts / 读 cookie 的 lint 级检查）
  4. e2e：`apps/devportal/e2e/p30/auth-gray.spec.ts`（待写：OAuth 登录 → /me 200；登出 → /explore 仍 200）
- notes：**原子灰度是本 feature 的验收核心**：部署窗口内不允许出现「Access 已删、OAuth 未生效」中间态（CD 活跃时先删后合会被踩中，记忆已固化）。阶段 3「摘除 Access」不在本 phase（见排除项）。

## R3（F03 story 锚点）

### F03 /p/:slug 路由化 + 成员鉴权（服务端角色裁剪 + 无权限态）
- 来源：platform-redesign §4 三层 IA；N1 第四态「无权限」；use-cases 已知边界③「角色视角未裁剪（contributor 仍可见治理台）」。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/p/:slug/{pulse,work,coord,talk,people,settings} 按 slug 从目录 DO 解析项目并按登录者 Membership 服务端裁剪：contributor 访问 /p/:slug/settings 看到整页拒绝态（`gov-no-access`，引导 ✋ 举手），owner/maintainer 看到治理台；批次 2 的页内「视角开关」mock 被真实 membership 判定替换；非成员访问私有项目工作区得到无权限态而非数据泄漏；顶栏项目切换器列出登录者的真实项目。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. e2e：`apps/devportal/e2e/p30/workspace-authz.spec.ts`（待写：contributor 身份 goto /p/boardx/settings → `[data-testid=gov-no-access]` 可见且 `governance-console` 的治理操作不可见；owner 身份 → `governance-console` 可见；断言含从切换器**真实点击路径**进入 /p/:slug，不全是 goto 直达——testing-standards「能被导航到」）
  3. `bash phases/phase-p30-devportal-platform/scripts/verify-authz-api.sh`（待写：contributor token 调 settings 数据接口 → 403；owner → 200）
- notes：裁剪必须发生在服务端（API 层），前端隐藏不算过（假阳性防护）。M1 侧栏切换器同步从「过滤三栏」改为导航到 /p/:slug（批次 1 已知偏差的兑现）。

## R4（F04 story 锚点）

### F04 工作区数据按项目分片（已知边界①）
- 来源：use-cases 已知边界①「需求/sprint/对话流数据未按项目分片」；§1 工作原语「按项目分片」。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：需求（requirements 流水线条目）、sprint 面板数据、talk 对话流全部迁入按项目分片的存储（RepoHub DO 或项目子空间），/p/boardx 与第二个测试项目的工作区互不可见对方数据；项目间隔离升级兑现（N3：一个项目的数据量/故障不拖垮另一个项目的工作区）。
- **verification**：
  1. `pnpm --filter @repo/coord-repohub test`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-tenant-isolation.sh`（待写：向项目 A 写一条需求与一条 talk 消息 → 项目 B 的对应接口返回不含该数据；并发向两项目写入互不阻塞）
- notes：这是把「仅 work/镜像/花名册/治理台已多租户化」补齐到全工作区。迁移存量单项目数据时留导出归档（沿 p29-F10 的 D1 归档模式）。

---

## 2 · Wave 2 —— 生命周期闭环与协议

## R5（F05 story 锚点）

### F05 GitHub App 多仓安装流：/onboard 接真（UC-01 接入体检真实现）
- 来源：UC-01 项目接入；批次 3 P3 原型（PR #750）。
- area: `platform` / capability: `CAP-DATA`
- **user_visible_behavior**：/onboard 三步向导接真：①「跳转 GitHub 安装」发起真实 GitHub App（App 4328933）安装授权，返回真实 installation 回执（`install-receipt` 显示 installation # + 账户 + 权限清单）；② repo 列表来自该 installation 的真实仓库，admin 权限徽章按 GitHub collaborator permission 真实判定，非 admin 禁用（前置：发起人是仓库 GitHub admin）；③ 自动体检由后端逐项回报事件驱动（webhook 连通 / issues·PR 镜像种子真实灌入 / CODEOWNERS·CONTRIBUTING 检查 / 分支保护检查，警告不阻塞），`checkup-item-<id>` 的 `data-state` 跟随真实进度；完成后项目出现在目录 DO 中成为租户、coord-agent 归属确立，「进入工作区」落 /p/:slug/settings；全程目标 ≤5 分钟。
- **verification**：
  1. `pnpm --filter coord-gateway test`（安装 webhook（installation/installation_repositories 事件）→ 目录 DO 写入的单测）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-onboard-checkup.sh`（待写：对测试仓触发接入 → 轮询体检事件流，断言四项体检各出现 done/warn 终态且镜像种子计数 >0 → 目录 DO 出现该项目）
  3. e2e：`apps/devportal/e2e/p30/onboard.spec.ts`（待写：走 `onboard-step-{1,2,3}` 真实点击路径，断言 `admin-badge-*`/`not-admin-*` 与真实权限一致、`onboard-done` 与 `enter-workspace` 出现）
- notes：p29-F03 的 App 与 webhook ingest 是单仓的，本 feature 把它扩成「安装即租户注册」多仓流。`onboard-elapsed` 显示真实耗时而非静态 3m42s。体检状态点沿批次 3 已实现的四态点。

## R6（F06 story 锚点）

### F06 加入审批流 + SLA（UC-04：P2 join 向导与 W6 审批队列接真）
- 来源：UC-04；UC-02 审批队列；D2（审批发生在成员加入层）。
- area: `platform` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：P2 招募页「加入这个项目」三步接真：GitHub 登录（F02）→ 选角色/模块 + 自介 → 提交后 Membership 进 `pending`，`join-pending` 显示真实 SLA 24h 倒计时；自动开 onboarding issue 跟踪（GitHub 双写）；W6 审批队列显示真实待审申请与 SLA 倒计时徽章（≤4h 变红），owner 批准/驳回即改 Membership 状态并入只增审计；批准后成员初始信任级 Probation，/me 出现 onboarding 清单（F14 消费）；超时未审自动升级进 owner 待拍板流；其后该成员的 agent enroll 即生效无需再审批（D2）。
- **verification**：
  1. `pnpm --filter @repo/coord-directory test`（pending→active/rejected 状态机 + SLA 超时升级事件单测）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-join-flow.sh`（待写：API 提交申请 → 目录 DO 出现 pending → owner token 批准 → active + 审计事件 + onboarding issue 在 GitHub 真实存在（gh api 断言））
  3. e2e：`apps/devportal/e2e/p30/join-approve.spec.ts`（待写：`join-cta` → `join-step-{1,2,3}` → `join-pending`/`join-sla-countdown`；owner 视角 `approval-row-*` → `approve-*` → `approval-decided-*`）
- notes：SLA 兑现记录同时喂给 P2 公开区（F21）。审批动作全部入审计 + GitHub issue 双写（N5）。

## R7（F07 story 锚点）

### F07 enroll 真实现：命名空间 / 一次性 token / 首心跳点亮（UC-06）
- 来源：UC-06；D2 自动准入；D6 命名空间；批次 1 M2 原型。
- area: `auth` / capability: `CAP-AUTH`
- **user_visible_behavior**：/me/agents enroll 向导接真：① `@handle/agent-name` 在自己命名空间真实查重（`err-ns-dup` 由服务端判定），运行时选择供应商中立；② 一次性 token mint-on-reveal（继承 p29-F08 scoped token 栈，关闭不可找回），复制接入命令可用；③ 「等首个心跳」由真实心跳事件点亮（`first-heartbeat-waiting` → `first-heartbeat-live`，WS 推送非 mock 定时器），车队实时新增一行；无审批等待（D2）；轮换/暂停/退役接真——轮换与退役走输入全名解锁的确认弹窗，吊销后旧 token 即时 401；sub-agent 点号命名归属沿 parent 追溯。
- **verification**：
  1. `pnpm --filter coord-gateway test`（enroll API：查重 409、mint-on-reveal 一次性、revoke 即时失效单测）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-enroll-heartbeat.sh`（待写：API enroll → 拿 token 打一次心跳 → 断言 fleet 接口该 agent 状态由 waiting 变 live；rotate 后旧 token 调 API → 401）
  3. e2e：`apps/devportal/e2e/p30/enroll.spec.ts`（待写：`enroll-open` → 三步 → 后台用 curl 打真心跳 → `first-heartbeat-live` 点亮 → `fleet-row-*` 新增；`rotate-confirm` 输入全名解锁）
- notes：这是 aha moment（redesign §6），首心跳点亮延迟应 ≤ 数秒（WS，N2）。敏感 area，挂 rev-security。

## R8（F08 story 锚点）

### F08 /me 三栏真数据 + D4 登录落点（UC-09）
- 来源：UC-09；D4 默认视角；批次 1 M1 原型。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/me 三栏接真：待拍板@我（跨项目真实 decide 请求按 SLA 排序）/ 我卡住的 PR（真实 RepoHub 镜像的 mergeable/checks 判定，催办按钮产生真实事件）/ 我的 agent 异常（真实心跳丢失）；下方各项目一行式脉搏为真实数据；侧栏切换器红点为真实计数且点击导航到 /p/:slug；登录默认落点为 /me，且记住上次停留（D4 两条行为，批次 1 已知偏差兑现）；每卡四态齐全（loading/空/降级/无权限，N1）。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-me-live.sh`（待写：注入一条 decide 请求 + 制造一个 agent 心跳超时 → /me 数据接口 N 秒内反映，断言排序按 SLA）
  3. e2e：`apps/devportal/e2e/p30/me-workbench.spec.ts`（待写：登录后 URL 落 /me；`col-decisions`/`col-stuck-prs`/`col-agent-anomalies` 有真数据行；`switcher-badge-<slug>` 计数与注入事实一致；点击切换器 → URL /p/:slug）
- notes：「10 秒知道该干什么」。晨报条（`morning-brief`）本 feature 保留占位/降级态，叙事内容属 R4 后的 F19——两者边界在 notes 写死避免范围蔓延。

## R9（F09 story 锚点）

### F09 三层意图消息协议 v1（UC-11）
- 来源：UC-11；coord-resident §4（decide 意图）。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：coord-protocol 包扩展六意图 assign/accept/progress/blocker/escalate/decide 的 wire format（TS 类型 + 运行时校验，合法/非法样例全覆盖），`docs/coord-platform/protocol/` 新增 intents.md 且 CHANGELOG 记录版本演进（协议扩展走 CHANGELOG，硬要求）；消息落 append-only 事件日志并双写 GitHub issue；上行链 sub→module→coord→👤（decide 进待拍板）与下行链（拍板→coord 广播→自动继续）在事件流可见；talk 对话流按 👤/🤖/待拍板过滤展示真实消息，线程闭环状态可视（等待拍板/已闭环）。
- **verification**：
  1. `pnpm --filter @repo/coord-protocol test`
  2. `test -f docs/coord-platform/protocol/intents.md && grep -q 'decide' docs/coord-platform/protocol/CHANGELOG.md`
  3. `bash phases/phase-p30-devportal-platform/scripts/verify-intent-chain.sh`（待写：注入 blocker → escalate → 断言 decide 出现在待拍板接口；回写拍板 → 断言 assign 广播事件出现且线程状态翻「已闭环」；GitHub issue 双写用 gh api 断言）
- notes：协议语义继承 ADR-009/017（events 唯一可信历史）。这是 F13 信箱与 C 线 R2-R4 的消息底座，先行于它们。

## R10（F10 story 锚点）

### F10 R1：CoordBrain 影子模式（保序第 1 级）
- 来源：coord-resident R1 + 目标架构 §1；UC-17 背景。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：CoordBrain DO（每项目一个，与 RepoHub 同 worker）上线但**只读**：Cron tick 对全部机械 SOP 规则（全绿可合并判定 / ready-for-dev 派工判定 / PR 超时催办判定 / stale 租约回收判定 / andon 冻结判定）产出「它将做的决策」写入 `coord.shadow.*` 事件流，绝不执行；devportal 可见影子决策列表供人核对；跑满一个完整工作周期（≥1 个真实 sprint 日常循环）后,影子决策与人类实际决策的对照记录归档,误判数为零。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test`（新包：五类机械规则纯函数单测，含边界样例——andon 活跃时合并判定必须为冻结）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-shadow-cycle.sh`（待写：拉取 `coord.shadow.*` 事件流,断言 ①事件数 >0 且时间跨度覆盖 ≥24h（跑满一个周期）②每条影子决策带 rule-id 与输入快照 ③对照台账 `evidence/R1-shadow-audit.md` 存在且「误判」计数字段为 0——**零误判是本 feature 的 passing 门槛,由人类核对后落台账**）
  3. `curl -sf https://coord-gateway.boardx.workers.dev/api/coord/brain/shadow -H "Authorization: Bearer $COORD_API_TOKEN" | jq -e '.decisions | length >= 0'`
- notes：**C 线闸门**：R2-R5 全部以本 feature 的零误判台账为前置。机械规则纯代码可单测（coord-resident 非功能）；实现载体优先评估 Cloudflare Agents SDK。人类核对流程本身写进 evidence,不允许「自评零误判」。

---

## 3 · Wave 3 —— 接管链与协作面

## R11（F11 story 锚点）

### F11 R2：机械合并接管（保序第 2 级）
- 来源：coord-resident R2；UC-08 尾段（review → 合并）。
- area: `coord` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：required checks 绿 + review verdict 齐 + up-to-date + 无 andon 的 PR 由 CoordBrain 用 GitHub App token 自动合并；每次自动合并产生审计事件 + PR 评论（GitHub 侧可见落点）；andon 活跃时冻结一切合并并可见「冻结中」状态；治理台一键「降回人工合并」开关即时生效（fail-open 到人）；Probation 成员的前 3 个 PR 强制人工 review,机械合并对其不生效（UC-02 规则）。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-auto-merge.sh`（待写：测试仓开全绿 PR → 轮询断言被自动合并 + 审计事件 + PR 评论存在（gh api）；触发测试 andon → 第二个全绿 PR 不被合并；关开关 → 同样不合并）
  3. e2e：`apps/devportal/e2e/p30/takeover-switch.spec.ts`（待写：治理台开关翻到人工 → 断言 brain 状态接口 mode=manual）
- notes：把「PR 等待时长主动追踪催办」一并机械化（超阈值自动催办事件）。合并权从此双轨：开关开=DO,关=人——**同一时刻只有一个主体有合并权**,开关状态入审计。

## R12（F12 story 锚点）

### F12 R3：派工接管（保序第 3 级）
- 来源：coord-resident R3；UC-08 认领即派工的服务端。
- area: `coord` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：`ready-for-dev` 且无活跃租约的 issue 由 CoordBrain 按 registry/模块亲和自动下发 tasks 到目标 agent 信箱；工程师在 sprint 面板「认领 → 派我的 agent」走同一服务端路径（原子租约,恰好一个成功,并发撞车 409）；stale 租约由 dispatcher 起草回收请求进待拍板（UC-13）;治理台一键降回人工派工。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test && pnpm --filter @repo/coord-repohub test`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-dispatch.sh`（待写：造 ready-for-dev issue → 断言 tasks 出现在目标 agent 收件箱 + 租约建立；并发两个认领请求 → 201/409 恰好各一）
  3. e2e：`apps/devportal/e2e/p30/claim-dispatch.spec.ts`（待写：sprint 面板真实点击「认领 → 派我的 agent」→ 租约卡出现）
- notes：复用 p29-F05 原子租约原语,本 feature 是其「谁来发起」的接管。降级开关同 F11 模式。

## R13（F13 story 锚点）

### F13 agent 直达信箱（UC-12 平台消息总线）
- 来源：UC-12。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：agent 间长文对齐消息走平台总线（替代外部 session 通信）：发送→送达→已读→回执对齐四状态可查,「回执对齐 ✓」后才算闭环；支持 ScheduleWakeup 定时唤醒;消息可携带 GitHub 对象引用 chips（PR·CI 状态·sprint 进度,渲染为实时数据而非快照）；收件 agent 离线时暂存,下次心跳投递;信箱内容在 devportal 对 owner 可见。
- **verification**：
  1. `pnpm --filter @repo/coord-repohub test`（信箱状态机 + 离线暂存单测）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-mailbox.sh`（待写：A token 发消息给离线 B → 状态 stored；B 心跳 → delivered；B 读 + 回执 → aligned；ScheduleWakeup 到点产生唤醒事件）
- notes：依赖 F09 意图协议的信封格式。这是把「coord-main 与 module-coordinator 靠本地 session 传话」的现状搬进平台的关键一步。

## R14（F14 story 锚点）

### F14 新成员 onboarding 5 步清单（UC-05）
- 来源：UC-05。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：批准入项的新成员在 /me 顶部看到 5 步清单,每步深链：①读 quickstart（学习中心既有页）②enroll 第一个 agent（→F07 向导）③看花名册三层结构（→W5）④sprint 面板认领 good-first-issue（→F12 路径）⑤第一个 PR 合并;②④⑤由真实事件自动打勾（enroll 成功/租约建立/PR merged）,①③由访问行为或手动确认打勾;全程 ✋ 举手求助入口可用（D5 轻量原语,琥珀色,进待拍板,24h 无回应自动升级）；5 步全完成後清单收起,标记「正式解锁开发」。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-onboarding-steps.sh`（待写：新 pending→active 成员 → 清单接口 5 步全 false；模拟 enroll + 认领 + merge 事件 → 对应步翻 true）
  3. e2e：`apps/devportal/e2e/p30/onboarding-checklist.spec.ts`（待写：清单每步深链真实点击可达目标页；✋ 举手 → 待拍板列表出现琥珀条目）
- notes：✋ raise-concern 原语在本 feature 首次落地（发起端）,治理台展示端已在批次 2（`raise-hand-list`）;24h 自动升级的定时逻辑归 F15 的 1h SLA loop 执行,这里只建事件。

## R15（F15 story 锚点）

### F15 @platform/dispatcher 五 loop（UC-17）
- 来源：UC-17；coord-resident §2。
- area: `coord` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：全平台唯一 dispatcher 按五个固定周期跑巡检——1m 心跳&租约扫描 / 5m PR·CI 巡检 / 15m stale 租约处置 / 1h SLA 审计+性能快照 / 24h C-cycle 报告;产出「当前定位到的问题」清单（严重度+已采取动作）可在 devportal 调度视图查看;动作全部为起草/通知类并**路由给对应项目的 coord-agent,永不直接改项目内状态**;每个 loop 的最近运行时间与结果可查（可观测性）。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test`（dispatcher 路由规则单测:断言任何动作产出都是 draft/notify 类型,不含直接状态写）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-dispatcher-loops.sh`（待写：查 loops 状态接口,断言五个 loop 各有 last_run 且间隔符合周期;制造一个 stale 租约 → 15m loop（测试模式下加速 tick）产出回收草案进待拍板而非直接回收）
- notes：**「永不直接改项目内状态」是不变量,用类型/单测双重锁死**。调度中心完整 UI 不在批次 1-3 signoff 内——本 feature 的 UI 落点为最小只读视图,完整调度中心视图待后续 UI 批次（见缺口清单）。1h loop 顺带执行 F14 的 ✋ 24h 升级与 F06 的审批 SLA 超时升级。

## R16（F16 story 锚点）

### F16 通知分级与降噪（UC-18）
- 来源：UC-18；P6 ♻️。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：通知中心跨项目聚合,五级分级 拍板 > andon > 卡住 > 站会 > 巡检;巡检类默认折叠;侧栏与项目切换器红点只计最高级(有拍板只显拍板计数,不叠加);通知点击深链到对应落点(待拍板卡/andon 面板/PR)。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-notify-ranking.sh`（待写：同时注入巡检+拍板两类通知 → 红点计数接口只计拍板;巡检项 folded=true）
  3. e2e：`apps/devportal/e2e/p30/notifications.spec.ts`（待写：从侧栏红点真实点击进通知中心,断言排序与折叠;点一条通知 → URL 到达深链目标）
- notes：P6 是 ♻️（升级既有通知样式,非 🆕）,按 ADR-003 严格文义可不走 UI 先行,但**建议转正时人类顺带拍板 P6 是否要出批次 4 原型**;若要,本 feature 排期后移。

---

## 4 · Wave 4 —— LLM 判断面与双边市场

## R17（F17 story 锚点）

### F17 R4：LLM 判断面接入（保序第 4 级）
- 来源：coord-resident R4 + 目标架构 §3；UC-09 卡片「为什么需要我?」。
- area: `coord` / capability: `CAP-DATA`
- **user_visible_behavior**：CoordBrain 经 `wsx-ai` provider 接口（默认 Workers AI 托管开源模型,可插拔外接更强模型）获得 LLM 判断面:待拍板请求自动附摘要与「为什么需要我?」推理（/me 决策卡可展开,`decision-why-*` 显示真实推理而非 mock）;LLM 结论只能产出「起草/建议/摘要」,进入写路径必须过机械规则或人（非功能硬约束）;treatment 失败时降级为无摘要但流程不断;治理台一键关闭 LLM 面回到纯机械+人。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test`（写路径守卫单测:构造 LLM 输出直接触发写 → 被拒;摘要生成失败 → 决策请求仍投递）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-llm-judgment.sh`（待写：注入 decide 请求 → 轮询断言其 summary/why 字段非空且带 provider 标注;关开关 → 新请求无 summary 但正常进待拍板）
  3. e2e：`apps/devportal/e2e/p30/decision-why.spec.ts`（待写：/me 决策卡展开 `decision-why-*` 显示推理文本）
- notes：本 feature 只建 provider 接入 + 待拍板摘要一个消费者;需求分析（F18）、晨报/命令条（F19）是后续消费者,不塞进本 feature。实现载体优先评估 Cloudflare Agents SDK。

## R18（F18 story 锚点）

### F18 需求提交流水线（UC-07 + 容量校验）
- 来源：UC-07；已知边界④「sprint 容量无校验」、②backlog（最小化承接）。
- area: `platform` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：项目工作区 sprint 需求 tab 表单（或命令条「提需求:」,F19）提交需求 → coord-agent LLM 分析综合（查重/拆解/影响面/容量建议,经 F17 provider）→ 人工审核（通过/驳回,驳回项落 backlog 列表可查——边界②最小承接）→ 通过自动下发为 GitHub issues 进当前 sprint;五节点流水线可视化（提交→coord 分析→人工审核→下发 issues→开发)实时反映每条需求所处节点;下发时校验 sprint 容量（超容量建议阻塞下发并提示,边界④）。
- **verification**：
  1. `pnpm --filter @repo/coord-brain test`（容量校验规则单测）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-req-pipeline.sh`（待写：API 提交需求 → 轮询节点状态依次推进到「人工审核」→ 审核通过 → gh api 断言 issue 真实创建且进 sprint;提交超容量需求 → 下发被阻塞并有提示事件）
  3. e2e：`apps/devportal/e2e/p30/req-pipeline.spec.ts`（待写：表单真实提交 → 五节点进度点推进;驳回 → backlog 列表出现）
- notes：需求 tab 与流水线视图不在批次 1-3 signoff（工作区 W2/W4 为 ✅ 继承)——转正前需人类拍板:沿用继承视图内嵌（无新版式）还是出批次 4 原型。分析结论是「建议」,过不过全在人（写路径守卫同 F17）。

## R19（F19 story 锚点）

### F19 晨报叙事 + 命令条（UC-09 晨报 / UC-10）
- 来源：UC-09 晨报；UC-10；已知边界⑤「命令条意图覆盖有限」。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/me 晨报条显示 coord-agent 叙事式晨报（「今天只需管 N 件事」+行动按钮,内容来自真实三栏数据经 F17 生成）;底部常驻命令条任意页面可用:「提需求:xxx」直接建需求进 F18 流水线、「哪里卡了」返回堵点摘要+跳转、「性能怎么样」叙事回答;**支持的意图清单显式陈列**（边界⑤,在命令条帮助里可见）,无法处理的显式告知「已入 coord 队列」并真实入队（不沉默失败）。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-command-bar.sh`（待写：API 发「提需求:测试需求」→ F18 流水线出现该条;发一句超纲指令 → 响应含 queued=true 且 coord 队列出现条目）
  3. e2e：`apps/devportal/e2e/p30/morning-and-commandbar.spec.ts`（待写：`morning-brief` 文本含真实计数 N 且与三栏行数一致;命令条提需求 → 跳转/提示;帮助面板列出意图清单）
- notes：晨报与命令条都是 F17 的消费者;晨报数字必须与三栏事实一致（防 LLM 幻觉:计数由代码算,LLM 只做叙事包装）。

## R20（F20 story 锚点）

### F20 P1 项目目录接真数据
- 来源：UC-03；批次 3 P1 原型；D3。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/explore 项目卡来自目录 DO 的真实租户:合并火花线/活跃度分档由 GitHub 数据自动生成（分档规则代码化,「活跃度自动排序,不可购买位次」）,招募徽章反映项目真实招募状态,👤/🤖 分开计数为真;筛选/搜索作用于真实数据集;点击卡进 /projects/:slug 按 slug 取数（批次 3 已知偏差兑现,不再全是 boardx 模板）;公开层免登录（D3,F02）。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-explore-live.sh`（待写：接入第二个测试项目 → /explore 数据接口出现两卡且计数/活跃度字段来自聚合器非常量;断言无鉴权 header 也 200）
  3. e2e：`apps/devportal/e2e/p30/explore.spec.ts`（待写：`explore-grid` 卡数==目录项目数;`explore-card-<slug>` 点击 → URL /projects/<slug> 且内容随 slug 变;筛选后 `explore-result-count` 正确）
- notes：活跃度分档规则（高/中/低阈值）在本 feature 定义并入文档。依赖 F05 提供 ≥2 个真实租户。

## R21（F21 story 锚点）

### F21 P2 招募页接真数据
- 来源：UC-03；批次 2 P2 原型；N2（GitHub 聚合 ≤60s）。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/projects/:slug 全区接真:README 摘要来自真实仓库;活跃度证明区（近 12 周合并火花线/flow-time 中位/andon 响应中位）由 GitHub 数据自动生成且整区保留「不可自填」标注;需要帮助的模块卡与 good-first 计数为真;成员头像墙 👤/🤖 计数来自目录 DO;审批 SLA 兑现记录来自 F06 真实审批史(承诺/中位/兑现率);数据新鲜度 ≤60s 并标注「更新于 X 秒前」;公开层零身份读取(D3)。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-project-home-live.sh`（待写：对测试仓 merge 一个 PR → ≤60s 内火花线数据端点计数 +1;SLA 兑现率字段与 F06 审批史一致性抽查）
  3. e2e：`apps/devportal/e2e/p30/project-home.spec.ts`（待写：`activity-proof`/`proof-autogen-note`/`sla-record` 可见且数值非 mock 常量;从 /explore 真实点击路径到达本页）
- notes：聚合器与 F20 共用（一次建设两处消费）。「活跃度证明不可自填」靠**无写入接口**保证,不是前端禁用。

## R22（F22 story 锚点）

### F22 性能页跨项目化（UC-15）
- 来源：UC-15；D1 可见性。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/me/performance 分双表:👤 工程师表（项目数/PR 合并/flow-time/拍板响应/趋势,跨项目聚合）与 🤖 agent 表（达成率/吞吐/异常,按 owner 配对归因);数据源为 F15 的 1h 性能快照;聚合指标默认仅本人与相关项目 owner/maintainer 可见,他人访问得到无权限态（D1,服务端裁剪同 F03 机制)。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-perf-visibility.sh`（待写：本人 token 拉指标 → 200 含数值;无关系 token → 403/裁剪;owner token → 200）
  3. e2e：`apps/devportal/e2e/p30/performance.spec.ts`（待写：双表可见,agent 行带 owner 归因;跨项目列 >1 项目时正确聚合）
- notes：M3 为 ♻️（既有性能页升级）,无新版式诉求则不需批次 4;若出现新版式需求必须停下走 ui-signoff（p29-F09 的 ADR-003 纪律原文）。

---

## 5 · Wave 5 —— 公开档案与唯一性移交

## R23（F23 story 锚点）

### F23 公开档案 + agent 数字分身页（UC-16）
- 来源：UC-16；D1（opt-in 区间化 / 分身页全公开）；D6（/a/:handle/:agent 路由）。
- area: `devportal` / capability: `CAP-WEB`
- **user_visible_behavior**：/u/:handle 工程师公开档案:贡献事实默认公开;聚合指标 **opt-in** 且区间化展示（如「flow-time 中位 1-2 天」）,未 opt-in 访客看不到聚合指标;/a/:handle/:agent 分身页默认全公开——归属 owner、parent 树、授权项目、性能、最近事件（软件资产无隐私权);agent 改名后旧链路由 ULID 不断链(D6);两页均公开层免登录(D3)。
- **verification**：
  1. `pnpm --filter devportal lint && pnpm --filter devportal build`
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-profile-optin.sh`（待写：未 opt-in 用户档案接口无聚合指标字段;opt-in 后出现且值为区间字符串非精确数;分身页匿名 200 且含 owner/parent）
  3. e2e：`apps/devportal/e2e/p30/public-profiles.spec.ts`（待写：从花名册/车队行真实点击进两页;opt-in 开关翻转后档案区块变化）
- notes：**⚠️ ADR-003 阻断项：P4/P5 均为 🆕 视图且不在批次 1-3 signoff 内**——本 feature 转正前必须补 UI 先行批次 4（P4/P5 原型 + 人类确认),否则首版 feature_list.json 暂缓收录本条（见转正步骤 3）。

## R24（F24 story 锚点）

### F24 R5：唯一性移交（保序第 5 级）
- 来源：coord-resident R5 + 目标架构 §5。
- area: `coord` / capability: `CAP-WORKFLOW`
- **user_visible_behavior**：`role:coord-main`（本仓）由常驻 CoordBrain 持有并自续心跳,笔记本合盖车队不失指挥;本地人类会话降级为可来可走的 module-coordinator/worker,启动时不再抢 coord-main;人类保留 andon 与治理台最终控制:治理台一键把任意接管层级（R2/R3/R4/R5）降回人工,降级即时生效且入审计;移交与降级动作均产生事件 + GitHub 可见落点。
- **verification**：
  1. `pnpm harness lock-status 2>&1 | grep -qi 'coord-brain\|CoordBrain'`（coord-main 持有者为 DO 身份）
  2. `bash phases/phase-p30-devportal-platform/scripts/verify-handover-resilience.sh`（待写：观察 ≥3 个心跳周期 coord-main 租约由 DO 自续;治理台 API 触发 R5 降级 → 租约释放且人类会话可重新认领;再升级 → DO 重新持有）
  3. `pnpm harness doctor --phase p30`
- notes：**整个 C 线的终点**,前置 R1-R4 全 passing + R1 台账零误判。降级方向 fail-open 到人,绝不 fail-open 到自动（coord-resident 原文）。移交当日人类值守窗口由 coordinator 排期。

---

## 6 · 排除项（本 phase 明确不做）

引用依据均为 requirements 原文：

1. **计费/credits**：p30 requirements 三份输入通篇无计费诉求;platform-redesign §5 UI 全量清单无任何计费视图,三条铁律「写入面收窄（除身份/授权/审批/派工外全部只读）」也排除了计费写路径。计费属 p14 credits-billing 领域。
2. **多 org / 企业组织层**：§1 领域模型的实体只有 Project/Engineer/Membership/Agent/Enrollment——**Project 即租户,无 Org 上层实体**;「一个 GitHub 身份参与 N 个项目」（§0）直接挂人到项目,不引入组织中间层。
3. **RAG / 知识库检索**：学习中心 P7 仅为 ♻️ 升级（§5）且不在任何用例主流程;UC-05① 只要求「读 5 分钟 quickstart」静态内容。检索增强留给 knowledge-base 模块后续 phase。
4. **D3 阶段 3「摘除 Access」**：本 phase 只做到阶段 2（公开层免登录+工作区 OAuth,Access 收缩罩治理面）;彻底摘除待阶段 2 稳定后另立 feature（D3 原文「三阶段灰度」）。
5. **backlog 独立视图**：已知边界②;F18 仅做「驳回项落 backlog 列表可查」最小承接,完整 backlog 管理视图（排序/重激活/批量）留后续,且属 🆕 视图需先过 UI 关卡。
6. **agent 审批队列独立视图**：批次 2 已知偏差待拍板点——治理台「人工审批」模式下的 agent 队列本 phase 沿开关说明文案行为,独立视图待人类拍板后另立。
7. **W1-W4/W7 既有工作区页重构**：§5 标 ✅ 继承的页面不动版式,只按 F04 换分片数据源;♻️ 的 W3 实时协调已由 p29-F09 完成主体。
8. **移动端适配、多语言、邮件通道通知**：requirements 无此诉求,不做。

## 7 · 覆盖缺口自查（转正前需人类拍板）

| # | 缺口 | 影响 feature | 建议 |
|---|---|---|---|
| G1 | P4/P5 为 🆕 视图,无 UI 原型（批次 1-3 未含） | F23 | 出 UI 批次 4 或首版清单暂缓 F23 |
| G2 | P6 通知中心 ♻️ 无原型;调度中心（UC-17）无 UI 清单条目 | F16, F15 | ♻️ 可豁免但建议拍板;F15 先做最小只读视图 |
| G3 | 需求 tab/五节点流水线视图属 W2/W4 ✅ 继承区内嵌,无新原型 | F18 | 拍板:内嵌无新版式（免关卡）或出批次 4 |
| G4 | 批次 3（PR #750）尚未合并 | F05, F20 | 转正前置:先合 #750 再签核 ui-signoff |
| G5 | R1「跑满一个完整工作周期」的周期定义（24h? 一个 sprint?） | F10 | 建议拍板为「≥24h 且覆盖 ≥1 次真实合并+派工+异常」 |
| G6 | 第二个测试租户从哪来（F04/F20/F21 的隔离与聚合验证都需要） | F04/F20/F21 | 建议用 agentic-harness-template 仓作租户 #2 |

## 8 · 转正步骤（签核后 coordinator 执行）

1. **前置核验**：PR #750（批次 3）已合并;`ui-signoff.md` frontmatter `status: confirmed` + `confirmed_by/at` 已填(人类亲手改,依 ADR-003)。
2. **消化人类确认意见**：ui-signoff「人类确认意见」与本文 §7 六条缺口的拍板结论,回写到受影响 feature 的三元组（尤其 G1/G3 的去留）。
3. **生成 feature_list.json**：把 §1-§5 每个 feature 按 `.harness/templates/feature_list.template.json` 字段落成 JSON——`id/priority(=wave)/area/title/user_visible_behavior/status:"not_started"/sprint:null/owner:null/capability/verification[]/evidence:""/notes`;G1 若拍板暂缓则整条摘除并在 phase.md 记录;覆盖占位的示例 F01。
4. **verification 落地性复核**：逐条跑一遍**当下就能跑**的命令（包测试/curl）确认非假;`scripts/`、`e2e/` 待写脚本在 notes 保留「待写 + 断言意图」标注（p29 同款做法）。
5. **开 sprint**：`pnpm harness new-sprint --phase p30 --id 01 --goal "多租户底座" --features F01,F02,F03,F04`(此时 ui-signoff 门控放行);C 线保序与 wave 依赖在排期时不可倒置。
6. **本文档降级为档案**：转正后本文件保留作需求追溯,权威移交 `../feature_list.json`(README 流水线原则:requirements/ 是输入不是权威)。
