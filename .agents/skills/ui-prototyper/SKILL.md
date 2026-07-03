---
name: ui-prototyper
description: >
  激活条件：用户提到 UI 先行、先做界面、UI 原型、ui-signoff、界面确认、
  UI 关卡、把界面做出来给人看、has_ui 阶段等关键词时触发。
  在 feature_list 定稿前，用真实组件（apps/web + mock 数据）把本阶段界面做出来，
  交人类工程师确认，产出 ui-signoff.md 后停下等确认。
---

# UI Prototyper Skill

## 何时使用

只用于 **UI 相关阶段（roadmap `has_ui: true`，由 `new-phase --ui` 标记）**，
且在 `feature_list.json` **定稿之前**。目标是把本阶段界面**先做出来给人类工程师确认**，
确认通过才进入代码开发。见 **ADR-003**。

> 视觉/交互标准不在这里复制，遵循 [uiux-designer] skill 与
> [uiux-standards.md](.harness/instructions/uiux-standards.md)。
> 本 skill 只讲「UI 先行关卡」这一步怎么走。

## 交付契约（本阶段的硬约定）

| 要求 | 说明 |
|------|------|
| **真实组件，非丢弃原型** | 直接写在 `apps/web` 里（`components/…` / 路由页），不是独立 mockup。人类确认后，feature 开发 = 把这些 UI 接上真逻辑，**UI 复用不重写**。 |
| **只用 mock 数据，不接后端** | 用本地假数据/固定桩渲染，**不写 API、不连 DB、不接状态同步**。这一步只交付「看得见的界面」。 |
| **可观测锚点** | 关键元素带稳定 `data-testid`，供后续 `feature_list.json` 的 `verification` 与 e2e spec 锚定（e2e 只认 `data-testid`，不锚文案/结构）。 |
| **严格类型** | 组件与 mock 数据全程 TypeScript 严格模式，**禁 `any`**（含后续 e2e fixture：用 `Page`、`PlaywrightWorkerArgs["playwright"]` 等真实类型，不写 `(page: any)`）。 |
| **截图存证** | 每块界面截图存 `phases/<phase>/ui-preview/`，在 `ui-signoff.md` 贴相对链接。 |

## 标准流程

1. **读** `phases/<phase>/requirements/` 全部 `*.md`，梳理需要哪些屏/组件（覆盖每条用户故事）。
2. **建真实 UI**：在 `apps/web` 按 [uiux-standards.md] 高标准实现，mock 数据渲染，关键元素加 `data-testid`。
3. **本地预览 + 截图**：跑起 dev 预览，逐屏截图存 `phases/<phase>/ui-preview/`。
4. **填 `phases/<phase>/ui-signoff.md`**：勾选 UI 范围清单、列组件落点（apps/web 路径）、贴截图链接。
5. **停下等人确认**。**这一步你要做的到此为止。**

## 硬边界（这一步绝对不做）

- ❌ **不写 `feature_list.json`**：那是人类确认后 [requirement-author] 的活。
- ❌ **不接后端/不写业务逻辑/不做真实持久化**：只交付 mock 数据的界面。
- ❌ **不自己把 `ui-signoff.md` 的 `status` 改成 `confirmed`**：确认是**人类工程师**的动作，不是 agent 的。
- ❌ **不跑 `new-sprint`**：UI 未 confirmed 时 `new-sprint` 会被门控拒绝（ADR-003），这是设计如此。

## 交接给谁

- 人类确认（把 `ui-signoff.md` 的 `status` 改为 `confirmed`）后 → [requirement-author]：
  读 需求 + **已确认的真实 UI**（用其 `data-testid` 做可观察出口）→ 生成 `feature_list.json`。
- 排期 → [sprint-planner]；验证命令打磨 → [verification-writer]；实现（接真逻辑）→ [feature-implementer]。
