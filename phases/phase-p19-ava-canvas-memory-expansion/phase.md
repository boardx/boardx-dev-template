# Phase p19 — AVA 画布/记忆扩展 (P19，待决策)

- **slug**: ava-canvas-memory-expansion
- **状态**: not_started
- **创建于**: 2026-07-03 07:18:06

## 目标
待人类对产品范围拍板：是否迁移老代码的 AI 直接操作白板 widget（digitize/translateWidgets/生成海报音频PPT故事板字幕）、Memories 记忆管理、演示文稿预览卡片；本阶段目前只记录范围，不进入实现

## 状态说明（重要）
本阶段目前是**占位/记录性质**，不是已授权的实现范围。以下三块能力在老代码
（`phases/requirements/oldcode/`）里真实存在，但从未被写进 `phases/requirements/ava/*.md` 的
use case，也就不在 `phase-p9-ava-chat`/`phase-p18-ava-ai-realization` 的权威 feature_list 里。
本阶段先把范围记录下来，**在人类对是否要做出决策之前，不进入 requirement-author → feature_list
→ sprint 的流程**（`new-sprint` 也会因为 `ui-signoff.md` 未 confirmed 而拒绝，这是有意的门控）。

## 范围与边界（候选，待决策）
- 候选 1 — AI 直接操作白板 widget：对齐老代码 `boardx-backend-develop/src/ava/tools/`
  下的 `digitizeWhiteBoard.ts`（拍照把实体白板数字化为结构化便利贴）、`translateWidgets.ts`
  （批量翻译白板全部 widget 文字），以及 `infrustructure/handleRequestAIWidget.ts`（1684 行，
  AVA 生成海报/音频/PPT/故事板/字幕直接产出白板 widget）。工作量大，且与 `phase-p6-canvas`
  （画布编辑核心）边界需要梳理。
- 候选 2 — Memories 记忆管理：对齐老代码 `MemoriesDialog.tsx`，用户/团队/白板三级记忆。
  注意仓库现有 `packages/memory/` 是 harness 自身 agent 编排用的记忆系统，服务于
  `apps/orchestrator`，与此处的"AVA 产品记忆功能"是完全不同的两回事，不要混淆复用。
- 候选 3 — 演示文稿预览卡片：对齐老代码 `PresentationPreviewCard`/`PresentationPreviewModal`
  （缩略图翻页 + 全屏键盘导航）。需要先确认与 `phase-p12-studio-presentations` 的边界——如果
  p12 已经/将要覆盖"演示文稿生成与预览"，这里可能是重复建设，需人类判断该放在哪个阶段。
- 明确不做（在决策之前）：不写 use case、不跑 requirement-author、不产出 feature_list、不排
  sprint、不动 `phase-p6-canvas` 或 `phase-p12-studio-presentations` 的既有文件。

## 决策清单（需要人类回答，回答后再推进本阶段）
1. 候选 1/2/3 是否要做？各自要做到什么程度（完全对齐老代码 vs 精简版）？
2. 候选 1 与 `phase-p6-canvas` 的边界如何划分（谁负责画布写入的底层能力，谁负责 AI 触发）？
3. 候选 3 与 `phase-p12-studio-presentations` 是否合并，还是保持独立？
4. 优先级排序：三个候选是否都进入同一个 sprint，还是分批？

## 需求 → 功能清单 流水线
1. **原始需求**写进同目录的 `requirements/` 文件夹（可按领域放多份 `*.md`，人类语言、可模糊）。
2. 调 **requirement-author** 智能体：读 `requirements/` 全部 `*.md` → 生成/更新 `feature_list.json`
   （每个 feature 带可执行 `verification`）。
3. `requirements/` 是输入/上下文,**不是权威**;权威永远是 `feature_list.json`。

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
