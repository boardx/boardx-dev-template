# 会话交接 — Sprint p7/02

## 当前已验证
- F01（Board Header 框架：状态/授权入口/返回/同步指示/撤销重做）：passing。
  验证命令：`docker compose -f infra/docker-compose.yml up -d` /
  `pnpm --filter @repo/data run migrate` /
  `pnpm --filter @repo/web exec playwright test e2e/board-header.spec.ts`（5/5）+
  `pnpm -w run verify:base`（harness verify 自动跑，通过）。
  证据：`phases/phase-p7-board-shell/sprints/sprint-02/evidence/F01.verify.log`。

## 本轮改动
- `apps/web/app/(app)/boards/[id]/page.tsx`：新增返回按钮（`board-back`，uc-008），
  点击导航回所属房间的白板列表（`board?.room_id` 为空时退化到 `/boards`）。
- `apps/web/components/board/board-canvas.tsx`：撤销/重做按钮补齐禁用态（uc-010 主流程
  2）——`undoStack`/`redoStack` 是纯 `useRef`，原来改变不触发重渲染，按钮永远可点。
  新增 `historyTick` 计数器 + `bumpHistory()`，在 `recordOp`/`onMoveCommit`/
  `onResizeCommit`/`undo`/`redo` 六处栈变更点调用，`useMemo` 依赖 `historyTick` 算
  `canUndo`/`canRedo`。
- `apps/web/e2e/board-header.spec.ts`（新增）：5 条测试，见上方"验证"。

## 仍损坏或未验证
- 无本 feature 范围内的已知问题。
- 与本 feature 无关但顺带发现：`(app)/rooms/[id]` 分支的客户端路由切换在系统负载高时
  可能有 1s+ 的可感知延迟（已确认不是"点击无效"，只是导航慢），本 feature 的测试已放宽
  超时窗口容忍，未深挖是否值得单独优化（低优先级，不阻塞任何东西）。

## 下一步最佳动作
- F02（Header 标题查看与编辑）依赖 F01 已就位，可以直接派工，issue #283。
- 不要碰：`apps/web/app/api/board-items/[itemId]/route.ts` 与
  `apps/web/app/api/boards/[id]/items/route.ts` 的白名单（已确认不可扩展）。
- 每个新 worktree 记得先跑 `bash scripts/init-worktree-env.sh` 再 `docker compose up`，
  本轮因为漏跑这一步撞过一次端口 3000 冲突，浪费了一轮 verify。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --phase p7 --sprint p7/02 --feature F01 --owner canvas-worker-1`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/board-header.spec.ts --reporter=list`
