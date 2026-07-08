# 进度日志 — Sprint p6/10

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree `.claude/worktrees/p6-10-connector`（分支 worker/canvas-worker-1-p6-f16-connector，直接基于 main，不再堆栈）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`（本 worktree 已通过）
- 当前最高优先级未完成功能: F17（手绘组件）
- 当前 blocker: 无

## 会话记录
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
