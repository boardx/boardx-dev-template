---
phase: "p17"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — UI Reskin Round 2（Phase p17）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段的特殊情况）
- 本阶段**不是从零设计**：权威设计参照物已经存在——`docs/design/boardx-prototype-v1.bundle.html`，
  和 P0-P4 reskin（`docs/design/boardx-prototype-mapping.md`）用的是**同一份** prototype。
  当时 mapping.md §4 明确把 Ava/Store/Admin/Surveys/Room Workspace/Board 的 AI 浮层/
  工具dock 记为"本轮不做，留作后续"——现在就是这个"后续"。
- 因此这里的确认动作是：**核对下面每一屏在 prototype bundle 里的对应设计仍然是你想要的**，
  而不是先造一批新 mock 组件再确认。如果某一屏想改设计，在下面"人类确认意见"里写清楚，
  不要直接 confirmed。
- 建议先等 `phases/phase-p16-ui-nav-alignment/` 的 F02（UI 差距审计）产出
  `docs/design/boardx-ui-gap-round2.md` 再来确认——那份报告会把"现状 vs 设计稿"的差距
  截图并排放好，比直接翻 prototype bundle 更容易判断；但不是硬性前置，你也可以现在
  直接打开 bundle 确认。

## UI 范围清单（对应 prototype bundle 里的屏，逐项核对）
- [ ] Board：AI 浮层 + 底部工具 dock + board chat 面板 — bundle 内 Board 屏
- [ ] AVA：空态建议 / 消息 / research card / clarify-plan-running 时间线 / report 面板 — bundle 内 AVA 屏
- [ ] STORE：submenu + 内容 + 详情/创建 modal — bundle 内 STORE 屏
- [ ] ADMIN：overview/users/teams/store-approval + 相关 modal — bundle 内 ADMIN 屏
- [ ] SURVEYS：list/editor/answer-preview/results-report — bundle 内 SURVEYS 屏
- [ ] Knowledge Base + Credits 收尾（沿用已确认的 token 基座，非新设计）

## 组件落点（apps/web 下真实路径）
- Board：`apps/web/components/board/*`（新增 AI 浮层 + 底部 dock 组件）
- Ava：`apps/web/app/(app)/ava/page.tsx` 及相关组件
- AI Store：`apps/web/app/(app)/ai-store/*`
- Admin：`apps/web/app/(app)/admin/*`
- Surveys：`apps/web/app/(app)/surveys/*`
- KB/Credits：`apps/web/app/(app)/knowledge-base/*`、`apps/web/app/(app)/credits/*`

## 截图证据
- 见 `phases/phase-p16-ui-nav-alignment/` F02 产出的 `docs/design/boardx-ui-gap-round2.md`
  （如已产出，链接放这里）。

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
