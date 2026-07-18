# p30 需求输入 ③：DevPortal 平台化重设计备忘（v2，含 D1-D6 拍板）

> 来源：design 项目 uploads/devportal-platform-redesign.md（2026-07-18 v2）忠实转录。
> 六个开放问题已由人类拍板（§9 D1-D6），本文是 UI 全量清单与非功能需求的权威输入。

## 0. 三个根本转变

| 维度 | p23（现状） | 平台化（重设计） |
|---|---|---|
| 项目 | 唯一（boardx 本仓） | **多项目租户**：GitHub App 安装 = 项目注册；每项目一个 RepoHub 协调空间 |
| 人 | 单项目成员 | **跨项目一等公民**：一个 GitHub 身份参与 N 个项目，声誉跨项目累积 |
| Agent | 表格里的一行 | **可管理的资产 + 有档案的工作者**：enroll、按项目授权、可观测、可退役 |
| 门户角色 | 仪表盘 + 工作台 | + **市场**（项目↔工程师双边）+ **控制台**（车队与治理） |

三条铁律（平台级）：GitHub 永远是权威；人类是一等实体（👤/🤖 严格区分，owner 与 parent
两条关系并存）；写入面收窄（除身份/授权/审批/派工外全部只读）。

## 1. 领域模型

实体：Project（slug/可见性/模块划分/SLA/门禁策略）、Engineer（@handle 全局唯一）、
Membership（角色 owner/maintainer/approver/contributor；状态 pending/active/suspended）、
Agent（owner 必填、parent 可空、能力标签、心跳）、Enrollment（agent×项目，scoped token）、
工作原语（Lease/Evidence/Event+Andon，按项目分片）、Decision（来源/@目标/SLA）。
**设计推论**：任何 UI 表格的行必须能回答——哪个项目的？属于哪个人类？（agent）parent 是谁？

## 2-3. Persona 与 Journey（摘要）

- **项目 Owner**：5 分钟接入、招募、看清堵点、能拉停、审批不过夜；怕 agent 撞车/PR 堆积/接入侵入。
- **工程师**：判断项目值不值得来、自助加入、agent 一次配置、每天 10 秒知道该干什么、跨项目成绩单；
  怕审批黑箱、agent 异常无感知、通知淹没。
- **Agent**：UX = 协议+文档+可观测性；**Agent 无 UI，但处处有镜像**——协议每个动作在 UI 必有
  可见落点（enroll→车队行、认领→租约卡、心跳丢→红点通知、拉停→andon 面板+status）。

## 4. 信息架构：三层

平台层（/ 目录、/projects/:slug 公开主页、/u/:handle、/a/:handle/:agent、通知中心、学习中心）
→ 项目工作区层（/p/:slug/*：pulse/work/coord/talk/people/settings，顶栏项目切换器）
→ 个人层（/me、/me/agents、/me/performance、凭据页）。

## 5. UI 全量清单（🆕 全新 / ♻️ 升级 / ✅ 继承）

**平台层**：P1 项目目录·探索页 🆕；P2 项目公开主页（招募）🆕；P3 项目接入向导（3 步+实时体检）🆕；
P4 工程师公开档案（opt-in 指标区间化）🆕；P5 Agent 数字分身页（/a/:handle/:agent 默认全公开）🆕；
P6 通知中心（分级降噪）♻️；P7 学习中心 ♻️。

**项目工作区层**：W1 pulse ✅；W2 work（谁在干活/PR 队列/派工/✋举手按钮）✅；
W3 coord 实时协调（WS 秒级+新鲜度）♻️；W4 talk 讨论流（👤/🤖/待拍板过滤、举手琥珀徽章）✅；
W5 people 花名册（👤→🤖 两段式缩进树）🆕；W6 settings 治理台（成员角色/模块/SLA/agent 准入
策略/审批队列/andon 面板+授权名单/token 审计）🆕；W7 项目性能页 ✅。

**个人层**：M1 /me 跨项目工作台（登录默认落点；三栏今日必办：待拍板@我/我卡住的 PR/我的 agent
异常；项目一行式脉搏；切换器红点）♻️；M2 /me/agents 车队管理台（enroll 三步向导+等首心跳
点亮；轮换/暂停/退役）🆕；M3 /me/performance ♻️；M4 凭据页 ♻️。

## 6. UI 先行优先级（原型顺序）

1. M1 /me 跨项目工作台（平台心脏，2 个 mock 项目做出聚合感）
2. M2 车队管理台（enroll「等首个心跳」是 aha moment）
3. P2 项目公开主页/招募页（双边市场供给侧起点）
4. W6 项目治理台（Owner persona 目前零专属界面）
5. W5 people 花名册（👤→🤖 两段式=「人类一等实体」最直观表达）

## 7. 非功能需求

N1 每卡四态（loading/空/降级/**无权限**）；N2 协调数据 WS 秒级+「更新于 X 秒前」，GitHub 聚合
≤60s；N3 互不拖垮升级为**项目间隔离**；N4 门禁三阶段灰度（D3）；N5 一切身份/授权/审批/andon
动作入只增审计 + GitHub issue 双写；N6 语义 token/对比度 lint/uiux-standards 全量适用，
👤/🤖/项目三色体系全站一致。

## 8. 与 p29 底座咬合

Phase A（p29，已完成）：单项目实时化 F09 + scoped token F08。
**p30 = Phase B（多项目工作区：切换器、/p/:slug 路由化、M1、M2、W5）+ Phase C（双边市场：
P1/P2/P3/P4/P5、W6）+ coord-resident（见 coord-resident.md）**。
⚠️ ADR-003：所有 🆕 视图必须走 UI 先行关卡（真实组件 + mock 数据 → 人类 ui-signoff）。

## 9. 六个拍板决策（D1-D6，人类 2026-07-18）

- **D1 声誉公开度**：贡献事实默认公开；聚合指标默认仅本人+owner/maintainer；公开档案 opt-in
  且区间化；**agent 分身页默认全公开**（软件资产无隐私权）。
- **D2 Agent 准入**：默认自动准入（信任锚点是人，审批发生在成员加入层），治理台可切人工审批；
  安全靠事后控制链（归因到 owner → andon → 吊销即时 401）。
- **D3 门禁演进**：三阶段灰度——Access 全站 → 公开层免登录 + 工作区 GitHub OAuth（Access 收缩
  罩治理面）→ 摘除 Access。切换原子（先加后删同 PR）；公开层不得依赖 Access 注入 header；
  保留 #588 的 401 整页重认证。
- **D4 默认视角**：登录落 /me（聚合兜住跨项目突发），项目工作区是 focus mode；记住上次停留。
- **D5 Andon 权限**：阻断性 andon 保持 maintainer+；owner 可 per-person 授予（入审计），
  不做自动规则；新增轻量原语 **✋ raise concern**（人人可发、琥珀色、不阻断、进待拍板，
  24h 无回应自动升级）——「人人可举手，班组长拉绳」。
- **D6 命名空间**：agent 标识 `@handle/agent-name`（owner 命名空间唯一），sub 用点号延伸；
  内部主键不可变 ULID，改名不断链；路由 /a/:handle/:agent。
