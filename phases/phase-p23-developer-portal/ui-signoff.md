---
phase: "p23"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — developer-portal（Phase p23）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段约定）
- **真实组件**：直接写在 `apps/web` 里，用 **mock 数据**、**不接后端**。人类确认后，feature 开发 = 把这些 UI 接上真逻辑，**UI 不丢弃、可复用**。
- 视觉/交互严格遵循 [uiux-standards.md](../../.harness/instructions/uiux-standards.md)。

## UI 范围清单（逐屏/逐组件勾选，覆盖 requirements/ 里的用户故事）
<!-- ui-prototyper 填写：每一项 = 一块可见界面，附组件路径与截图。人类逐项核对。 -->
- [ ] 门户骨架（五 tab / 待拍板通知条 / tab 红点 / title 前缀 / 访客分流带 / 三态演示开关）— `apps/web/app/portal-prototype/page.tsx`（v2）
- [ ] 脉搏与进度（整体进度+周变化 / flow-time 趋势 / phase 点击下钻 / 谁在干活状态点+活动行 / PR 队列堵点行动按钮）— 同上
- [ ] 实时协调（活跃租约 Active Claims / 协调事件 Recent Events，语义状态点）— 同上
- [ ] 讨论流（👤/🤖/待拍板过滤 / 分级降噪巡检折叠 / 待拍板问题加粗+快捷回应）— 同上
- [ ] 加入开发（5 步 stepper 含耗时与 SLA / 第 5 步现实版人工发放 / 学习页列表）— 同上
- [ ] 性能（per-agent 归属树表 / C-cycle 周期报告表）— 同上

> 实机确认方式：PR #497 分支起 dev server 访问 `/portal-prototype`（评审期间跑在
> localhost:3300），或看会话内已交付的实机截图（v1 四屏 + v2 首屏与 onboarding 第 5 步）。
> coord-main 的 UIUX review（PR #497 评论）Top5+次优先已在 v2 全量落实，逐条对照表
> 见 PR #497 的 v2 回复评论；战略方向（登录后"我"视角）后置为 F10/Phase F。
- [ ] …

## 组件落点（apps/web 下真实路径）
<!-- 列出本阶段新增/改动的组件文件，供 requirement-author 把 user_visible_behavior 锚定到真实元素（data-testid）。 -->
-

## 截图证据
<!-- 截图存放在同目录 ui-preview/ 下，这里贴相对链接。 -->
-

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
