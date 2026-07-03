# 进度日志 — Sprint p6/08

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree `.claude/worktrees/canvas-p6-sprint08`（分支 worker/canvas-p6-f13-fabric，stacked 在 worker/canvas-p6-sprint08 之上）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`（本 worktree 已通过；node_modules 已切为真实 install）
- 当前最高优先级未完成功能: F07 对齐参考线增强 或 F12 文本组件（F13/F14 已 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-03 19:20
- 本轮目标: 开始 sprint-08，完成 F14（数据模型字段级 patch）
- 已完成: F14 → passing（verify 门控通过）。Command 新增 `{kind:"patch"}`，
  move/edit 降为别名，BoardItem 开放扩展字段，patch 不可改 id/type。
- 运行过的验证: `pnpm --filter @repo/canvas run test`（14 tests）、
  canvas 全量 e2e 回归（render/add/update/delete/select/copy-paste/undo-redo）、
  `pnpm -w run verify:base`。
- 已记录证据: evidence/F14.verify.log（verify 脚本写入）
- 提交记录: 1a52a30 feat(canvas): p6-F14 数据模型改造为字段级 patch
- 已知风险或未解决问题: F13 的「既有 e2e 不回归」与「渲染切到 <canvas>」存在
  张力——现有 e2e 断言 DOM 元素（data-item-id div、items-layer 点击），纯
  canvas 渲染后这些 DOM 锚点消失。见 session-handoff 的决策项。
- 下一步最佳动作: 先决策 F13 的 e2e 锚点策略，再动 board-canvas.tsx。

### 2026-07-03 23:40
- 本轮目标: 完成 F13（画布渲染引擎切换 Fabric.js，既有行为不回归）
- 已完成: F13 → passing（verify 门控通过）。item 渲染与交互（选中框/拖拽/
  Shift 多选/双击编辑/右键）切到 fabric.Canvas（官方 npm fabric@6.9.1）；
  数据流不变（React 状态权威 + REST 落库 + F14 patch 语义）；周边 DOM UI
  （工具栏/Widget Menu/右键菜单/selection-count/缩放控制条/小地图）不变。
  视口方案: CanvasViewport 保留 CSS transform surface（DOM 覆盖层 + collab
  data-vp-* 锚点），fabric canvas 1:1 铺满、viewportTransform 镜像 pan/zoom。
- e2e 锚点: 按策略 2（issue #269，人类批准）迁移为 canvas 兼容锚点
  （window.__canvasTestApi + <canvas> 坐标点击），断言意图逐条保留；新增
  canvas-fabric-engine.spec.ts；e2e/helpers/canvas.ts 为公共锚点工具。
- 运行过的验证: F13 verification 全量（11 spec）+ verify:base；受影响 16 spec
  单独逐个跑绿。基线留档 evidence/F13.baseline-e2e.log。
- 预置失败（非本轮引入，与基线一致）: board-menu-001「矩形」断言、
  widgets-001/004 的 add-shape testid——均为 main 上 F01 的锚点，本分支源码
  无该入口；迁移后失败点与基线完全一致。
- 已记录证据: evidence/F13.verify.log（verify 脚本写入）
- 已知风险或未解决问题: 见 session-handoff。
- 下一步最佳动作: F07（对齐参考线增强）或 F12（文本组件）——在 fabric
  对象模型上实现，成本已显著降低。
