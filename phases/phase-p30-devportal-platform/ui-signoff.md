---
phase: "p30"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
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

## 已知偏差与待人类拍板点（第一批）
- D4「记住上次停留」「登录默认落点切到 /me」是行为逻辑，不在本批 mock 界面内，feature 实现时做。
- M1 侧栏切换器点击当前为「过滤三栏」交互（原型演示聚合感）；真实实现应导航到 `/p/:slug` 工作区。
- 卡片四态中本批交付 loading + 空态；降级/无权限态沿用 `PortalCard` 既有语义，在 feature 实现时接入。
- ~~第二批（P2 招募页、W6 治理台等 §6 序 3/4）未含在本批。~~ → 第二批已交付，见下方「UI 范围清单（第二批）」。

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
