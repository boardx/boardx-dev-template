# 原始需求 — packages/canvas 数据模型改造为字段级可寻址（CRDT-ready schema）

> 背景调研见 `phases/requirements/board-canvas-gap-analysis-and-roadmap.md` 第 4 节
> 「差距的根本矛盾：数据模型迟早要换底座，越晚换代价越大」。
> 与 `phases/phase-p6-canvas/requirements/fabric-rendering-engine.md`（已落成 p6:F13）
> 同属 Wave 0 前置技术工作，本文件覆盖 Wave 0 第 2-3 项。

## 背景 / 为什么做
`packages/canvas` 现在的 `applyCommand` 是"整条 item 替换"模型：`move`/`edit` 命令拿到
新的 `x/y`/`text` 后整体 `{...it, x, y}` 替换一条记录。boardx-web 生产架构的协作底座
是 Yjs——每个 widget 是一个 `Y.Map`，字段级 `set(key, value)`，协作端只广播"改了哪个
字段、改成什么"，而不是整条记录。

如果继续在"整条替换"模型上把 p6 的 F14-F20（形状/连接线/手绘/图表/样式/锁定/多选）
全部写完，等 P8 真正接 Yjs 协作时，这些 widget 的状态管理要从"整体对象"拆成"字段级"
才能挂 CRDT observer——boardx-web 自己就走过这条弯路（`UndoRedoService.ts` 命令栈式
undo/redo 已被整段注释掉，换成包住字段级 `Y.Map` 的 `Y.UndoManager`）。这个教训现在
就该继承，而不是等 P8 才发现要推倒重来。

## 原始需求（用户故事）
- 作为开发者，我想要 `packages/canvas` 的 widget 数据结构从"整条 item 替换"改成
  "字段级可寻址"，即每个 widget 是 `{id, type, fields: Record<string, unknown>}` 或等价
  的扁平字段映射，命令语义从 `{kind:"move", x, y}` 变成 `{kind:"patch", id, patch:{x,y}}`
  这样的字段级 patch，不管 widget 有多少个字段都能只更新变化的那几个。
- 作为开发者，我想要这个新 schema 是存储后端无关的——现在先用普通内存对象/数据库行实现，
  未来把存储后端换成 `Y.Map` 时，`applyCommand` 的调用方（React 组件、API route）不需要
  感知底层变化，只需要 patch 语义保持一致。
- 作为开发者，我想要现有 F01-F13 已经落地的 note/rect 两种类型和相关命令（add/move/
  edit/delete）在新 schema 下继续通过原有 e2e，不允许行为回归。

## 验收线索
- `packages/canvas` 的单测覆盖新的 patch 语义：同一个 widget 连续两次不同字段的 patch，
  互不覆盖（例如先 patch `{x}` 再 patch `{text}`，两次结果都保留）。
- `apps/web/e2e/canvas-*.spec.ts`（渲染/增删改/pan-zoom/select/copy-paste/undo-redo）
  在新 schema 下全部保持通过。
- F14（形状）/F15（连接线）/F16（手绘）/F17（图表）等后续 widget 类型开发时，能直接在
  这个字段级 schema 上添加各自专有字段，不需要改动 `applyCommand` 的分支结构。

## 范围与边界
- 本 feature 做：`packages/canvas` 的 schema/命令语义改造 + 现有类型/命令迁移到新语义 +
  既有 e2e 不回归。
- 明确不做：不引入 Yjs 依赖、不做真正的 CRDT/协作逻辑（那是 P8 的范围）；不新增用户可见的
  widget 类型（那是 F14 之后各自 feature 的范围）。
- 与 p6:F13（渲染引擎切换 Fabric.js）的顺序：两者都是 Wave 0 前置工作，互不依赖，
  可并行或按任意顺序完成，但都必须在 F14（形状）开工前落地。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-CANVAS。
- 不依赖 p8（不引入 Yjs），但设计上要让 p8:F01 未来接入时改动量最小。
- 数据库层（`packages/data` 的 board items 表）如果本身已是字段级列，本 feature 可能只需要
  改前端命令运行时的语义，不需要动库表结构；具体以实现时的现状为准。

## 切分提示（给 requirement-author 的建议）
- 建议作为 p6-canvas 的一个新 feature，插在 F13（渲染引擎切换）之后、F14（形状组件）之前，
  标题类似"packages/canvas 数据模型改造为字段级 patch（CRDT-ready）"。
- verification 应包含：新增字段级 patch 的单测 + 既有 canvas/widgets e2e 回归。
- 需要给 F14（原编号，插入后会顺延）及之后的 widget feature 补一条依赖说明。
