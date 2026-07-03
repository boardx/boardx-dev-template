# 原始需求（概览）— AVA 画布/记忆扩展 (P19，待决策)（Phase p19）

> ⚠️ **本文件目前是范围记录，不是可执行需求。** 在 `../phase.md` 的「决策清单」被人类回答之前，
> 不要调 requirement-author 读本文件夹生成 feature_list.json——`../ui-signoff.md` 也刻意留在
> `status: pending`，`new-sprint` 会因此拒绝本阶段开 sprint，这是有意的门控，不是遗漏。

## 背景 / 为什么做
来自 `phase-p18-ava-ai-realization` 立项时的老代码 vs 新代码差距分析：老代码
（`phases/requirements/oldcode/`）里存在三块完整能力，但 `phases/requirements/ava/uc-ava-001~010`
从未把它们写成 use case，新架构的 `phase-p9-ava-chat` feature_list 因此天然没有对应 feature——
这是需求录入阶段的范围遗漏，不是实现阶段偷工减料。三块能力：

1. **AI 直接操作白板 widget** — 老代码 `boardx-backend-develop/src/ava/tools/digitizeWhiteBoard.ts`
   （拍照数字化实体白板为结构化便利贴）、`translateWidgets.ts`（批量翻译白板全部 widget 文字）、
   `infrustructure/handleRequestAIWidget.ts`（1684 行：AVA 生成海报/音频/PPT/故事板/字幕直接产出
   白板 widget）。新代码全仓库搜索这些函数名零命中，`packages/canvas` 从未被 AVA 路由引用。
2. **Memories 记忆管理** — 老代码 `MemoriesDialog.tsx`：用户/团队/白板三级记忆。新代码里唯一
   相关的 `packages/memory/` 是 harness 自身 agent 编排工具用的记忆系统（服务于
   `apps/orchestrator`），不是 AVA 产品功能，两者不要混淆。
3. **演示文稿预览卡片** — 老代码 `PresentationPreviewCard`/`PresentationPreviewModal`：缩略图
   翻页 + 全屏键盘导航。新代码里没有对应组件，与 `phase-p12-studio-presentations`（Studio 生成
   Artifact + 演示文稿生成与修订）存在潜在边界重叠。

## 原始需求（用户故事，仅供参考——尚未授权实现）
- 作为用户，我想让 AVA 直接读取/修改我白板上的内容（数字化便签、翻译 widget 文字、生成海报/PPT/
  故事板/字幕直接放到画布上），而不是只能在聊天里看文字回复。
- 作为用户，我想让 AVA 记住我/我团队/这块白板的偏好和上下文，下次对话不用重新说明。
- 作为用户，我想在聊天消息里直接预览 AI 生成的演示文稿缩略图，翻页/全屏查看，而不用跳转到别处。

## 验收线索（可观察的成功是什么样）
> 尚未定稿——待决策清单回答后，由 requirement-author 基于人类确认的范围转成可执行 verification。

## 范围与边界
- 本阶段要做：见 `../phase.md`「决策清单」。三项候选均需人类先拍板要不要做、做到什么程度。
- 明确不做（在决策之前）：不产出 feature_list.json；不排 sprint；不改动 `phase-p6-canvas` 或
  `phase-p12-studio-presentations` 的既有 feature_list。

## 已知约束 / 依赖
- 依赖的能力平面（CAP-AUTH / CAP-DATA / CAP-COLLAB…）：候选 1 需要 CAP-AI + 画布写入能力（与
  `phase-p6-canvas` 协调）；候选 3 需要与 `phase-p12-studio-presentations` 明确边界。
- 技术或合规约束：候选 1 涉及 AI 直接修改用户白板内容，需考虑权限/撤销/审计（老代码是否有对应
  安全控制，需要在做决策时一并核实）。

## 切分提示（给 requirement-author 的建议，留待决策后再用）
- 候选 1/2/3 相互独立，可以分别决策、分别排期，不必强行捆绑在同一个 sprint。
