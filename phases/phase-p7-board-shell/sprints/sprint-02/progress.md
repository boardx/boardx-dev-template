# 进度日志 — Sprint p7/02

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/p7-02-board-header`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01/F02/F03/F06/F08 全部 passing，sprint p7/02 完结
- 当前 blocker: 无

## 会话记录
### 2026-07-08（F08 备份与恢复）
- 本轮目标: F08（Board 备份与恢复，issue #286），本 sprint 唯一从零开始的 feature。
- 已完成:
  - Migration `031_board_backups.sql`：`board_backups` 表（bigint identity PK，对齐本库
    惯例——全库无 uuid PK 先例；snapshot 为 items 的 jsonb 数组；(board_id, created_at DESC) 索引）。
  - 数据层 `packages/data/src/backups.ts`：createBackup（读当前 board_items 全量存 jsonb）、
    listBackups（不含快照体）、getBackup、restoreBackup（事务：DELETE 全部 items → 逐条
    INSERT 快照内容保留原 id → COMMIT，失败 ROLLBACK 白板保持原状态）。
  - API：`POST/GET /api/boards/:id/backups`、`POST /api/boards/:id/backups/:backupId/restore`，
    权限均为 canManageBoard（403 否则），错误码风格照抄 boards/[id]/route.ts；restore 前
    校验 backup 属于该 board（否则 404）。
  - UI：board 页 Header 加"备份"入口（canManage 才显示）→ 面板：label 输入 + 创建、
    历史列表（label+时间）、每条"恢复"→ 行内二次确认（同 confirmingDelete 模式）→
    成功/失败均有明确反馈；恢复失败服务端事务已回滚，白板保持原状态。
  - e2e `board-backup.spec.ts`（3 条）：API 创建/列表/恢复回到备份时刻（含空 label 400、
    跨 board backupId 404）；UI 全流程含行内确认 + REST 断言 items；viewer 无入口 + API 403。
- 发现并修掉的真实 bug: pg 把 bigint 列以 string 返回，`backup.board_id !== boardId`
  严格比较恒不相等 → restore 恒 404。统一 `Number()` 后比较（数据层 + 路由两处）。
- 运行过的验证: `pnpm --filter @repo/data run typecheck`、`pnpm --filter @repo/web run
  typecheck` 干净；`pnpm harness verify --sprint p7/02 --feature F08` 真实门控通过
  （migrate + board-backup.spec.ts 3/3 + verify:base），F08 → passing。
- 环境噪音记录: 宿主机资源压力导致 postgres 容器多次被打进 recovery mode（全系统多
  worktree 共性问题，非本栈引入），另遇 docker 子网 172.23.0.0/24 与旧 worktree 网络冲突，
  改用 172.39.0.0/24（仅 infra/.env，gitignored）。重启 postgres + 预热 dev server 后
  spec 与 verify 均完整绿。
- 已记录证据: `evidence/F08.verify.log`。
- 已知风险或未解决问题: UC 提到的备份缩略图未做（feature 定义只要求 label+时间+恢复，
  快照无截图来源）；备份保存中阻塞返回导航（F01 留的口子）未接——创建备份是短同步请求，
  面板内有 busy 态，实际窗口极小。
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

### 2026-07-08（续）
- 本轮目标: F02 + F03 + F06（同一 owner 顺序认领，逐个走完 claim → 实现 → verify）。
  F01 合并后旧 worktree 分支已完全并入 main，其余提交在 rebase 时都变成噪音冲突，
  改用全新 worktree（`p7-02-header-features`）+ 全新分支重新开始。
- 已完成:
  - F02：标题从纯展示 `<h1>` 改成行内可编辑，PATCH 权限按 `canManage`（不是更宽松的
    `canEdit`）门控，跟服务端 `canManageBoard` 保持一致。
  - F03：分享面板访问范围从只读文案换成真实可交互 `<select>`；二维码从占位换成用
    `qrcode` 包真实生成。
  - F06：新增服务端聚合统计接口 `GET /api/boards/:id/statistics`（组件按 kind 分类 +
    协作者数 + 最近创建时间），替换原来客户端拉全量 items 本地计数的实现。
  - 顺手修了一个被 F03 压测暴露的既有测试竞态（`board-visibility.spec.ts:72`，
    `selectOption` 不等待异步保存就 reload），不是本轮引入的回归。
- 运行过的验证:
  - 三个 feature 各自 `pnpm exec tsc --noEmit` 干净、专属 e2e 全绿、
    `pnpm harness verify --phase p7 --sprint p7/02 --feature <F02|F03|F06> --owner
    canvas-worker-1` 真实门控通过（含 `verify:base`）。
  - 跑过受影响的旧 sibling spec 确认无回归：`board-header-003-share-board.spec.ts`、
    `board-header-014-statistics.spec.ts`、`board-header-001-use-board-header.spec.ts`、
    `board-settings.spec.ts`、`board-visibility.spec.ts`。
  - F06 首次跑遇到过一次 e2e 假失败（`stat-total` 元素找不到），复测后确认是 Next.js
    dev 模式下全新路由第一次请求的编译冷启动延迟（同一 spec 里后面两条测试命中同一
    已编译路由都很快），不是代码问题，单独重跑 + 全量重跑都干净通过。
- 已记录证据: `evidence/F02.verify.log`、`evidence/F03.verify.log`、
  `evidence/F06.verify.log`。
- 提交记录: 见本轮 commit（feat(board-header): p7-F02/F03/F06 ...）。
- 已知风险或未解决问题: F06 的"最近创建时间"不等价于"最近编辑时间"（board_items 无
  updated_at 字段可用），已在 session-handoff.md 里记录清楚，不是伪装成已完成。
- 下一步最佳动作: F08（备份与恢复）是本 sprint 最后一个、也是工作量明显更大的
  feature（真正从零建，不是"底层已有、缺个入口"的模式），建议单独一轮做。
