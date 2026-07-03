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

### 2026-07-04 02:30
- 本轮目标: 完成 F07（拖动时的对齐参考线——uc-canvas-007 增强）
- 已完成: F07 → passing（verify 门控通过，evidence/F07.verify.log）。
  UC 与现状 diff 出的三个增量全部落地：
  1) **等间距吸附与提示**：`lib/canvas-snap.ts` 新增 computeSpacingSnap
     （三构型：右延续/左延续/两侧居中，横轴投影重叠过滤），拖动中某轴无
     边/中心吸附时生效；DOM 覆盖层新增 spacing-hint（间距线 + 间距值徽标）。
  2) **角点缩放吸附**：单选 item 开放四角缩放控制点（fabric uniformScaling=false，
     中点/多选仍关闭）；computeResizeSnap 只让移动边参与对齐；缩放矩形由
     指针意图推导（downScene 基准 + 指针位移，规避 fabric scale 的描边/padding
     偏差）；提交走新的 resize 可逆 Op（undo=from/redo=to）+ PATCH w/h 落库
     （route 与 @repo/data updateItem 扩展 w/h，最小 8px）。
  3) **中心对齐可视化**：computeSnap 原有中心锚点在不同宽度组件下的参考线
     行为由新 e2e 显式覆盖。
- widget-menu 的「缩放暂不可用」占位按钮移除（能力已真实可用），
  widgets-001 对应断言同步改为 toHaveCount(0)。
- 运行过的验证: `vitest run lib/canvas-snap.test.ts`（14 条）+ 全量 unit（37 条）；
  `playwright test e2e/canvas-guidelines.spec.ts`（3 条新用例全绿）；
  canvas/widget 回归 17 个 spec：38 过 / 3 败，失败三条与
  evidence/F13.verify-full-triage.md 档案化预置红灯逐条同名（add-shape 缺失，
  非本轮引入）；canvas-007 基线保持绿；harness verify 门控 + verify:base 通过。
- 已记录证据: evidence/F07.verify.log（verify 脚本写入）
- 提交记录: 870abbd（几何+单测）/ 3270fa8（渲染+API）/ e2e+缩放修正 commit
- 已知风险或未解决问题: fabric 等比缩放改为默认关闭（Shift 仍可等比），
  若后续 feature 需要默认等比需重新权衡；多选（ActiveSelection）缩放仍关闭。
- 下一步最佳动作: F12 文本组件（见 session-handoff）。

### 2026-07-04 02:55
- 本轮目标: 完成 GitHub issue #316（p6/08 F13/F14 review 的 Medium/Low 健壮性修复）。
- 已完成: #316 follow-up 已实现并验证。修复点包括 Fabric reconcile 不再无条件
  `discardActiveObject()`、Fabric init disposed guard、e2e 空白画布点击改走
  `window.__canvasTestApi.getCanvasBlankScreenPoint()`、`ItemPatch` 收紧 id/type
  语义并补 `x: undefined` patch 单测、屏幕矩形计算去重以及 Fabric 对象元数据改用
  WeakMap。
- 运行过的验证: `pnpm --filter @repo/canvas run test`（15 tests）、
  `pnpm --filter @repo/canvas run typecheck`、`pnpm --filter @repo/web run typecheck`、
  `pnpm --filter @repo/web run lint`（仅既有 LABEL-LANG-MIX warning）、
  `pnpm --filter @repo/data run migrate`、canvas/widget 相关 13 个 Playwright spec
  全量回归（34 passed）、`pnpm -w run verify:base`（45/45）。
- 已记录证据: evidence/issue-316-review-followup.md
- 已知风险或未解决问题: 无 #316 新增 blocker；本 issue 是已 passing F13/F14/F07 之上的
  review follow-up，不手改 harness passing 状态。
- 下一步最佳动作: 开 draft PR 并把 GitHub issue #316 推到 status:in-review。
