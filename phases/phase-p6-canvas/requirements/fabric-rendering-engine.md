# 原始需求 — 渲染引擎切换为 Fabric.js

> 背景调研见 `phases/requirements/board-canvas-gap-analysis-and-roadmap.md`（oldcode canvasx-main /
> boardx-web 差距分析）。`canvas.md` 里当初就把 Fabric.js 定位为"留作后续的可替换适配器"，
> 现在到了切换的时间点：F13（形状）/F14（连接线）/F15（手绘）/F16（图表）这几个 not_started
> feature 如果继续在纯 DOM 上做，连接线端口吸附和手绘笔刷的实现成本远高于用 Fabric.js；
> 且 canvasx-main 的 XConnector 子系统（端口吸附/自动重连/箭头样式）已经是产品级、
> 测试覆盖充分的 Fabric 原生代码，可以直接移植，而不是在 DOM/SVG 上重新发明。

## 背景 / 为什么做
当前 `apps/web/components/board/board-canvas.tsx` 用 `position:absolute` 的 DOM div 渲染
note/rect 两种 item，这套方式对已经 passing 的 F01-F11（渲染/选择/拖拽/复制粘贴/undo-redo/
pan-zoom）够用，但撑不住接下来要做的形状（F13）、连接线（F14）、手绘（F15）、图表（F16）：
- 连接线需要端口吸附 + 组件移动时连线跟随 + 路径重算，DOM/SVG 手搓的成本和 bug 面远高于
  用 Fabric.js 的对象模型（对象移动事件、锚点、路径对象都是原生能力）。
- 手绘在 Fabric.js 里是内置的 `PencilBrush`，DOM/SVG 需要自己实现笔迹采样、平滑、
  橡皮擦命中检测。
- canvasx-main（`phases/requirements/oldcode/canvasx-main/src/widgets/XConnector/`）已经把
  连接线这套算法写完并测试充分（约 6000+ 行 + 大量 spec），渲染引擎对齐后可以直接移植，
  不对齐则完全用不上这份代码。

## 原始需求（用户故事）
- 作为开发者，我想要把 `board-canvas.tsx` 的渲染层从 DOM div 换成 `fabric.Canvas`，
  但**不改变任何用户可见行为**——现有已 passing 的选择/拖拽/多选/复制粘贴/undo-redo/
  pan-zoom/对齐吸附线，在切换后必须继续通过原有 e2e，不允许功能倒退。
- 作为开发者，我想要 note/rect 两种既有 item 类型在新渲染层下用 Fabric 对象
  （`fabric.Rect` + 自定义 Textbox 子类）重新实现，为后续 F12-F19 的新组件类型打好地基。
- 作为开发者，我想要形状（F13）、连接线（F14）、手绘（F15）在 Fabric.js 对象模型上实现，
  其中连接线端口吸附/自动重连/箭头样式的算法参考并移植 canvasx-main 的 `XConnector/`
  （不整体拷贝依赖，按需精简移植到 `packages/canvas` 或 `apps/web` 的等价实现）。

## 验收线索
- 切换前后，`apps/web/e2e/canvas-*.spec.ts`、`widgets-001-use-canvasx-widgets.spec.ts`、
  `canvas-undo-redo.spec.ts`、`canvas-copy-paste.spec.ts`、`canvas-pan-zoom.spec.ts`、
  `canvas-select.spec.ts`、`canvas-007-use-alignment-guidelines.spec.ts` 全部保持通过，
  不因渲染引擎切换而回归（这是本 feature 的核心验收标准，而不是新增用户可见能力）。
- 页面 DOM 结构里出现 `<canvas>` 元素承载画布渲染（可用于 e2e 断言渲染层确实切换）。
- 依赖方（p7-board-shell 的 Board-Menu、Context-Menu）后续接工具栏时，能拿到 Fabric.js
  canvas 实例（或等价的对象操作接口），不需要重新适配 DOM 结构。

## 范围与边界
- 本 feature 做：渲染层引擎替换（DOM → Fabric.js）+ note/rect 两种既有类型的 Fabric 化 +
  保证既有 e2e 不回归。
- 明确不做（留给 F13-F16 各自的 feature）：新增形状/连接线/手绘/图表这些新组件类型的
  具体交互与持久化字段设计——那些仍按各自 uc 走，只是实现时基于本 feature 完成后的
  Fabric 画布来做。
- 依赖包选型：用官方 npm 包 `fabric`（与 canvasx-main 一致），不依赖 boardx-web 私有 fork
  `@boardxus/canvasx-core`（无访问权限）。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-CANVAS。
- 不依赖 p9/p10（这是纯渲染层重构，不涉及 AI/文件能力）。
- F13（形状）、F14（连接线）、F15（手绘）、F16（图表）应在本 feature 完成之后再排期，
  避免在 DOM 渲染层上做了一遍又要在 Fabric 化之后重做一遍。
- 与 `phase-p17-ui-reskin-round2` F01（Board AI 浮层/工具 dock/board chat）存在耦合：
  F01 如果现在直接叠加在旧 DOM 结构上，本 feature 落地后大概率需要重新定位/重新实现，
  建议 F01 编码等本 feature passing 后再启动（不在本文档范围内决定，仅记录依赖关系供
  跨阶段协调参考）。

## 切分提示（给 requirement-author 的建议）
- 建议作为 p6-canvas 的一个新 feature（在现有 F01-F11 之后、F12-F19 之前的位置，
  例如插入为新的 F 编号或作为 F07"对齐参考线"之前的地基项，由 requirement-author 决定
  合适的 priority），标题类似"画布渲染引擎切换为 Fabric.js（既有行为不回归）"。
- verification 应包含：现有全部 canvas/widgets e2e 回归 + 新增一条断言 `<canvas>` 元素存在
  的最小 smoke。
- 需要给 F13/F14/F15/F16 的 `depends_on` 或 `notes` 补一条对本 feature 的依赖说明，
  避免被排到本 feature 之前实现。
