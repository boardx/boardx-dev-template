# 会话交接 — Sprint p6/08

## 第二轮返工（2026-07-03，PR #315 coordinator 第三次打回后修复）
- **阻断项已解决**（详见 progress.md 同日条目 + PR #315 评论）：
  1. `git merge origin/main`（663feb3）带入 #313 evidence gitignore 白名单 +
     p17-F01 底部 dock/AI 浮层；冲突在 board-canvas.tsx（纯新增非语义冲突）
     和 PROGRESS.md（采用 origin/main 版本）已解决，typecheck 21/21 通过。
  2. F07.verify.log 重新生成并确认真正 git add 入库（e7f817c）。
  3. 新增 evidence/F07.regression-triage.md，对 43 个 canvas/widget/board
     e2e spec 顺序回归，与 F13.verify-full-triage.md 逐条对照归因。
- **下一轮必须先处理**（否则可能被下次 review 打回）：
  1. `apps/web/e2e/board-ai-overlay.spec.ts` 第 79 行「从底部 dock 新建
     便签」用例断言 `items-layer` 内 `[data-testid^="item-"]` 计数，但 F13
     把渲染切到 fabric.Canvas 后 items 画在 `<canvas>` 上，不再产出该 DOM
     节点——测试恒定失败。需要改用 `e2e/helpers/canvas.ts` 里 F13 已有的
     fabric 侧计数辅助（`expectItemCount`/`canvasItems`），或者给 fabric
     渲染的 item 补一层可查询锚点。这是 p17-F01 测试与 F13 渲染层的接口
     断层，不属于 board-ai-overlay 业务逻辑本身的 bug，修复时只改测试
     断言方式，不要改 dock/overlay 的产品行为。
  2. 6 个回归结果未决的 spec（board-list-search「UI：搜索过滤房间白板
     列表」、board-visibility「UI：房间 owner 在板页切换可见范围到
     public」、canvas-add/delete/render/update 各一条用例）需要在干净的
     单文件隔离环境下（不与其它 42 个 spec 顺序共享 dev server/db 进程）
     重跑确认是否为真实回归；如是真实回归需定位修复，不能带着未解释的
     失败继续推进。
  3. board-menu-003「添加文本→自动选中」失效与 F13 triage 里「添加形状→
     自动选中」失效疑似同一处 selectItem/自动选中调用路径的通用缺陷，
     建议合并排查根因。
  4. 中严重度修复未做（coordinator 建议但非阻断，本轮范围纪律优先跳过）：
     拖动/缩放热路径每帧 O(n) 遍历 + others 数组重建（建议手势开始时快照
     缓存）；object:modified 的 no-op resize（from==to）污染 undo 栈（提交
     前加短路判断）；board-items API route 的 w/h 缺 Number.isFinite 防护
     （grep `apps/web/app/api/board-items/[itemId]/route.ts` 和
     `apps/web/app/api/boards/[id]/items/route.ts`）。

## 已完成
- **F14 passing**：packages/canvas 字段级 patch 命令运行时。
- **F13 passing**：画布渲染引擎切换 Fabric.js（渲染适配器
  `apps/web/components/board/fabric-canvas.tsx`，e2e 走策略 2 canvas 锚点
  `e2e/helpers/canvas.ts` + `window.__canvasTestApi`）。
- **F07 passing**（evidence/F07.verify.log，e2e：`e2e/canvas-guidelines.spec.ts`）：
  对齐参考线增强（uc-canvas-007）。
  - 纯几何全部在 `apps/web/lib/canvas-snap.ts`（computeSnap / computeSpacingSnap /
    computeResizeSnap），单测 `lib/canvas-snap.test.ts`（14 条）。渲染层只消费结果。
  - 等间距提示：DOM 覆盖层 `spacing-hint`（data-orientation/data-gap，间距线+徽标）；
    参考线仍是 DOM `alignment-guide`（canvas-007 断言锚点不变）。
  - 角点缩放：单选 item 四角控制点（fabric `uniformScaling: false`，Shift 临时等比；
    中点与多选缩放关闭）。缩放矩形按**指针意图**（gesture.downScene + 指针位移）推导，
    不要改回读 fabric 原生 scale（含描边/padding 偏差，未拖动轴会漂移 ~1px）。
  - w/h 落库：PATCH /api/board-items/:id 与 @repo/data updateItem 支持 w/h 成对更新；
    resize 是可逆 Op（undo=from / redo=to）。
  - widget-menu 的「缩放暂不可用」占位已移除（widgets-001 断言同步 toHaveCount(0)）。
- **Issue #316 review follow-up verified**（evidence/issue-316-review-followup.md）：
  F13/F14/F07 之后的 Medium/Low 健壮性项已落地，包括 selection reconcile guard、
  disposed init guard、动态空白画布点击锚点、ItemPatch id/type 语义收紧与
  `x: undefined` patch 单测、screen rect 去重、Fabric object metadata WeakMap 化。
  验证覆盖 canvas unit/typecheck、web typecheck/lint、canvas/widget Playwright
  回归 34 条、`verify:base` 45/45。

## 已知预置失败（非本 sprint 引入，档案 evidence/F13.verify-full-triage.md）
- widgets-001 用例 1 / widgets-004 两用例（`add-shape` testid）与 board-menu-001
  「矩形」断言等 19 例：基分支即红，与 main 合并时随 F01 代码自然转绿。
  F07 回归复测（17 spec）：38 过 / 3 败，失败与档案逐条同名。

## 环境注意
- worktree node_modules 为真实 pnpm install（fabric 已装）。
- docker project `worker-canvas-p6-sprint08`（pg:65380/redis:65381/web:65382，
  E2E_PORT=65382 见 apps/web/.env.local）。
- 分支栈：worker/canvas-p6-f07-guidelines → base worker/canvas-p6-f13-fabric（stacked PR）。
- #316 使用独立 Codex worktree `/private/tmp/boardx-worktrees/issue-316-canvas-review-fixes`
  与分支 `codex/issue-316-canvas-review-fixes`，base 为 `worker/canvas-p6-f07-guidelines`。

## 下一个 feature：F12（文本组件 + 文本样式 + 文本转便利贴）
- 在 fabric 对象模型上做（kind:"text" 渲染分支已在 fabric-canvas.tsx）。
- 现有「文本」是 note + color:"text" 哨兵（服务端只放行 note/rect）；
  F12 若要扩展样式字段，优先走 F14 的字段级 patch（BoardItem 开放扩展字段），
  服务端路由/校验是否放行新字段需先查 `app/api/board-items` 与 @repo/data。
- 文本编辑仍是 DOM textarea 覆盖层（item-edit-<id> 锚点），别搬进 fabric IText。

## 复现路径
```bash
cd .claude/worktrees/canvas-p6-sprint08
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @repo/web exec playwright test e2e/canvas-guidelines.spec.ts   # F07 3 条
pnpm --filter @repo/web exec vitest run lib/canvas-snap.test.ts              # 几何单测 14 条
pnpm harness verify --sprint p6/08 --feature F07 --owner canvas-worker-1     # 幂等（已 passing）
```
