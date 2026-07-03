# Board / Canvas 差距分析与迭代计划

> 研究范围：`phases/requirements/oldcode/{canvasx-main, boardx-web-develop}` vs 当前 `packages/canvas` + `apps/web/components/board` + `phases/phase-p{5,6,7,8}-*`。
> 结论先行：**新代码库的 Board/Canvas 是一个刻意收窄到能被浅层 e2e 覆盖的 DOM demo**，真实功能广度约为老系统的 10-15%，协作能力为 0%。当前唯一在建的 p17-F01（Board AI 浮层/工具 dock）只是给这个 demo 加视觉皮肤，**不触及任何一个根本差距**。
> **2026-07-03 更新**：渲染引擎路线已从"继续 DOM/SVG 自研"改为**采用 Fabric.js**（见第 6 节决策 1）。这个变化让 canvasx-main 的价值被重新评估——它的连接器子系统（XConnector）现在从"仅供思路参考"升级为"可直接移植的产品级代码"，因为渲染引擎终于对齐了。

## 0. 两份"老代码"不能混为一谈

调研中最重要的一个发现：`oldcode/` 下两份代码库不是同一件事，必须分开看，否则会把"半成品接口"误当成"待复刻的标准"。

| | `canvasx-main` | `boardx-web-develop` |
| --- | --- | --- |
| 定位 | 独立发布的 Fabric.js 引擎库快照 | 真正跑在生产环境的应用 |
| 依赖 | 自己就是 Fabric 的超集（`export * from 'fabric'`） | 依赖**已发布的** `@boardxus/canvasx-core`（比 canvasx-main 更成熟的 fork），并在应用层大量 `fabric.XCanvas.prototype.xxx = ...` 打补丁 |
| 规模 | 126 个 ts 文件 / 22089 行 / 42 测试文件 | boardApp 目录 230 个文件 / 50364 行 |
| 完成度 | **连接器（XConnector）子系统产品级**（端口吸附、自动重连、箭头样式，约 6000+ 行 + 大量测试）；但 `XCanvas-interface.ts` 声明的 zoom/pan/align/group/z-index/远程同步**大多只有接口签名，无实现**；undo/redo **完全没有**；键盘快捷键只有常量表无绑定 | 上述"只有接口"的能力**全部在应用层补齐**，且协作底座已经是 **Yjs**，不是 canvasx-main 占位字段暗示的某种自研远程同步 |

**结论**：不要把 canvasx-main 的接口设计当复刻目标（它自己都没做完 pan/zoom/align/undo）。但既然渲染引擎选定 Fabric.js（见第 6 节），它的 **XConnector 子系统（端口吸附/自动重连/箭头样式，6000+ 行 + 大量测试）值得直接移植**，因为对面就是同一套 Fabric 对象模型。真正该参照的工程标准仍然是 `boardx-web` 应用层的架构模式——**数据与渲染分离、widget 是可序列化的纯数据、协作用 CRDT（Yjs）建模**、画布级能力（pan/zoom/align/group/lock/z-index）在应用层给 Fabric 原型打补丁，而不是期待 Fabric.js 本身自带这些。

## 1. boardx-web 生产架构要点（复刻的参照系）

- **数据模型**：不是整块 canvas state，是 **per-widget CRDT**——顶层 `myShapes: Y.Map<widgetId, Y.Map<field, value>>`，每个 widget 一个 Y.Map，逐字段 `set`，挂 observer 同步回 Fabric 对象（`src/services/sync/widgetManager.ts`）。
- **同步传输**：`yjs` + `y-websocket`（`WebsocketProvider`）+ awareness（光标、Follow Me）（`src/services/sync/yjsService.ts`）。
- **Undo/Redo**：早期有一套命令栈（`UndoRedoService.ts`），**已整段注释掉退役**，现行方案是 **`Y.UndoManager`** 直接包住 `myShapes`。这是个重要信号：命令栈式 undo/redo 在多人协作场景下会和 CRDT 冲突，最终被 CRDT 原生的 UndoManager 取代。
- **Widget 广度**（`src/boardApp/widgets/` + canvasx-main `src/widgets/`）：便签（矩形/圆形/**15 种预置形状**）、富文本 Textbox、连接器（端口吸附+自动重连+箭头样式，最重的子系统）、图片+裁剪、手绘 Path、图表（chart.js 封装）、文件（Word/Excel/PPT/PDF/Zip/Video/Audio 7 个子类）、URL 卡片、Markdown、Frame、Group、多选 ActiveSelection。
- **画布级能力**：pan/zoom/viewport 恢复、对齐辅助线（真实绘制逻辑，非占位）、分组/解组、锁定、z-index 相交检测，全部在 `WBCanvas/{viewport,group,lockUnlock,zindex}.ts` + `aligning-guidelines/` 实现，本质是给 Fabric 原型打补丁，不是纯 Fabric 自带能力。
- **AI 集成**：Widget Menu 里的 AI Assist（`widgetMenu/ai/`）是真实 LLM 调用（`ai-assist.api.slice.ts` → `/aichatthread/create` 等），"widgetAI.ts" 这个文件名具有误导性，它实际只是 widget 创建工厂，不是 AI。

## 2. 新代码库现状（诚实评估，非自我批评式夸大）

### 2.1 `packages/canvas`（意图中的"引擎"）
全部内容 67 行：`BoardItem{id,type,x,y,w,h,text}`，`ItemType = "note"|"rect"`，`applyCommand/applyAll/validateNewItem`。文件头注释承诺的"Fabric.js/DOM 可替换适配器""后续实时协作（Yjs）"**全部是 TODO 口号，零代码**。没有撤销栈、没有 widget 类型系统、没有 CRDT 友好的字段级 schema。

### 2.2 `apps/web/components/board/board-canvas.tsx`（1171 行，真正承载交互的地方）
- **渲染方式**：`position:absolute` 的 `<div>`，无 canvas/SVG/Fabric/Konva，整仓库无这类依赖。
- **"文本/嵌入"类型是伪造的**：用 `color` 字段塞哨兵值 `"text"`/`"embed"` 冒充类型，因为后端 `validateNewItem` 只放行 `note|rect` 两种真类型。
- 已实现：多选（shift）、拖拽移动、双击编辑、右键菜单、应用内剪贴板复制粘贴、本地 `undoStack/redoStack`（未同步、未跨端）、方向键微移、z-order 重排、6px 阈值的对齐吸附线（`computeSnap`）。
- **明确未实现（UI 上是 disabled 占位）**：手绘、连接线、resize 控制点、锁定、marquee 框选、图片/资源上传、模板——按钮存在但 `disabled`，对应 e2e 测试 (`widgets-001-use-canvasx-widgets.spec.ts`) 大量断言的正是 `toBeDisabled()`，即**测试在验证"占位功能确实不可用"**。
- **"实时协作"是 1.5 秒轮询 + 全量 diff 覆盖**，不是增量同步。

### 2.3 其余组件（`canvas-viewport.tsx`、`presence.tsx`、`slides-panel.tsx`…）
- `canvas-viewport.tsx`：真实的 CSS transform pan/zoom + 缩放条 + 粗略小地图，**功能性最完整的一块**。
- `presence.tsx` / `lib/presence.ts`：1.5 秒心跳轮询 + **进程内内存 Map**，TTL 5 秒，注释自认"单 server 场景足够"。
- `lib/collab-bus.ts`：**同一浏览器内的模块级变量**，跨标签页都不通。
- `slides-panel.tsx`：localStorage 存视口快照；`local-workspace.tsx`：本地 mock 聊天，无后端；`timer.tsx` 注释直言"多人共享同步在 p8 接 Yjs 后增强"；`sync-status.tsx` 注释直言"原型阶段无真实 realtime 后端"。
- **全仓库 grep `yjs`/`y-websocket`/`y-protocols` 零命中**（package.json、lock 文件、源码全部没有）。

### 2.4 harness 权威状态（`feature_list.json`，已与老系统 168 个 use case 对齐，无需重新做需求梳理）

| Phase | 范围 | 状态分布 |
| --- | --- | --- |
| p5-board | Board 生命周期（创建/打开/列表/收藏/改元数据/复制/移动/删除/access） | **10/10 passing**，已完成 |
| p6-canvas | 画布编辑核心（命令运行时+widget 广度） | 10 passing / 9 not_started / 3 blocked（共 22）——passing 的是浅层的（渲染/CRUD/pan-zoom/选择/复制粘贴/undo-redo/便签），**not_started 的是广度**（对齐线、文本样式、形状、连接线、手绘、图表、样式应用、锁定/刷新、多选批量），**blocked 的是图片/文件/AI**（依赖 p9/p10） |
| p7-board-shell | Header/Board-Menu/Context-Menu/Local-Workspace | 3 passing（计时器/设置/快捷键帮助）/ 8 not_started / 5 blocked（共 16）——**Header 框架、分享、Board-Menu 工具栏框架、Context-Menu 全部 not_started** |
| p8-collaboration | Yjs 同步/在线光标/跟随/断线重连 | **4/4 not_started，零代码基础**（presence/collab-bus 只是临时占位，不是 P8 的地基） |

blocked 项的依赖已在 feature_list 里标注清楚：图片/文件依赖 p10（知识库，`in_progress`）的 files 能力；语音转写/AI 助手依赖 p9（AVA，`in_progress`）的 AI 运行时。**这两个依赖阶段都已经在推进，不是新增阻塞**。

### 2.5 规模对比（量化）

- 老：canvasx-main 22089 行 + boardx-web boardApp 50364 行 ≈ **72000+ 行**
- 新：packages/canvas 67 行 + apps/web/components/board 全部 10 个文件 ≈ **2700 行**
- 新代码体量约为老代码应用层的 **~4%**，widget 类型广度 2/15+ ≈ **13%**，协作能力 **0%**。

## 3. 当前在建工作触及不到差距

`phase-p17-ui-reskin-round2` F01（"Board 内嵌 AI 浮层 + 底部工具 dock + board chat 面板"）当前 `in_progress`，但它是纯视觉 reskin，建立在现有 DOM demo 之上——**不会新增 widget 类型、不会换渲染引擎、不会碰数据模型或协作**。如果不显式规划，团队容易把"UI 变好看了"误判成"差距在缩小"。这是本次研究要澄清的第一个认知偏差。

## 4. 差距的根本矛盾：数据模型迟早要换底座，越晚换代价越大

这是本次分析里最重要的工程判断，值得单独强调：

`packages/canvas` 现在是「扁平数组 + id」的 reducer；`boardx-web` 生产架构是「per-widget Y.Map，装进顶层 Y.Map」的 CRDT。这两种模型**不是加个同步层就能打通的**——CRDT 要求字段级细粒度更新（`yWidget.set(key,value)`），而不是整条 item 替换。

如果按 `feature_list.json` 里 p6 的字面顺序，先把 F12-F19（文本样式/形状/连接线/手绘/图表/样式应用/锁定/多选批量）在当前扁平模型上堆完，再到 P8 引入 Yjs，**大概率要把 P6 刚写完的组件状态管理全部推倒重写**（widget 内部状态要从"整体对象"拆成"字段级"才能挂 CRDT observer）。boardx-web 自己就走过这条弯路——它的 `UndoRedoService.ts`（命令栈式 undo/redo）已经被整段注释掉、换成 `Y.UndoManager`，说明"先做本地态数据结构，后接协作"这条路径在老系统里已经交过一次学费。

**这个教训应该被继承**：在继续铺 P6 的 widget 广度之前，先把数据模型的字段粒度定下来，哪怕 P8 还没排期。

## 5. 迭代计划

计划按 harness 现有的 P5→P6→P7→P8 骨架走（不新开阶段，只调整**阶段内**的执行顺序和补一个前置 wave），因为 feature_list.json 已经和老系统 168 用例对齐，不需要重新做需求梳理，只需要排出正确的实现顺序。

> **落地状态（2026-07-03，全部 4 项已正式立项）**：
> - `phases/phase-p6-canvas/feature_list.json`：**p6:F13**「画布渲染引擎切换为 Fabric.js（既有行为不回归）」+ **p6:F14**「packages/canvas 数据模型改造为字段级 patch（CRDT-ready）」，两者插在原 F12 之后、原形状组件之前，互不依赖可并行。原 F13-F23 整体顺延为 **F15-F24**，F15(形状)/F16(连接线)/F17(手绘)/F18(图表) 的 `notes` 已补 `blocked-on p6:F13 与 p6:F14`。原始需求分别见 `requirements/fabric-rendering-engine.md`、`requirements/widget-schema-field-level.md`。
> - `phases/phase-p8-collaboration/feature_list.json`：**p8:F01**「WebSocket + Redis 广播骨架（不含 Yjs 语义）」插在原 F01 之前，原 F01-F04 顺延为 **F02-F05**，形成链式依赖 F01→F02(Yjs同步)→F03(光标)→F04(跟随)→F05(重连指示)。原始需求见 `requirements/ws-redis-transport-skeleton.md`。F01 不依赖 p6 组件广度，可与 p6 并行推进。
>
> Wave 0 的四项技术工作现在全部有对应的、可独立排期/verify 的 feature，不再只是本文档里的规划性描述。

### Wave 0（已全部落进 feature_list）— 渲染层切换 Fabric.js + 数据模型换底座 + 协作骨架预埋

作为 p6/p8 的前置技术任务，四项互不阻塞（渲染引擎切换和数据模型改造可并行；WS/Redis 骨架独立于 p6，可与 p6 全程并行）：

1. **【p6:F13】引入 Fabric.js 并替换 `board-canvas.tsx` 的渲染层**：`apps/web` 加 `fabric` 依赖（用官方 npm 包 `fabric`，与 canvasx-main 一致；`@boardxus/canvasx-core` 是 boardx-web 的私有 fork，除非拿到访问权限，否则不依赖它）。把现有 `position:absolute` div 渲染换成 `<canvas>` + `fabric.Canvas` 实例挂载，note/rect 两种已有类型先用 Fabric 对象（`fabric.Rect`/自定义 Textbox 子类）重新实现。
   **回归风险**：P6 F01-F11（渲染/选择/拖拽/复制粘贴/undo-redo/pan-zoom）当前已经 `passing`，切换渲染引擎必须保证这些 feature 的 verification 不降级——建议先在一个 feature branch 上把已 passing 的 e2e 全部跑绿，再合并，不要一边切引擎一边加新 widget。p6:F13 的 verification 已经把这批既有 e2e 规格列进去。
2. **【p6:F14】重定义 `packages/canvas` 的 widget schema**：从"整条 item 替换"改成"字段级可寻址"（`{kind:"patch", id, patch:{...}}`，借鉴 `Y.Map<widgetId, Y.Map<field,value>>` 的形状，但先用普通对象实现，不引入 Yjs 依赖）。所有 F15 之后新增的 widget 类型都基于这个新 schema 写，避免二次重写。
3. **【p8:F01】打通 P8 依赖的基础设施**（不等 F02-F05 排期）：infra 已有 Redis（`infra/docker-compose.yml`），但**没有 WebSocket 网关**。这一步只验证 `apps/web` 或独立轻量服务能起一个 WS endpoint + Redis pub/sub broadcast 的最小骨架，不接 Yjs 逻辑，避免真正做 Yjs 同步（F02）时才发现要新起一个服务。

产出：渲染层换成 Fabric 之后，Wave 1 的形状/连接线/手绘/图表可以直接对齐 canvasx-main 的对象模型（甚至移植其算法）；P6/P7 继续铺广度时不会踩"数据模型不支持协作"的坑；P8 的 F02（Yjs 同步）启动时传输层骨架已在，只需要接 Yjs 语义进去。

### Wave 1 — P6 Canvas 广度补齐（F15-F21，not_started 的 7 项 + F07/F12）

在 p6:F13 落地的 Fabric 渲染层 + （待建的）新 schema 上补齐，现在可以参考/移植 canvasx-main 而不只是"思路借鉴"：

- **形状组件（F15）**：参考 `XShapeNotes/types.ts` 的 15 种预置形状 SVG path 定义，直接搬形状数据，包成自己的 Fabric 对象子类。
- **连接线+样式（F16）**：**直接移植 `XConnector/` 的端口吸附/自动重连/箭头算法**——这是 canvasx-main 里唯一产品级、测试覆盖最充分的子系统（6000+ 行 + 大量 spec），值得认真搬而不是重写。
- **手绘（F17）**：Fabric 自带 `PencilBrush`（`canvas.isDrawingMode = true` + `freeDrawingBrush`），比自研省事很多——**这里新代码反而能比 canvasx-main 做得更完整**（canvasx-main 只有 `isDrawingMode` 标志位，没有真正接上笔刷逻辑）。
- **图表（F18）**：参考 `XChart.ts` 对 chart.js 的封装方式（chart.js 渲染到 canvas/图片再贴进 Fabric，或用 DOM overlay 定位跟随，两种都要在这一步定下来）。
- 文本组件+样式+转便签（F12，不受 F13/F14 阻塞，可与 Wave 0 并行）、样式应用（F19）、锁定/删除/刷新（F20）、多选批量操作（F21）、对齐参考线补强到拖动多对象场景（F07，不受 F13/F14 阻塞）：无强依赖，按 Fabric 事件模型正常实现。

### Wave 2 — P7 Board 壳框架（F01/F02/F04-F08/F11/F12/F14，not_started 的 8 项，不含 blocked）

Header 框架（返回/同步指示/撤销重做入口）、标题编辑、Board 统计、备份恢复、Board-Menu 工具栏框架+组件创建入口、链接组件、Context-Menu 框架（复用 Wave 1 的复制/编组能力）。这批不依赖 p9/p10，可以和 Wave 1 并行。

### Wave 3 — P8 实时协作（5 项，全部 not_started，F01 已在 Wave 0 起步）

F01（WS+Redis 传输骨架，见 Wave 0）→ F02（Yjs 同步组件变更，替换 packages/canvas 的内存存储为 Y.Map 后端）→ F03（在线成员头像+光标，走 awareness）→ F04（跟随协作者，参考 boardx-web `FollowMeManager` 的广播模式）→ F05（连接状态/断线重连/同步指示，替换现有 `sync-status.tsx` 的"原型占位"注释）。

这一波做完后，`presence.tsx`/`collab-bus.ts` 的临时内存实现应该被真正的 awareness 替换掉，而不是并存。

### Wave 4 — 依赖解禁项（随 p9/p10 推进渐进点亮，不需要等它们全部 passing）

- p6-F22（图片+裁剪）、p7-F13 上传部分：p10 files 能力就绪即可点亮。
- p6-F23（文件+下载）：同上；音频转文本子项额外依赖 p9。
- p6-F24（组件 AI 助手）、p7-F10（语音转录）、p7-F13 AI 助手入口、p7-F16 Board Chat：依赖 p9 AI 运行时，可复用同一入口（feature_list 已标注复用关系）。
- p7-F09 PDF 导出、F15 导出选中内容/保存模板：依赖渲染/导出能力+模板系统，属于新增小型基础设施，可在 Wave 1 渲染引擎决策定下来后评估工作量。

### Wave 5 — UI 视觉收尾

现有 p17-F01（AI 浮层/工具 dock/board chat）应该**排在 Wave 0-3 之后**而不是现在——它依赖真实的 widget 广度和工具栏框架（Wave 1/2）、Board Chat 依赖 Wave 4 的 AI 入口。现在渲染引擎已确定要从 DOM div 换成 Fabric.js canvas（Wave 0），风险比之前评估的更高：**任何现在直接叠加在 `board-canvas.tsx` 现有 DOM 结构上的浮层/dock UI，在 Wave 0 把渲染层换成 `<canvas>` 之后大概率要重新定位/重新实现**（DOM 覆盖层定位逻辑依赖旧的 div 布局）。强烈建议 p17-F01 的编码工作**暂停，等 Wave 0 渲染层切换完成后再启动**，视觉稿/交互稿可以现在照常设计定稿。

## 6. 已决策的点

1. **渲染引擎路线（2026-07-03 确认，同日由 DOM/SVG 改为 Fabric.js）**：`apps/web` 引入 Fabric.js（官方 `fabric` npm 包），替换现有 DOM div 渲染。理由：canvasx-main 的 XConnector（连接线端口吸附/自动重连/箭头样式）是唯一产品级、测试覆盖充分的子系统，选 Fabric 可以直接移植这套代码，而不是在 SVG 上重新发明；手绘也能直接用 Fabric 自带的 `PencilBrush`。代价：Wave 0 需要先把渲染层切一遍，且要保证已 passing 的 P6 F01-F11 等 feature 的 verification 不因引擎切换而回归。
2. **p17-F01 暂停，等 Wave 0 完成**：渲染引擎切换会让现有 DOM 结构上叠的浮层/dock 失效，现在继续编码等于要返工。
3. **canvasx-main 复用范围**：XConnector 子系统可直接移植（产品级、Fabric 原生）；`XCanvas-interface.ts` 里画布级能力（pan/zoom/align/group/z-index/远程同步）不建议照搬其接口设计，因为它自己都没实现完，仍以 `boardx-web` 应用层"给 Fabric 原型打补丁"的模式为准。
