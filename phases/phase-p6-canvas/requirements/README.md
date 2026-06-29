# 需求 — canvas（Phase P6）

> 这个**文件夹**是本阶段需求输入的家。`canvas.md` 保留最初的原始需求草稿；
> `canvas/uc-canvas-001-manage-room-board-items.md` 是按全量 Use Case 规范补齐后的阶段 UC。

## 流水线
1. 原始想法先写入普通 `*.md` 草稿。
2. 进入实现前，把可交付范围沉淀成 `uc-*.md`，字段按 `phases/requirements/use-case-specification-standard.md`。
3. 调 **requirement-author** 智能体：读取本文件夹**全部** `*.md` → 生成/更新 `../feature_list.json`。
4. 每个 feature 用 `source_use_cases` 指向对应的 `uc-*.md`。
5. 本文件夹是**输入/上下文，不是权威**；权威永远是 `../feature_list.json`（带可执行 `verification`）。

## 当前阶段 UC
- `canvas/uc-canvas-001-manage-room-board-items.md`：覆盖打开 Room Board、渲染已有 item、添加、移动、编辑、删除和持久化。
