# 13 — Survey 首页信息精简与状态补充

## 事实来源

- 用户于 2026-07-18 提供的 `/surveys` 实际页面标注截图：
  `codex-clipboard-1d2940e2-ec46-4f90-b873-045179bcc6a7.png`。
- GitHub 追踪入口：`boardx/boardx-dev-template#648`。
- 本需求是 `12-diagnostic-platform-html-fidelity.md` 的确认后增量；冲突处以本文为准。

## 用户目标

首页只保留能直接帮助用户判断工作状态和继续操作的信息，并补足真实问卷数量与发布时间。

## 已确认改动

### 1. 移除低价值卡片

- 从 Home Dashboard 删除“组织”和“顾问社区”两张卡片。
- 顶部问候区域的工作区上下文保留，不增加新的替代卡片。
- “我的工作台”真实指标区占满该行，不能留下空白占位。

### 2. 我的问卷数量

- Survey 左侧导航的“我的问卷”右侧显示当前登录用户拥有的问卷数量。
- 只显示数字，例如 10 份问卷显示 `10`；辅助技术可读到“10 份问卷”。
- 数量必须来自与“我的问卷”列表相同的真实 owner 过滤结果，不能使用固定演示值。

### 3. 最近问卷发布时间

- 最近问卷每一行在问卷信息和回收状态之间增加独立“发布时间”信息。
- 已配置 `publishStartAt` 时显示该时间；立即发布的活跃问卷使用当前数据模型记录的生命周期时间。
- 暂停或尚未发布的问卷显示“尚未发布”，不能伪造时间。
- 桌面端为独立列，移动端自然换行，不得引入横向溢出。

## 不变契约

- 保留现有问候、真实工作台指标、WHY/HOW/THEN、推荐模板和最近问卷主操作。
- 保留 owner/team/room 权限、问卷 URL 恢复、发布回收和报告流程。
- F01-F12 的 `passing` 状态和 evidence 不回写；本增量使用新的 feature 验证。

## 验收

- `survey-home-organization` 和 `survey-home-community` 不存在。
- `survey-nav-workspace-count` 显示与当前用户“我的问卷”列表一致的数字。
- 每个最近问卷存在稳定的 `survey-home-published-at-<id>`，内容为真实时间或“尚未发布”。
- `pnpm --filter @repo/web run lint`
- `pnpm --filter @repo/web run typecheck`
- `pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-home-information.spec.ts`
- `pnpm harness doctor --phase p25`
