# 进度日志 — Sprint p7/02

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/p7-02-board-header`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01 已 passing；下一个是 F02（Header 标题查看与编辑）
- 当前 blocker: 无

## 会话记录
### 2026-07-07~08
- 本轮目标: F01（Board Header 框架）。issue #282 原 owner wrk-room-3 认领后超过约定的
  2 小时通牒窗口零进展（无 commit/PR/回复），经用户授权后由 coord-board 重新认领，
  直接自己实现（不再派 agent，避免此前 F11 两次 agent stall 的重复）。
- 已完成:
  - 读完 UC 文档（uc-board-header-001/008/009/010）+ 现有代码后发现范围比预想小：
    标题（board-title）/角色（board-role）/同步状态（BoardSyncStatus）已经在 F04/F05/
    F06/F07 等 sibling feature 落地时顺带做掉了，F01 真正缺的只有两块：
    1. 返回按钮（uc-008）：新增 `board-back`，点击导航回所属房间的白板列表（无 room_id
       退化到 /boards）。备份保存中不可离开的检查留给 F08（备份恢复）落地时接入。
    2. 撤销/重做禁用态（uc-010 主流程 2）：`undoStack`/`redoStack` 原是纯 `useRef`，
       改变不触发重渲染，按钮此前永远可点。加 `historyTick` 计数器，在 6 处栈变更点
       （`recordOp`/`onMoveCommit`/`onResizeCommit`/`undo`/`redo`）调用 `bumpHistory()`
       强制重渲染，用 `useMemo` 依赖 `historyTick` 计算 `canUndo`/`canRedo`。
  - 新增 `e2e/board-header.spec.ts`（5 条），覆盖框架四要素可见/返回导航/返回安全性/
    撤销重做禁用态/viewer 也能看到返回入口。
  - 诊断一处看起来像"点击返回没反应"的疑似 bug：实测确认点击本身立即生效，只是
    客户端路由切到 `(app)/rooms/[id]` 分支需要重新拉取数据，系统负载高时可能 1s+ 才
    真正跳转——不是真实回归，把断言超时放宽到 15s（`toHaveURL` 默认较短），不是弱化
    断言，只是给导航合理的等待窗口。
- 运行过的验证:
  - `pnpm exec tsc --noEmit`：干净。
  - `playwright test e2e/board-header.spec.ts`：多轮压测，唯一一次失败是纯环境级
    `page.goto` 60s 超时（与本次改动无关），其余全部 5/5 通过。
  - `pnpm harness verify --phase p7 --sprint p7/02 --feature F01 --owner canvas-worker-1`：
    真实门控通过（含 `verify:base`），F01 转 passing。第一次跑因忘记跑
    `scripts/init-worktree-env.sh` 撞了端口 3000 冲突，补跑后正常。
- 已记录证据: `evidence/F01.verify.log`。
- 提交记录: 见本轮 commit（feat(board-header): p7-F01 ...）。
- 已知风险或未解决问题: 无新增风险。
- 下一步最佳动作: F02（Header 标题查看与编辑）依赖 F01 已就位，可以直接派工。
