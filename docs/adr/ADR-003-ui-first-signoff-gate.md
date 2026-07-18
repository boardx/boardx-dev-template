# ADR 003: UI 相关阶段先做真实 UI 并经人类确认，才生成 feature_list / 开 sprint

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-07-01

## 背景

原需求录入流水线是：`new-phase` → `requirements/*.md` → **requirement-author** 直接生成
`feature_list.json` → `new-sprint` → 实现 → verify。

对有界面的阶段，这条链的问题是：feature_list 在**任何人看到真实界面之前**就被定成权威，
`user_visible_behavior` 只能凭文字想象界面。等实现做出来，人类工程师才第一次看到 UI，
此时若界面方向不对，返工代价已经压在「已定稿的 feature + 已写的代码」上。

## 决策

对**标记为 `has_ui: true` 的阶段**（`pnpm harness new-phase --ui`），在 feature_list 定稿前
插入一道 **UI 先行确认关卡**：

1. **ui-prototyper** 用**真实组件**（写在 `apps/web`、mock 数据、不接后端）把本阶段界面做出来，
   关键元素带稳定 `data-testid`，截图存 `phases/<phase>/ui-preview/`。
2. 产出 `phases/<phase>/ui-signoff.md`（frontmatter `status: pending`）。
3. **人类工程师**核对界面，通过后把 `status` 改为 `confirmed`（填 `confirmed_by`/`confirmed_at`）。
   确认是**人的动作，不是 agent 的**。
4. 确认后，**requirement-author** 读 需求 + 已确认 UI → 生成 `feature_list.json`，
   把行为/验证锚定到界面里真实存在的 `data-testid`。

门控由 **`new-sprint`** 强制（`lib/ui-signoff.ts` 的 `assertUiSignedOff`）：`has_ui` 阶段的
`ui-signoff.md` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝——即「UI 未确认不得进入代码开发」。

非 UI 阶段（`has_ui` 缺省/false）不受影响，流水线保持原样。

## 后果

正面：
- 界面方向在**便宜的阶段**（mock UI）就被人类拍板，把返工从「已定稿 feature + 已写代码」提前到「改 mock 界面」。
- 真实 UI 复用：确认过的组件留在 `apps/web`，feature 开发 = 接真逻辑，不重写界面。
- feature_list 的 `verification` 锚定已确认的真实 `data-testid`，验证契约更硬、更少假想。

负面 / 需注意：
- UI 阶段多一步人工确认，前期串行化一次（换来后期少返工）。
- `has_ui` 是新的 phase 元字段；`saveRoadmap` 仅在 `true` 时落盘，旧阶段不写、行为不变。
- 确认信号是「人改文件」，依赖人诚实执行；harness 只门控「有没有 confirmed」，不判断 UI 质量好坏。

## 备选（已否决）

- **门控卡在 feature_list 生成本身**：会让 requirement-author 连草稿都出不了，过紧。
  改为卡在 `new-sprint`（代码开发入口），对应「才正式进入代码的开发」。否决更紧方案。
- **所有阶段都强制 UI 关卡**：纯后端/逻辑阶段（orchestrator/agent-runtime）没有界面，
  强制只会空转。改为按 `has_ui` 条件启用。否决全局强制。
- **一次性可丢弃原型（静态 mockup）**：确认后要重写，浪费。改为真实组件、mock 数据、可复用。否决。
