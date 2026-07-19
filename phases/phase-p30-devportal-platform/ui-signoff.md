---
phase: "p30"
status: confirmed          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:   yanbin shen
confirmed_at:   2026-07-19T10:00:00Z
---

# UI 先行确认 — devportal-platform（Phase p30）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段约定）
- **真实组件**：本阶段界面属于 DevPortal，直接写在 `apps/devportal` 里（p30 的 UI 载体，
  沿用现有门户组件与语义 token），用 **mock 数据**、**不接后端**。人类确认后，
  feature 开发 = 把这些 UI 接上真逻辑，**UI 不丢弃、可复用**。
- mock 数据集中在 `apps/devportal/lib/mock/p30.ts`（标注「p30 UI 先行 mock，feature 实现时替换」）。
- 视觉/交互严格遵循 [uiux-standards.md](../../.harness/instructions/uiux-standards.md)；
  👤/🤖/项目三色体系：tag-blue / tag-purple / tag-green（N6）。
- 每页右上有「演示空态」开关：人类可切换核对空态（U2）；首屏 700ms mock 骨架核对 loading 态（U1）。

## UI 范围清单（第一批，UI 先行优先级 §6 的 1/2/5）

- [ ] **M1 `/me` 跨项目工作台**（UC-09，D4 登录默认落点）— `apps/devportal/components/p30/me-workbench.tsx`
  - coord-agent 晨报条（叙事式）；三栏今日必办：待拍板@我（跨项目、SLA 排序、卡片可展开
    「为什么需要我?」agent 推理，含 ✋ 举手琥珀样式 D5）/ 我卡住的 PR（催办按钮）/ 我的 agent 异常；
    2 个 mock 项目一行式脉搏；侧栏项目切换器带红点计数（可按项目过滤三栏）。
  - 截图：`ui-preview/m1-me-workbench.png`
- [ ] **M2 `/me/agents` 车队管理台**（UC-06/UC-13，D2/D6）— `apps/devportal/components/p30/fleet-console.tsx`
  - 每 agent 一行：心跳点 🟢🟡🔴（复用 HeartbeatDot 语义）/ 当前项目与租约 / token 状态 / 最近事件；
    sub-agent 行缩进 + 紫色左边条。行动：轮换 token / 暂停 / 退役（轮换与退役均为
    **输入 agent 全名才解锁的不可跳过确认弹窗**）。
  - Enroll 三步向导（`enroll-wizard.tsx`）：① 起名 `@handle/agent-name` 命名空间查重（D6）+
    运行时选择（供应商中立）→ ② 一次性 token mint-on-reveal + 复制接入命令 →
    ③ 等待首个心跳（mock 定时器 4 秒点亮，aha moment），完成后车队实时新增一行。
  - 截图：`ui-preview/m2-fleet-console.png`、`ui-preview/m2-enroll-step1-dup.png`、
    `ui-preview/m2-enroll-step2-token.png`、`ui-preview/m2-enroll-step3-waiting.png`、
    `ui-preview/m2-enroll-step3-live.png`、`ui-preview/m2-rotate-confirm.png`
- [ ] **W5 `/p/:slug/people` 花名册**（UC-03/UC-05③）— `apps/devportal/components/p30/people-roster.tsx`
  - 👤→🤖 两段式缩进树：成员行（角色徽章/信任级/在做什么，蓝色左边条）→ 名下 agents 缩进一级
    （紫色左边条）→ 点号 sub-agent 缩进两级；👤/🤖 计数分开；行悬停（或键盘聚焦）
    显示完整 `@handle/agent-name` + owner/parent 归属卡。mock 项目：`/p/boardx/people`（`/p/acme-crm/people` 同构）。
  - 截图：`ui-preview/w5-people-roster.png`

## 组件落点（apps/devportal 下真实路径）
- 路由页：`apps/devportal/app/me/page.tsx`、`apps/devportal/app/me/agents/page.tsx`、
  `apps/devportal/app/p/[slug]/people/page.tsx`（均 edge runtime，与现有部署形态一致）
- 组件：`apps/devportal/components/p30/{me-workbench,fleet-console,enroll-wizard,confirm-dialog,people-roster,shared}.tsx`
- mock：`apps/devportal/lib/mock/p30.ts`
- 关键 `data-testid`（供 requirement-author 锚定 verification）：
  `me-workbench` / `morning-brief` / `project-switcher` / `switcher-badge-<slug>` / `col-decisions` /
  `decision-card-*` / `decision-why-*` / `col-stuck-prs` / `pr-nudge-*` / `col-agent-anomalies` /
  `project-pulse-row-<slug>`；`fleet-list` / `fleet-row-*` / `enroll-open` / `enroll-wizard` /
  `enroll-step-{1,2,3}` / `err-ns-dup` / `token-reveal` / `copy-install-cmd` /
  `first-heartbeat-{waiting,live}` / `rotate-confirm` / `retire-confirm` / `action-{rotate,pause,retire}-*`；
  `people-roster` / `roster-member-row` / `roster-agent-row` / `roster-subagent-row` /
  `roster-count-{humans,agents}` / `roster-hovercard`；各页 `toggle-empty-demo` 与 `*-empty` 空态。

## 截图证据
- [M1 工作台](ui-preview/m1-me-workbench.png)
- [M2 车队列表](ui-preview/m2-fleet-console.png) ·
  [enroll ① 查重](ui-preview/m2-enroll-step1-dup.png) ·
  [enroll ② token](ui-preview/m2-enroll-step2-token.png) ·
  [enroll ③ 等心跳](ui-preview/m2-enroll-step3-waiting.png) ·
  [enroll ③ 点亮](ui-preview/m2-enroll-step3-live.png) ·
  [轮换确认](ui-preview/m2-rotate-confirm.png)
- [W5 花名册](ui-preview/w5-people-roster.png)

浏览路径（本地核对）：`pnpm --filter devportal dev` → `http://localhost:3400/me`、
`/me/agents`、`/p/boardx/people`。

---

## UI 范围清单（第二批，UI 先行优先级 §6 的 3/4）

- [ ] **P2 `/projects/:slug` 项目公开主页（招募页）**（UC-03 / UC-04，D3）—
  `apps/devportal/components/p30/project-home.tsx` + `join-wizard.tsx`
  - 访客视角（mock 未登录态）：README 摘要区；活跃度证明区——近 12 周合并火花线（SVG mock）、
    flow-time 中位、andon 响应中位，整区标注「自动生成自 GitHub 数据，不可自填」；
    需要帮助的模块卡（good-first 计数）；成员头像墙（👤 蓝 / 🤖 紫，计数分开）；
    审批 SLA 兑现记录（承诺 24h / 过去 30 天中位 6h / 兑现率进度条）；
    「加入这个项目」CTA（顶部 + 底部）→ UC-04 三步加入向导：GitHub 登录（mock，不发起 OAuth）
    → 选角色/模块 + 一句话自介（含表单错误态）→ 提交显示 pending + SLA 倒计时。
  - **D3 落实**：公开层组件零身份读取、零 cookie/header 分支——不依赖 Access 注入 header 的任何假设。
  - 截图：`ui-preview/p2-project-home.png`、`ui-preview/p2-join-wizard.png`、`ui-preview/p2-join-pending.png`
- [ ] **W6 `/p/:slug/settings` 治理台**（UC-02 / UC-13 andon 部分，D2/D5）—
  `apps/devportal/components/p30/governance-console.tsx`
  - owner 视角：唯一管理员与 coord-agent 绑定卡（「repo admin 已校验」标识 + 心跳点）；
    agent 准入策略开关（默认自动准入 / 人工审批，D2，切换即出说明文案并演示「入审计」反馈条）；
    审批队列（mock 两条成员申请，SLA 倒计时徽章——≤4h 变红，批准/驳回就地翻状态显示「已入审计」）；
    andon 面板——当前拉停状态（mock 一条活跃 andon，一键解除走不可跳过确认弹窗）、
    per-person 授权名单管理（D5：添加/移除成员授权均入审计，移除带确认）、
    ✋ 举手事件列表（琥珀色底，与红色 andon 视觉区分；显示 24h 自动升级倒计时）；
    token 审计表（最近 mint/rotate/revoke，横向滚动容器）。
  - Probation 规则提示条（前 3 个 PR 强制人工 review）；
    **无权限态**（N1 第四态）：页内 mock 视角开关切到 contributor → 整页拒绝态占位（引导 ✋ 举手）。
  - 截图：`ui-preview/w6-governance.png`、`ui-preview/w6-andon-panel.png`、
    `ui-preview/w6-approval-queue.png`、`ui-preview/w6-no-access.png`

### 组件落点（第二批）
- 路由页：`apps/devportal/app/projects/[slug]/page.tsx`、`apps/devportal/app/p/[slug]/settings/page.tsx`（edge runtime）
- 组件：`apps/devportal/components/p30/{project-home,join-wizard,governance-console}.tsx`
  （复用批次 1 的 `shared.tsx`/`confirm-dialog.tsx` 与 `PortalCard`/`HeartbeatDot`）
- mock：`apps/devportal/lib/mock/p30.ts`（追加批次 2 段，同头部声明）
- 关键 `data-testid`（供 requirement-author 锚定 verification）：
  P2：`project-home` / `join-cta` / `join-cta-bottom` / `readme-summary` / `activity-proof` /
  `proof-autogen-note` / `merge-sparkline` / `proof-flow-time` / `proof-andon-median` /
  `help-wanted` / `help-wanted-<module>` / `member-wall` / `wall-count-{humans,agents}` / `sla-record` /
  `join-wizard` / `join-step-{1,2,3}` / `join-github-login` / `join-role-*` / `join-module-*` /
  `join-intro-input` / `err-join-{modules,intro}` / `join-submit` / `join-pending` / `join-sla-countdown`；
  W6：`governance-console` / `view-as-{owner,contributor}` / `gov-no-access` / `probation-notice` /
  `binding-card` / `admin-verified` / `admission-{auto,manual}` / `admission-explain` / `audit-flash` /
  `approval-queue` / `approval-row-*` / `sla-badge-*` / `approve-*` / `reject-*` / `approval-decided-*` /
  `andon-panel` / `andon-active` / `andon-clear` / `andon-release` / `andon-release-confirm` /
  `andon-grants` / `grant-row-*` / `grant-add-*` / `grant-remove-*` / `grant-remove-confirm` /
  `raise-hand-list` / `raise-hand-*` / `token-audit` / `token-audit-*`；
  各页 `toggle-empty-demo` 与 `*-empty` 空态。

### 截图证据（第二批）
- [P2 招募页整页](ui-preview/p2-project-home.png) ·
  [加入向导 ②](ui-preview/p2-join-wizard.png) ·
  [提交后 pending+SLA](ui-preview/p2-join-pending.png)
- [W6 治理台整页](ui-preview/w6-governance.png) ·
  [andon 解除确认](ui-preview/w6-andon-panel.png) ·
  [审批队列（含入审计反馈）](ui-preview/w6-approval-queue.png) ·
  [无权限态](ui-preview/w6-no-access.png)

浏览路径（本地核对）：`pnpm --filter devportal dev` → `http://localhost:3400/projects/boardx`、
`/p/boardx/settings`。

### 已知偏差与待人类拍板点（第二批）
- P2 的 README 摘要 / 活跃度数据全为 mock 静态值；真实实现从 GitHub 聚合（≤60s，N2）。
- 加入向导第 ① 步「GitHub 登录」仅切换本地状态，不发起 OAuth；第 ③ 步 SLA 倒计时为静态 mock 文案。
- W6 无权限态由页内「视角开关」演示；真实实现应由服务端按 membership 角色裁剪（已知边界：
  use-cases.md 记录了「角色视角未裁剪」）。
- 治理台「人工审批」模式下的 agent 审批队列（区别于成员审批队列）本批未单独做界面——
  切换开关的说明文案已描述行为，需要人类拍板是否要独立队列视图。
- andon 解除后本批不提供「重新拉停」入口（拉停发生在工作区/协议侧，不在治理台）——如需演示可刷新页面。
- token 审计表仅最近 4 条 mock；分页/过滤留给 feature 实现。

---

## UI 范围清单（第三批，P1 项目目录 + P3 接入向导）

- [ ] **P1 `/explore` 项目目录·探索页**（UC-03 目录侧，访客可见，D3）—
  `apps/devportal/components/p30/explore-directory.tsx`
  - 5 个 mock 项目卡：名称 + 项目 chip / 语言徽章 / 活跃度火花线（SVG，标注「自动生成自
    GitHub，不可自填」）/「招募中」徽章（tag-green，未开放招募为灰）/ 需要帮助的模块 chips
    （tag-yellow）/ 👤🤖 分开计数；点击卡进 `/projects/:slug`（boardx 链到批次 2 真页，
    其余 mock 卡走同页模板）。
  - 筛选（语言 / 活跃度 / 招募状态，radiogroup chip）+ 搜索框（可搜项目名/简介/模块），
    全部本地过滤；空搜索结果空态（`explore-no-match`）+ 目录空态（演示空态开关）。
  - 顶部「＋ 接入你的项目 →」入口条 → `/onboard`（P3，owner 旅程起点）。
  - **D3 落实**：公开层组件零身份读取、零 cookie/header 分支——零 Access header 依赖。
  - 截图：`ui-preview/p1-explore.png`、`ui-preview/p1-explore-filtered.png`
- [ ] **P3 `/onboard` 项目接入向导**（UC-01，发起人 = repo admin 视角）—
  `apps/devportal/components/p30/onboard-wizard.tsx`
  - 三步（步骤轨复用 enroll 向导样式）：
    ① 安装 GitHub App——零侵入说明（只读镜像 + webhook + commit status 三项权限）+
    mock「跳转 GitHub 安装」按钮（1.2s 后返回已安装回执态：installation # + 账户 + 权限清单）；
    ② 选 repo——5 个 mock 仓库，admin 权限徽章（tag-green），非 admin 项禁用并说明前置
    （发起人必须是仓库 GitHub admin）；
    ③ **自动体检**——逐项实时校验动画（mock 定时器链，约 7s）：webhook 连通 ✅ /
    issues·PR 镜像种子 ✅（显示灌入 128 issues + 37 PR）/ CODEOWNERS·CONTRIBUTING
    模块划分初始化 ⚠️（缺文件警告不阻塞，附「稍后在治理台补」）/ 分支保护检查 ⚠️；
    全部完成 → 「项目已成为租户，coord-agent 归属已确立」+ 耗时 3m42s（呼应 ≤5 分钟目标）+
    「进入工作区」CTA → `/p/:slug/settings`（批次 2 治理台，警告项补救落点）。
  - 体检状态点沿用批次 1 状态点（HeartbeatDot）语义色：成功绿 `bg-success`、警告琥珀
    `bg-tag-yellow`（与 andon 红严格区分）、校验中脉冲、等待灰。
  - 截图：`ui-preview/p3-onboard-step2.png`、`ui-preview/p3-onboard-checkup-running.png`、
    `ui-preview/p3-onboard-done.png`

### 组件落点（第三批）
- 路由页：`apps/devportal/app/explore/page.tsx`、`apps/devportal/app/onboard/page.tsx`（edge runtime）
- 组件：`apps/devportal/components/p30/{explore-directory,onboard-wizard}.tsx`
  （复用批次 1 的 `shared.tsx`：PrototypeHeader / IdentityChip / LoadingSkeleton / EmptyState）
- mock：`apps/devportal/lib/mock/p30.ts`（追加批次 3 段，同头部声明）
- 关键 `data-testid`（供 requirement-author 锚定 verification）：
  P1：`explore-directory` / `explore-onboard-cta` / `explore-filters` / `explore-search` /
  `filter-lang-{all,<语言>}` / `filter-activity-{all,high,medium,low}` /
  `filter-recruit-{all,recruiting}` / `explore-result-count` / `explore-grid` /
  `explore-card-<slug>` / `recruiting-badge-<slug>` / `lang-badge-<slug>-<语言>` /
  `explore-sparkline-<slug>` / `help-chips-<slug>` / `explore-counts-<slug>` /
  `explore-no-match` / `explore-empty`；
  P3：`onboard-wizard` / `onboard-step-{1,2,3}` / `install-github-app` / `install-receipt` /
  `onboard-next-{1,2}` / `onboard-repo-list` / `repo-row-<slug>` / `admin-badge-<slug>` /
  `not-admin-<slug>` / `onboard-repos-empty` / `checkup-progress` / `checkup-list` /
  `checkup-item-<id>`（`data-state` = pending/running/done）/ `checkup-remedy-<id>` /
  `onboard-done` / `onboard-elapsed` / `enter-workspace`；
  各页 `toggle-empty-demo` 与 `*-empty` 空态。

### 截图证据（第三批）
- [P1 目录整页](ui-preview/p1-explore.png) ·
  [P1 筛选+搜索命中](ui-preview/p1-explore-filtered.png)
- [P3 ② 选 repo（admin 前置）](ui-preview/p3-onboard-step2.png) ·
  [P3 ③ 体检进行中](ui-preview/p3-onboard-checkup-running.png) ·
  [P3 完成（租户确立 + 耗时计）](ui-preview/p3-onboard-done.png)

浏览路径（本地核对）：`pnpm --filter devportal dev` → `http://localhost:3400/explore`、`/onboard`。

### 已知偏差与待人类拍板点（第三批）
- P1 非 boardx 的项目卡点进 `/projects/:slug` 后显示的是批次 2 的 mock 模板数据
  （`MOCK_PUBLIC_PROJECT` 固定为 boardx 内容）——原型阶段按约定复用同页模板，
  真实实现按 slug 取数。
- P1 排序为 mock 静态序（标注「活跃度自动排序，不可购买位次」）；活跃度分档（高/中/低）
  由火花线自动分档的规则留给 feature 实现定义。
- P3 ①「跳转 GitHub 安装」不发起真实 GitHub App 安装（本地状态 + 1.2s 定时器模拟回执）；
  ③ 体检为前端定时器动画，真实实现由后端逐项回报事件（WS/轮询）；耗时 3m42s 为静态 mock。
- P3 完成后「进入工作区」CTA 指向 `/p/:slug/settings`（治理台，两条 ⚠️ 的补救落点）——
  若人类认为应落 pulse/work 等其他工作区页，请拍板。
- 需求 §5 提到的侧栏「＋ 新建项目」入口本批以 P1 页顶入口条承载（`explore-onboard-cta`）；
  全局侧栏/导航壳是后续批次（P6/P7、导航整合）范围。
- 体检状态点未直接复用 `HeartbeatDot` 组件（其入参是「分钟数」语义），而是沿用其视觉语言
  （同色 token、同尺寸点）实现体检四态点——如需强制同一组件请拍板。
## UI 范围清单（第四批·最后一批，P4 + P5 + UC-17 调度中心）

- [ ] **P4 `/u/:handle` 工程师公开档案**（UC-16，D1）— `apps/devportal/components/p30/public-profile.tsx`
  - 分区语义（D1）：① 贡献事实区**默认公开**——参与项目卡（角色/起始/PR 合并数/模块）+
    PR 合并时间线（mock，自动生成不可自填）；② 聚合指标区 **opt-in 且区间化**
    （flow-time "6-12h" / 拍板响应 "1-4h" / 月吞吐 "40-60 PR" / andon "<30min"），
    整区带「已 opt-in 公开」标注，未 opt-in 时整区隐藏为占位说明；
    ③ 🤖 名下 agents 缩略行（心跳点 + 在做什么）链到 P5 分身页。
  - 页内演示「档案公开开关 + 预览模式」：本人视角可切 opt-in 开/关并「以访客身份预览」
    当前设置的效果（mock；真实实现由服务端判定 viewer，公开层组件零身份读取 D3）。
  - 截图：`ui-preview/p4-profile.png`（本人视角，opt-in 开）、
    `ui-preview/p4-optin-toggle.png`（opt-in 关 + 访客预览模式，指标区整区隐藏）
- [ ] **P5 `/a/:handle/:agent` Agent 数字分身页**（UC-16，D1/D6）— `apps/devportal/components/p30/agent-twin.tsx`
  - 默认**全公开**，无任何视角开关（D1：软件资产无隐私权——页头角标注明）；顶部完整
    `@usamshen/portal-dev-1` 标识 + 不可变 ULID（D6：改名不断链）+ 运行时/生命周期徽章。
  - 板块：归属 owner 卡（👤 蓝，链回 P4；「一切行为归因到人」）｜parent 派生树
    （本页高亮 + 点号 sub 逐级缩进，紫色左边条）｜授权项目列表（scope + token 状态徽章）｜
    性能三格（达成率 92% / 吞吐 11 PR·周 / 异常 1）｜最近事件时间线
    （lease 🔒 / evidence 📎 / andon 🅰️ / heartbeat 💓 / enroll 🪪 图标化）。
  - 截图：`ui-preview/p5-agent-twin.png`
- [ ] **调度中心 `/platform/dispatcher`**（UC-17，平台 admin 视角）— `apps/devportal/components/p30/dispatcher-center.tsx`
  - 五个固定 loop 卡：1m 心跳&租约 / 5m PR·CI / 15m stale 处置 / 1h SLA+快照 / 24h C-cycle，
    各带上次运行时间、下次运行倒计时（mock 本地递减演示循环感）、上轮扫描/定位计数。
  - 「当前定位到的问题」列表：严重度徽章（严重红 / 警示琥珀 / 记录灰）+ 「已采取动作」——
    全部为**起草/通知/路由类**文案并标注路由目标 coord-agent（呼应「dispatcher 永不直接改
    项目内状态」；页脚有动作边界说明）。
  - 非 admin 无权限态（N1 第四态）：页内 mock 视角开关切「普通成员」→ 整页拒绝态
    （说明 dispatcher 会主动通知到 /me，平台角色见 UC-19）。
  - 截图：`ui-preview/dispatcher-loops.png`（五 loop 卡）、`ui-preview/dispatcher-issues.png`（问题列表整页）

### 组件落点（第四批）
- 路由页：`apps/devportal/app/u/[handle]/page.tsx`、`apps/devportal/app/a/[handle]/[agent]/page.tsx`、
  `apps/devportal/app/platform/dispatcher/page.tsx`（均 edge runtime）
- 组件：`apps/devportal/components/p30/{public-profile,agent-twin,dispatcher-center}.tsx`
  （复用 `shared.tsx` / `PortalCard` / `HeartbeatDot` / `IdentityChip` 三色体系）
- mock：`apps/devportal/lib/mock/p30.ts`（追加批次 4 段，同头部声明）
- 关键 `data-testid`（供 requirement-author 锚定 verification）：
  P4：`public-profile` / `profile-view-{self,visitor}` / `profile-owner-controls` / `optin-toggle` /
  `profile-preview-toggle` / `profile-preview-banner` / `profile-facts` / `profile-projects` /
  `profile-project-<slug>` / `profile-merge-timeline` / `merge-event-*` / `profile-metrics` /
  `metrics-optin-note` / `metric-*` / `profile-metrics-hidden` / `profile-agents` / `profile-agent-*`；
  P5：`agent-twin` / `twin-full-id` / `twin-public-badge` / `twin-owner-card` / `twin-tree` /
  `twin-tree-self` / `twin-tree-*` / `twin-enrollments` / `twin-enrollment-<slug>` / `twin-perf` /
  `twin-perf-{attainment,throughput,anomalies}` / `twin-events` / `twin-event-*`；
  调度中心：`dispatcher-center` / `view-as-{admin,member}` / `dispatcher-no-access` /
  `dispatcher-readonly-note` / `dispatcher-loops` / `loop-card-loop-{1m,5m,15m,1h,24h}` /
  `loop-{last,next}-*` / `dispatcher-issues` / `dispatcher-issue-*` / `issue-severity-*` / `issue-action-*`；
  各页 `toggle-empty-demo` 与 `*-empty` 空态。

### 截图证据（第四批）
- [P4 公开档案（本人视角，opt-in 开）](ui-preview/p4-profile.png) ·
  [P4 opt-in 关 + 访客预览](ui-preview/p4-optin-toggle.png)
- [P5 Agent 数字分身页](ui-preview/p5-agent-twin.png)
- [调度中心五 loop 卡](ui-preview/dispatcher-loops.png) ·
  [当前定位到的问题列表](ui-preview/dispatcher-issues.png)

浏览路径（本地核对）：`pnpm --filter devportal dev` → `http://localhost:3400/u/usamshen`、
`/a/usamshen/portal-dev-1`、`/platform/dispatcher`。

### 已知偏差与待人类拍板点（第四批）
- P4 的「本人视角/访客视角」开关是原型演示；真实实现由服务端判定 viewer 是否本人，
  公开层组件零身份读取（D3）。opt-in 开关与预览模式只改本地状态，不落库。
- P4 聚合指标的区间分档（如 "6-12h"）是 mock 拍脑袋值；真实分档规则（对数档/固定档）需拍板。
- P5 授权项目列表的 `scope` 采用空格分隔的能力串（`coord.read work.claim evidence.write`）——
  这是 mock 提议的展示形态，真实 scope 词表以 p29 scoped token（F08）实现为准。
- 调度中心 loop 卡的倒计时是静态起点的本地递减（归零后按周期重置演示循环感），
  不代表真实调度；真实实现由 @platform/dispatcher（Cloudflare 常驻，coord-resident.md）驱动。
- 调度中心「当前定位到的问题」未提供操作按钮（如手动重跑 loop / 忽略问题）——UC-17 只定义
  展示语义；是否给平台 admin 手动干预入口需人类拍板。
- 本批基于 main（批次 1-2 已合并）开发；**批次 3（PR #750）尚未合并**，`p30.ts` 与本文件
  两处追加可能与 #750 产生纯追加型冲突，合并时保留双方即可。

## 已知偏差与待人类拍板点（第一批）
- D4「记住上次停留」「登录默认落点切到 /me」是行为逻辑，不在本批 mock 界面内，feature 实现时做。
- M1 侧栏切换器点击当前为「过滤三栏」交互（原型演示聚合感）；真实实现应导航到 `/p/:slug` 工作区。
- 卡片四态中本批交付 loading + 空态；降级/无权限态沿用 `PortalCard` 既有语义，在 feature 实现时接入。
- ~~第二批（P2 招募页、W6 治理台等 §6 序 3/4）未含在本批。~~ → 第二批已交付，见下方「UI 范围清单（第二批）」。

## 批次 5：视觉对齐（DevPortal Platform.dc.html 实现）

> 人类在 Claude Design 定稿视觉原型后的系统性视觉对齐批次：**结构/交互/文案/testid 零变更，
> 纯视觉层换设计语言**。权威视觉源已入库：
> `requirements/design/DevPortal-Platform.dc.html`。**视觉变更需人类复核确认**
> （frontmatter status 覆盖批 1-4 交互签核，本批视觉是否达标由人类/coordinator 裁）。

### 变更范围
- **主题层单源**（`apps/devportal/app/globals.css`）：全部语义 token 值切换为设计稿暖深色板
  （bg `#171310` / 卡面 `#1c1712` / 正文 `#f3ece0` / 主强调橙 `#ff8659` / 琥珀 `#f0b429` /
  teal `#7dd3c0` / 警示 `#e0665a`），token 名不变 → 全部组件自动换肤；新增
  `--accent-amber(-foreground)` token 对；`.dark` 与 `:root` 同值（单主题防漂移）。
  设计稿 hex → token 对照表见 globals.css 头注。
- **字体**：next/font 接入 Inter（正文）/ JetBrains Mono（数据、slug、handle）/
  Newsreader 斜体（晨报叙事、招募页 tagline）；tailwind `font-sans/mono/serif` 映射。
- **门户外壳**（新 `components/portal/nav-shell.tsx`，root layout 挂载）：232px 固定侧栏，
  三层分区（个人层 / 平台层 / 项目工作区·boardx）+ uppercase 小字距分区标签 + 选中态 +
  渐变 logo 品牌块（DevPortal / agentic 协作平台双行）+ 底部用户块；`<lg` 收起为顶部品牌条
  （U8 无横向溢出）。新增 testid：`portal-sidebar`（既有 testid 全部不动）。
- **三色体系重映射**（token 值层，类名不变）：👤 human → 长春花蓝系深底、
  🤖 agent → teal `#7dd3c0` 系深底、项目 → 琥珀 `#f0b429` 系深底；chip 文字一律
  `text-foreground`（≥8.4:1）。状态点升级：心跳「渐旧」与体检「警告」点从柔彩
  tag-yellow 改亮琥珀 `bg-accent-amber`（暗底上可见）。
- **动画**：fadeIn / slideUp keyframes（主区入场 + 晨报卡），`prefers-reduced-motion` 全局禁用。
- **对比度门控（ADR-013）**：`check-token-contrast.mjs` 移植为
  `apps/devportal/scripts/check-token-contrast.mjs` 并接入 `pnpm --filter @repo/devportal lint`
  （原 lint 为空壳 echo）；另做全量文本/底面组合矩阵校验（证据在 PR body）。

### v2 截图（1440px，`ui-preview/`）
- [v2 /me 工作台](ui-preview/v2-m1-me-workbench.png) · [v2 车队](ui-preview/v2-m2-fleet-console.png) ·
  [v2 花名册](ui-preview/v2-w5-people-roster.png) · [v2 招募页](ui-preview/v2-p2-project-home.png) ·
  [v2 治理台](ui-preview/v2-w6-governance.png) · [v2 目录](ui-preview/v2-p1-explore.png) ·
  [v2 接入向导](ui-preview/v2-p3-onboard.png) · [v2 调度中心](ui-preview/v2-dispatcher.png) ·
  [v2 公开档案](ui-preview/v2-p4-profile.png) · [v2 agent 分身页](ui-preview/v2-p5-agent-twin.png)

### 偏差待拍板（批次 5）
1. 设计稿最弱文字色 `#6b5f4f`（9.5-10px 注脚）对比度仅 2.9:1，违反 AA 红线——未采用；
   弱文统一 `--muted-foreground #a89880`（设计稿 `#8f8271` 在 `#2a2118` 面上也只有 4.2:1，一并提亮）。
2. 设计稿侧栏「项目工作区六 tab」（谁在干活/People/需求/对话/镜像/治理）中仅 People 与治理台
   有既有路由；侧栏只挂真实路由（另含招募页/接入向导），其余待后续 feature 落地。
3. `/me/performance`、通知中心（P6）无路由：侧栏以「规划中」占位条呈现（不可点），不虚构页面。
4. 三色体系的 human 色：设计稿人类多以 teal 呈现，但任务定 🤖=teal，故 human 取设计稿
   周边色长春花蓝（`#9db1ff` 系）保三色区分度——是否接受此映射请拍板。
5. 「招募中」徽章沿用 tag-green（现映射为琥珀系）；设计稿中为 teal 系。如需改为 teal
   需把该徽章从三色 token 改挂 success 系，属类名级改动，待拍板后另行小 PR。
6. 设计稿 `#f5a524`（举手琥珀）与 `#f0b429`（项目琥珀）色距过小，soft 底形态下合并为
   tag-yellow（琥珀黄深底）+ accent-amber 两档承载。

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
- 2026-07-19（yanbin shen，经 #752）：批 1-3 签核通过。
- 2026-07-19（yanbin shen，批 4 补签）：批 4（P4 公开档案 / P5 agent 分身页 / UC-17 调度中心，#753）
  补签核通过，签核范围扩至批 1-4。本记录行由 requirement-author 依 coord-main 转正指令代录。

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
