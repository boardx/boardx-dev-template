# 进度日志 — Sprint p6/10

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree `.claude/worktrees/p6-10-draw-chart`（分支 worker/canvas-worker-1-p6-f17-f18-draw-chart，直接基于 main）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`（本 worktree 已通过）
- 当前最高优先级未完成功能: 本 sprint F17/F18 均已 passing；剩余按 feature_list 排期
- 当前 blocker: 无

## 会话记录
### 2026-07-08 F17 手绘组件 + F18 图表组件（同分支同 PR）
- 本轮目标: 连续完成 F17（手绘）与 F18（图表），一个分支一个 PR。
- 已完成: F17 → passing，F18 → passing（均经 harness verify 门控，含 verify:base）。
  - **F17 手绘**：
    - 绘制走 fabric 原生 `isDrawingMode` + `PencilBrush`（v7 需显式实例化 brush），
      刻意避开"mouse:move 画临时预览对象"的自研路径（F16 已证实会破坏 fabric 命中判定）。
      `path:created` 时提取路径点序列、移除临时 path，由 items 数据流受控重渲染。
    - 持久化：type:"note"（服务端白名单未动）+ color 头 `draw` + `|borderw=3`；
      点序列存 text 字段 JSON `{"points":[[x,y],...]}`（相对包围盒左上角局部坐标，
      抽稀至 ≤300 点）。x/y/w/h 落包围盒（POST 忽略 w/h，与 color 合并一次 PATCH 补写）。
    - 渲染：fabric.Polyline 按 w/h 与原始包围盒比例缩放重建，笔色/线宽复用 F19 的
      border/borderw 段（Widget Menu wm-border/wm-border-width 免费获得编辑能力）。
    - 橡皮擦：eraser 工具 = 单击拾取（同 connectorPickMode 模式），只删 kind=draw
      的笔迹（不误删便签/形状），锁定笔迹给 notice；删除走 recordOp 撤销栈。
    - 回归：canvas-select.spec.ts 5/5 通过（isDrawingMode 未破坏点选/多选命中）。
  - **F18 图表**：
    - C 键图表模式（F11 占位）点击画布 → 真实创建柱状图（280x180，默认数据
      `{"labels":["A","B","C"],"values":[3,5,2]}`）。type:"note" + color `chart|kind=bar`。
    - 渲染：fabric.Rect 组合柱状图 + Textbox 标签，不引入图表库；数据 JSON 无效时
      渲染"数据无效"占位（可选中、可经编辑修复），不丢组件。
    - 编辑：单选图表 Widget Menu 出现 wm-chart-data「编辑数据」→ 复用既有 DOM
      textarea 编辑 text JSON（双击同效），保存即重渲染。
    - 菜单边界：图表/手绘不展示色板（color 头是类型判别位，setColor 会毁类型）、
      字重/文本样式/应用格式入口；图表额外隐藏边框/透明度节。
  - **修复一个 verify 抓到的真实竞态**（addShape/addText/addEmbed 同类潜伏问题）：
    "创建后 upsertItem 直写 collab doc"若只写部分字段（{color,w,h}），doc 会新建
    只含部分字段的条目，seedItems 对已存在 id 永不覆盖 → text 在 doc 视角长期缺失，
    mergeRemoteItems 合并窗口里 items 短暂拿到 text 为空的版本（e2e 实抓：kind=draw
    但 text 空）。修复：onDrawCreated/addChart 的 upsertItem 写完整字段
    （x/y/w/h/text/type/color）。既有三处旧调用未动（范围纪律，它们的 text 是短
    文案且无测试依赖，风险低——但属于同类潜伏问题，留给 coord-collab 的根治方案）。
  - board-menu.spec.ts 的 uc-board-menu-001/006/007/012 按新现状重写（原断言
    draw disabled / eraser 报不可用 / 图表点击不创建，均已与现实矛盾）10/10 通过。
- 运行过的验证:
  - `pnpm harness verify --sprint p6/10 --feature F17`（widget-draw.spec.ts 4/4 + verify:base）
  - `pnpm harness verify --sprint p6/10 --feature F18`（widget-chart.spec.ts 3/3 + verify:base）
  - 回归：canvas-select.spec.ts 5/5、board-menu.spec.ts 10/10
- 已记录证据: evidence/F17.verify.log、evidence/F18.verify.log
- 已知风险或未解决问题:
  - 环境：宿主机多 worktree 并行时 postgres 会被打进 recovery mode（register 500、
    room.id undefined 的假失败签名），docker restart postgres + 重跑 migrate 可恢复；
    docker 子网 172.23.0.0/24 与他人冲突，本 worktree 已改用 172.52.0.0/24。
  - 橡皮擦为 stroke 级删除（点击删除整条笔迹），像素级擦除不在本期范围（如实降级）。
  - 图表本期仅柱状图（UC 提到柱/线/饼；数据模型 kind=bar 段已为扩展留位）；AI 辅助
    生成图表 blocked-on p9（feature notes 已声明）。
- 下一步最佳动作: 开 PR（Closes #277/#278）、切 label in-review，等 coord-main 合并。
### 2026-07-06 F16 连接线组件
- 本轮目标: 完成 F16（连接线组件 + 连接线样式）
- 已完成: F16 → passing（verify 门控通过）。
  - 数据模型：连接线本身是一个 note-type item，用 color 哨兵扩展
    `|connector=1|from=<id>|to=<id>|linetype=<straight|curve>|arrow=<none|end|both>`
    （复用 F12/F15/F19/F20 已建立的 `|k=v` 编码约定，不新增持久化列）。
  - 创建交互：最初尝试拖拽+实时预览线（mouse:move 画临时预览对象），
    发现会污染 fabric 对其它对象的点击命中判定（具体机制未深究），改为
    **两次独立点击**：选连接线工具 → 点源组件 → 点目标组件 → 建连，
    不再有 mouse:move 预览、不再有临时预览对象，从根本上绕开该问题。
  - 跟随移动：组件移动/缩放时连接线端点重算路径，走既有 reconcile 机制。
  - 样式：Widget Menu 新增线型（直/曲）、箭头（无/尾部/两端）入口，复用
    F19 的边框色/线宽面板（连接线的"边框"即连接线本身的颜色/线宽）。
  - **顺带修复一个 verify 时抓到的真实回归**：`applyColors`（F11/F12/F19/
    F20/F16 共 15 处样式 setter 共用的落库函数）在同一交互序列里连续触发
    多个样式 setter 时（例如连接线的 border→borderWidth→线型→箭头 四连击），
    存在客户端 state 计算层面的竞态——每个 setter 都从可能未及时更新的
    `items` closure 读基准色再计算新值，后写覆盖前写。改为用 `itemsRef`
    （同步、每次 applyColors 调用后立刻前进）取代对 `items` state closure
    的依赖，从根本上修掉这类竞态。**中途踩过一次坑**：第一版修复用
    `setItems(prev => ...)` 的函数式更新器内部做计算+捕获 PATCH 数据，
    以为这样能保证时序正确——实际上 React 不保证 updater 在调用点同步执行，
    导致 captured 数组有时读到空值，样式改动反而丢得更多。改用 ref 方案后
    验证多轮稳定通过。
- 运行过的验证:
  - `pnpm harness verify --sprint p6/10 --feature F16`（含 widget-connector.spec.ts
    6/6 + verify:base 45/45）
  - 回归：widget-shape/widget-style/widget-text/widget-lock-delete-refresh/
    canvas-select/canvas-undo-redo，41 项里 40 项通过（1 项已确认是 main 上
    早已存在、与本次改动无关的预置问题，见下）
- 已记录证据: evidence/F16.verify.log
- 提交记录: 见本 sprint 分支 push 历史
- 已知风险或未解决问题:
  - **发现并单独立项的预置回归**：`widget-text.spec.ts:40`（字体/字号/斜体/
    对齐连续调整）在**未经本轮任何改动的 main 上单独隔离跑，3/3 次稳定失败**
    ——align 字段没有落地。已确认不是本轮引入（stash 掉全部改动复测同样失败），
    已开 issue #414 跟踪，需要专门一轮调试，不在 F16 范围内处理。
  - Playwright 在当前多 worktree 并行的重负载环境下，同一测试文件整体跑
    时长会从个位数秒膨胀到 40-50 秒，个别测试因此偶发超时（隔离单独跑
    均通过），这是环境负载问题，不是代码问题。
- 下一步最佳动作: F17（手绘组件），Fabric 自带 PencilBrush，预期成本低于
  F16；开工前建议先看一眼 #414 是否已有人认领/进展。
