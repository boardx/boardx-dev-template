# 会话交接 — Sprint p7/02

## 当前已验证
- F01（Board Header 框架）：passing（已合并 main，见 #434）。
- F02（Header 标题查看与编辑）：passing。
  验证命令：`docker compose -f infra/docker-compose.yml up -d` /
  `pnpm --filter @repo/data run migrate` /
  `pnpm --filter @repo/web exec playwright test e2e/board-title.spec.ts`（5/5）+
  `pnpm -w run verify:base`。证据：`evidence/F02.verify.log`。
- F03（分享 Board）：passing。
  验证命令：同上 + `pnpm --filter @repo/web exec playwright test e2e/board-share.spec.ts`
  （3/3）+ `pnpm -w run verify:base`。证据：`evidence/F03.verify.log`。
- F06（Board 统计信息）：passing。
  验证命令：同上 + `pnpm --filter @repo/web exec playwright test e2e/board-statistics.spec.ts`
  （3/3）+ `pnpm -w run verify:base`。证据：`evidence/F06.verify.log`。
- F08（Board 备份与恢复）：passing。sprint p7/02 至此全部完成。
  验证命令：同上 + `pnpm --filter @repo/web exec playwright test e2e/board-backup.spec.ts`
  （3/3）+ `pnpm -w run verify:base`。证据：`evidence/F08.verify.log`。

## 本轮改动（F08）
- 新表 `board_backups`（migration `031_board_backups.sql`，bigint identity PK + jsonb
  snapshot）；数据层 `packages/data/src/backups.ts`（create/list/get/restore，restore 为
  事务删旧插新、保留原 item id、失败 ROLLBACK）；API
  `apps/web/app/api/boards/[id]/backups/`（POST/GET + :backupId/restore，canManageBoard
  权限，403/404 风格对齐 boards/[id]/route.ts）；board 页 Header 新增"备份"面板
  （canManage 才显示，创建 + 列表 + 行内二次确认恢复，成功/失败明确反馈）。恢复后画布
  由既有 1.5s items 轮询自动刷新，无需额外接线。
- 踩坑记录（对后人有用）：pg 的 bigint 列以 string 返回，跨层做 id 相等比较必须先
  `Number()`（本轮 restore 恒 404 的根因）。宿主机多 worktree 并发时 postgres 容器可能
  被资源压力打进 recovery mode（表现为 "the database system is in recovery mode"），
  restart postgres + 等 pg_isready 后重跑即可；docker 子网冲突改 infra/.env 的
  COMPOSE_SUBNET 换一个未占用段即可（该文件 gitignored）。

## 下一步
- sprint p7/02 五个 feature 全部 passing，无未完成项。PR 见 worker/canvas-worker-1-p7-f08-backup
  分支（Closes #286），等 review 合并即可关 sprint。

## 本轮改动（F02）
- `apps/web/app/(app)/boards/[id]/page.tsx`：`board-title` 从纯 `<h1>` 改为可点击行内
  编辑（`canManage` 才可点，匹配 `PATCH /api/boards/:id` 服务端权限要求，与更宽松的
  `canEdit` 不同）。点击 → `board-title-input` 替换显示 → Enter/失焦保存，Escape 取消。
  空标题失焦时恢复原值，不保存空名。保存失败恢复原值并展示 `board-title-err`。新增
  `document.title` 同步 useEffect（uc-002 主流程 5）。
  与既有"元信息编辑"侧栏（`board-meta-edit`/`meta-name` 表单）是两条独立入口，本轮不动
  那条路径。

## 本轮改动（F03）
- 分享面板的访问范围从只读文案（`<p data-testid="share-visibility">`）改为真实
  `<select>`（同一个 testid，复用既有 `changeVisibility` 函数），Room Owner/Admin 可切换，
  其它用户禁用但仍显示当前值（不是隐藏，是 disabled）。移除了不再使用的 `visibilityLabel`
  变量。
- 二维码从占位 `<div>` 改为真实生成（新增依赖 `qrcode` + `@types/qrcode`），展开时用
  `QRCode.toDataURL(shareUrl)` 生成图片，收起后不保留（下次展开重新生成）。
- **顺手修复一个被本轮暴露的既有测试竞态**（`e2e/board-visibility.spec.ts:72`）：
  `selectOption("public")` 只触发 onChange，不等待 `changeVisibility` 的
  PATCH+refresh 异步落地就立刻 `reload()`，是竞态不是本轮引入的回归（baseline 上也存在，
  概率较低此前未被注意到）。改为先用 REST 直接轮询确认落库，再 reload。

## 本轮改动（F06）
- 新增 `GET /api/boards/:id/statistics`（服务端聚合，替代原来"客户端拉全量 items 本地数"
  的实现——原实现在大板场景要整份 items 拉一遍）：组件按 kind 分类计数（note/text/
  shape/connector/embed，分类规则与 board-canvas.tsx 的 isConnector/isText/isShape/
  isReloadable 优先级保持一致，两处独立维护，见 route.ts 里的注释说明为什么不做成共享
  模块）、协作者数（复用既有 `listRoomMembers`）、最近创建时间（`MAX(board_items.
  created_at)`，诚实标注为"最近创建"而非"最近编辑"——board_items 目前没有 updated_at
  跟踪字段，不能声称能测到编辑时间）。
- `apps/web/components/board/board-statistics.tsx`：改为调用新端点；保留
  `stat-total`/`stat-notes`/`stat-texts` 三个既有 testid 语义不变（旧的
  `board-header-014-statistics.spec.ts` 依赖这三个，已跑过确认不回归），新增
  `stat-shapes`/`stat-connectors`/`stat-members`/`stat-last-created`。

## 仍损坏或未验证
- F06 的"最近创建时间"不等价于"最近编辑时间"（见上方说明），如果后续业务明确要精确到
  编辑时间，需要给 `board_items` 加 `updated_at` 并在每次 PATCH 时更新，这是数据层改动，
  超出本轮范围。
- 与本轮无关：`(app)/rooms/[id]` 分支客户端路由切换偶发 1s+ 延迟（F01 已记录过）。

## 下一步最佳动作
- F08（备份与恢复，issue #286）是本 sprint 最后一个 feature，是真正从零开始的工作
  （当前 app 完全没有 `board_backups` 表/API，只在 `phases/requirements/oldcode` 里有
  参考实现），工作量明显大于本轮三个 feature，建议单独一轮做，不要和其它 feature 一起赶。
- 不要碰：`apps/web/app/api/board-items/[itemId]/route.ts` 与
  `apps/web/app/api/boards/[id]/items/route.ts` 的白名单（已确认不可扩展）。
- 每个新 worktree 记得先跑 `bash scripts/init-worktree-env.sh` 再 `docker compose up`。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --phase p7 --sprint p7/02 --feature F02 --owner canvas-worker-1`
  （F03/F06 同理换 feature id）
- 调试: `pnpm --filter @repo/web exec playwright test e2e/board-title.spec.ts e2e/board-share.spec.ts e2e/board-statistics.spec.ts --reporter=list`
