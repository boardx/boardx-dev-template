---
phase: "p25"
status: confirmed
confirmed_by: shenyangjun
confirmed_at: 2026-07-14T00:00:00+08:00
---

# UI 先行确认 — Survey System（Phase p25）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段约定）
- **真实组件**：直接写在 `apps/web` 里，用 **mock 数据**、**不接后端**。人类确认后，feature 开发 = 把这些 UI 接上真逻辑，**UI 不丢弃、可复用**。
- 视觉/交互严格遵循 [uiux-standards.md](../../.harness/instructions/uiux-standards.md)。

## UI 范围清单（逐屏/逐组件勾选，覆盖 requirements/ 里的用户故事）
<!-- ui-prototyper 填写：每一项 = 一块可见界面，附组件路径与截图。人类逐项核对。 -->
- [x] Survey 工作台与指标总览 — `apps/web/app/(app)/surveys/page.tsx` — 截图：`ui-preview/01-workbench-desktop.png`
- [x] 模板浏览与分类入口 — `apps/web/app/(app)/surveys/page.tsx` — 截图：`ui-preview/02-templates-desktop.png`
- [x] AI 创建问卷双栏流程 — `apps/web/app/(app)/surveys/page.tsx` — 截图：`ui-preview/03-ai-create-desktop.png`
- [x] AI 创建问卷移动端布局 — `apps/web/app/(app)/surveys/page.tsx` — 截图：`ui-preview/04-ai-create-mobile.png`
- [x] 公开答题与完成态 — `apps/web/app/survey/[id]/answer/page.tsx`、`answer-form.tsx`
- [x] 结果、AI 分析与专业报告 — `apps/web/app/(app)/surveys/[id]/results/page.tsx`

## 组件落点（apps/web 下真实路径）
<!-- 列出本阶段新增/改动的组件文件，供 requirement-author 把 user_visible_behavior 锚定到真实元素（data-testid）。 -->
- `apps/web/app/(app)/surveys/page.tsx`
- `apps/web/app/(app)/surveys/[id]/results/page.tsx`
- `apps/web/app/survey/[id]/answer/page.tsx`
- `apps/web/app/survey/[id]/answer/answer-form.tsx`
- `apps/web/app/(app)/surveys/acceptance/page.tsx`

## 截图证据
<!-- 截图存放在同目录 ui-preview/ 下，这里贴相对链接。 -->
- [工作台桌面](ui-preview/01-workbench-desktop.png)
- [模板桌面](ui-preview/02-templates-desktop.png)
- [AI 创建桌面](ui-preview/03-ai-create-desktop.png)
- [AI 创建移动端](ui-preview/04-ai-create-mobile.png)
- [报告编排器长度 review](ui-preview/2026-07-18-report-composer-length-review.png)

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
- 通过。用户于 2026-07-14 明确指定 `boardx-survey` 的 `codex-survey-home-nav-redesign` 分支为 Survey 全部需求、UI 与交互的事实来源，并要求按 Harness 流程完整同步。
- 本阶段 UI 直接复用该分支真实组件，不另行重绘；后续实现只接入真实数据、权限、AI、导出与错误处理，不改变已确认信息架构。
- 2026-07-14 再确认：事实来源包含未提交工作状态，固定为分支 HEAD `0ae3af90c989843025fb2a60aacf90de6ed8df11`
  与 stash tree `1eb9d7ba78cdda3d1a66fecb7d9fc2b7678cc64c`；实现验收以该快照为准。
- 2026-07-17 需求变更并由用户明确确认：F12 及后续 Survey UI 以
  `/Users/shenyangjun/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/yy774650019_32de/msg/file/2026-07/AI 问卷诊断平台(1).html`
  为唯一视觉与交互参考，SHA-256 为
  `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`。
- 新参考覆盖六个已确认界面：`Home Dashboard`、`我的问卷`、`模版中心`、
  `报告模版推演`、`问卷编辑器`、`洞察报告`。此前 BoardX Survey 源分支快照仅保留为历史记录，
  与新 HTML 冲突时以该 HTML 为准。
- 2026-07-18 增量确认：用户在当前 `/surveys` 页面截图中标注并要求删除“组织”和“顾问社区”
  两张卡片，在左侧“我的问卷”后显示真实问卷数量，并在“最近问卷”每行中部增加发布时间。
  该标注是 `requirements/13-home-dashboard-information-adjustments.md` 的人类 UI 确认依据。
- 2026-07-18 弹窗 review 再确认：用户指出当前“新建问卷”弹窗不够友好，并确认采用更宽的三入口卡片方案；
  三张卡片必须显示完整说明与行动文案，AI 入口标记为推荐，移动端改为单列且不得溢出。
  该确认是 `requirements/14-create-dialog-usability-review.md` 的人类 UI 依据。
- 2026-07-18 报告编排器增量确认：用户指出中间栏将设置和预览纵向堆叠后过长，要求删除逐题绑定，
  将输出配置精简为自然语言约束，并确认采用版本化事实库、按需生成和不可变报告版本方案。
  桌面端改为“报告要求 / 报告预览”横向工作区，生成记录与证据面板可折叠；新答卷只提示数据有更新，
  不自动调用模型。该确认是 `requirements/15-versioned-fact-base-report-composer.md` 的人类 UI 依据。
- 2026-07-18 增量确认：用户确认采用已批准的
  `docs/superpowers/specs/2026-07-18-survey-single-output-report-chapter-design.md`，每章必须且只能选择图片、图表或文本一种输出；
  图表使用白名单 Apache ECharts 官方模板，右栏提供效果预览和只读 Option JSON。
  图表模板参考 Apache ECharts `line-simple` 页面：
  `https://echarts.apache.org/examples/zh/editor.html?c=line-simple`。

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
