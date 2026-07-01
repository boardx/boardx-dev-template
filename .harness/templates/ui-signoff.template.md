---
phase: "{{PHASE_ID}}"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — {{PHASE_NAME}}（Phase {{PHASE_ID}}）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段约定）
- **真实组件**：直接写在 `apps/web` 里，用 **mock 数据**、**不接后端**。人类确认后，feature 开发 = 把这些 UI 接上真逻辑，**UI 不丢弃、可复用**。
- 视觉/交互严格遵循 [uiux-standards.md](../../.harness/instructions/uiux-standards.md)。

## UI 范围清单（逐屏/逐组件勾选，覆盖 requirements/ 里的用户故事）
<!-- ui-prototyper 填写：每一项 = 一块可见界面，附组件路径与截图。人类逐项核对。 -->
- [ ] （示例）Board Header 框架 — `apps/web/components/board/board-header.tsx` — 截图：`ui-preview/board-header.png`
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
