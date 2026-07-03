# 原始需求 — UI Reskin Round 2（Phase p17）

## 背景 / 为什么做

`docs/design/boardx-prototype-mapping.md`（2026-06-30）在"重构计划"里明确记录了用户
当时确认的范围：只 reskin 现有页（Auth/AppShell/Home/Rooms/Teams/Account/Board 雏形），
以下几类**明确留到后续**：

> 设计有 / 现无（需新建）：Ava、Store、Surveys、Knowledge Base、Admin、Credits、
> Room Workspace、Board 的 AI/工具条/分享/slides、Room Detail、整套 Modal/Toast、
> （可选）Mobile Shell。

这一轮之后，harness 功能 pipeline 把 Ava/Store/Surveys/KB/Admin/Credits 的**功能**全部
实现完了（详见 phase-p9/p10/p11/p13/p14/p15），但从未回头对这些页面做 UI 对齐——
它们的 UI 是各 worker 为了让 e2e 断言通过而各自写的最小可用界面，从未参照过
`docs/design/boardx-prototype-v1.bundle.html` 这份权威设计稿。

本阶段就是把 mapping.md 里"留到后续"的这部分正式接回来，是 P0-P4 reskin 工作的
延续（同一份设计稿，同一套已确认的 token/组件基座）。

## 原始需求

- 作为白板用户，我想要在 Board 内直接唤起 AI 助手（浮层）、用底部悬浮工具 dock
  操作画布、在 board chat 面板里协作，而不是现在这样只有顶部一行工具条，
  以便获得设计稿里承诺的 FigJam 式协作体验（这是 prototype 里的核心差异点）。
- 作为 Ava 用户，我想要对话界面的视觉/交互和 prototype 的 AVA 屏（空态建议/
  research card/clarify/plan/running 时间线/report 面板）一致，而不是当前 worker
  各自拼出来的样子。
- 作为 AI Store / Admin / Surveys 用户，我想要这些页面的视觉语言（字号/圆角/间距/
  柔彩语义色/文案语言）和已经 reskin 过的 Home/Rooms/Teams 一致，而不是现在中英文案
  混用、token 各写各的。
- 作为工程负责人，我想要 Knowledge Base 和 Credits 的现有页面收个尾对齐设计系统，
  不需要新增功能，纯视觉/交互打磨。

## 验收线索

- Board 打开后能看到 AI 浮层入口和底部工具 dock，交互效果与 prototype bundle 里
  Board 屏一致（允许合理裁剪，但不能是"完全没有"）。
- Ava/Store/Admin/Surveys 页面的截图和 phase-p16:F02 产出的差距审计报告里标注的
  差距项逐条清零（或者明确记录为本轮不做并说明理由）。
- `apps/web/scripts/lint-design.sh` 对这些页面全部通过（phase-p16:F03 已经把它们纳入
  覆盖范围）。

## 范围与边界

- 本阶段要做：Board AI 浮层+底部工具dock+board chat 面板、Ava reskin、AI Store reskin、
  Admin reskin、Surveys reskin、Knowledge Base+Credits 收尾 reskin。
- 明确不做（维持之前的决定，除非另行确认要改）：**Mobile Shell**——`boardx-prototype-
  mapping.md` §4 已经和用户确认过"暂时跳过"，本阶段延续这个决定，不建 mobile 独立壳。
- 不新建任何 prototype 里没有对应设计、当前也没有功能需求的页面；这是 reskin，
  不是造新功能。

## 已知约束 / 依赖

- **硬依赖 phase-p16:F02（UI 差距审计）**：审计报告是本阶段逐屏 reskin 的权威依据，
  没有它无法准确定义每个 feature 的 user_visible_behavior 差距点。
- **按 ADR-003 走 UI 先行确认关卡**：`ui-signoff.md` 必须 confirmed 才能 `new-sprint`。
  设计参照物已经存在（`docs/design/boardx-prototype-v1.bundle.html`，和 P0-P4 reskin
  用的是同一份，只是这次要对应 Ava/Store/Admin/Surveys/Room Workspace/Board 剩余屏），
  所以确认动作主要是"过一遍这些屏、认可沿用同一份设计稿"，而不是从零设计。
- 复用 P0-P4 已落地的 token 基座（`globals.css`/`tailwind.config.ts`），不重新定义
  颜色/字号体系。

## 切分提示

- 按模块切成独立 feature，粒度对齐现有 phase 边界（Board→p6/p7，Ava→p9，Store→p11，
  Admin→p15，Surveys→p13，KB/Credits→p10/p14），互相之间基本无依赖，可并行分给
  不同 worker，唯一共同前置是 phase-p16:F02 的审计报告。
- Board AI 浮层+工具dock 优先级最高（prototype 里最核心的差异化体验）。
- Mobile Shell 不切 feature，只在 phase 说明里记录"仍暂不做"。
