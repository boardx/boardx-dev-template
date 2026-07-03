# 进度日志 — Sprint p20/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: <feature id / title>
- 当前 blocker: <无 / 描述>

## 会话记录
### 2026-07-03 11:40:28
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-04 (wrk-room-3, F10)
- 本轮目标: F10 下线 legacy 单画布模型（迁移 + 路由收敛）。
- 已完成:
  - 新迁移 packages/data/migrations/022_retire_room_canvas.sql：为有 legacy items（board_id IS NULL）
    的房间建/复用默认 board "Main board"，回填 board_id，随后 ALTER COLUMN board_id SET NOT NULL；
    幂等可重跑（同名板复用、INSERT 0 0 / UPDATE 0 验证过）。
  - /rooms/[id]/board 页面删除，改为服务端 redirect 到 /rooms/[id]/boards（307，非 404）。
  - /api/rooms/[id]/items 与 legacy 单条 /api/items/[id] 全方法 410 Gone。
  - canvas-add/render/update/delete 四个存量 e2e 迁移到 board 模型
    （POST /api/rooms/[id]/boards 建板 → /boards/[id] 画布页 + /api/boards/[id]/items + /api/board-items/[itemId]）。
  - 新契约 spec e2e/room-rr-010-legacy-canvas-retire.spec.ts（5 用例）。
- 运行过的验证: pnpm harness verify --sprint p20/01 --feature F10 → 门控通过，F10 = passing；
  回归 canvas-add/render/update/delete + room-rr-001 + board-create 共 14 用例全过。
- 已记录证据: evidence/F10.verify.log（*.log gitignore，本地落盘；feature_list evidence 字段已由门控写入）。
- 已知风险: board_items.board_id 已 NOT NULL——后续新写路径必须带 board_id（现存唯一写路径
  /api/boards/[id]/items 恒带）。
- 下一步最佳动作: 合并 PR 后其余 wave1 feature 不受影响。

### 2026-07-04 (wrk-room-3, F10 review 返工)
- review（PR #312）返工：
  1. 证据入库：合入 coord/evidence-gitignore-exception（.gitignore 加 !phases/**/evidence/*.log），
     F10.verify.log 已 git 跟踪；日志含 psql count 原始输出（0）、防混入 fixture 表、幂等重放输出。
  2. 迁移 022 改专用标记方案：boards 加 created_by_migration 列（仅迁移写入），建板/回填只认标记
     '022_retire_room_canvas'，用户自建同名 "Main board" 一律不复用。fresh DB fixture 实测：
     用户板 items 不混入（user-a1 独立），legacy items 全部落迁移标记板，count NULL=0，重放 INSERT 0 0/UPDATE 0。
  3. canvas-add/delete、room-rr-010 spec 的 (page: any) → (page: Page)。
- status 曾按 coordinator 指示回退 in_progress + 清空 evidence，重新由
  `pnpm harness verify --sprint p20/01 --feature F10` 门控转 passing（非手改）。
### 2026-07-04 (wrk-room-2 / F07)
- 本轮目标: p20/F07 房间权限矩阵统一（API 断言 + 文档对齐），issue #300。
- 已完成:
  - PATCH /api/rooms/[id] 从仅 owner 放宽为 canManageRoom（owner∨admin）；DELETE 仍仅 owner。
  - PATCH /api/rooms/[id]/members/[userId]（提升/降级 admin）收紧为仅 owner。
  - members 页 UI 按角色收敛：角色下拉仅 owner 可见；admin 只对 member 行显示移除按钮。
  - 新增 e2e room-rr-007-permission-matrix.spec.ts（8 用例，矩阵每行正/反覆盖）。
  - 文档对齐：role-diagrams/room-{owner,admin,member}.md 重写（补 Survey/Files 节点，owner/admin 差异真实化）；phase-04 F12 user_visible_behavior 改为 owner/admin 口径（仅描述文字）。
- 运行过的验证: F07 三条 verification 全绿；回归 room-003/room-manage/room-rr-001 共 11 用例全过；design lint + tsc 过；pnpm harness verify --sprint p20/01 --feature F07 门控通过（F07=passing）。
- 已记录证据: evidence/F07.verify.log（gitignore 的 *.log，本地留存）。
- 已知风险或未解决问题: 矩阵「删除他人文件」行的 API 由 F03 交付，端点就绪后在 F03 e2e 断言（spec 内已注明）；房间删除入口 UI 目前不存在，无需隐藏。
- 下一步最佳动作: 等 PR review 合并；F03 交付文件库时按矩阵补删除他人文件断言。

### 2026-07-04 (wrk-room-2 / F07 review 返工)
- 本轮目标: PR #311 review 结论 CHANGES，逐项返工。
- 已完成:
  - 【阻断修复】证据入库：合入 coord/evidence-gitignore-exception（.gitignore 白名单 `!phases/**/evidence/*.log`）；F07 status 回退 in_progress + evidence 清空后重新 `pnpm harness verify --sprint p20/01 --feature F07` 门控转 passing，`evidence/F07.verify.log` 已被 git 跟踪进 commit。
  - 【矩阵缺口归属】uc-rr-006 矩阵中两行本 feature（F07）无法断言，归属如下：
    - 「admin 修改 AI 上下文字段」→ **归 F11**（rooms 表尚无 description/ai_instruction 字段，F11 回补时其 e2e 按矩阵断言 owner/admin ✅ / member 403）。F07 已把 PATCH /api/rooms/[id] 放宽为 canManageRoom，同端点未来字段自动继承该权限口径。
    - 「admin 删除他人文件」→ **归 F03**（房间文件端点尚未建，F03 交付 Files tab 时其 e2e 按矩阵断言 admin 可删他人文件 / member 仅本人）。
    - room-rr-007-permission-matrix.spec.ts 头部注释已同步注明缺口与归属。
  - 【建议项】e2e 的 `playwright: any` 改为 `PlaywrightWorkerArgs["playwright"]` 精确类型；spec 头部补 F07 / uc-rr-006 / rr-007 编号映射说明。
- 运行过的验证: `pnpm harness verify --sprint p20/01 --feature F07` 门控通过（F07=passing，含 verify:base）。
- 已记录证据: evidence/F07.verify.log（已入库，git 跟踪）。
### 2026-07-04 (wrk-room-1)
- 本轮目标: F02 创建房间时选择可见性（Private/Team 二选一卡片）（issue #299）
- 已完成: New Room 表单改为可见性二选一卡片（room-create-visibility-private/-team，默认 Private）+
  房间名 ≥3 字符前端校验（提交禁用 + 提示）；列表卡片 🔒/🌐 徽章；POST /api/rooms 未传 teamId 时
  回落当前团队上下文（cookie）；新增 POST /api/rooms/[id]/join（仅 team 可见 + 同团队成员可自助加入
  为 member）；listVisibleRooms 附带 is_member 供前端渲染 Join 入口。
- 运行过的验证: docker compose up -d / migrate / e2e room-rr-002-visibility.spec.ts（4 用例全过）;
  回归 room-create/room-view-search/room-manage/room-rr-001-detail-shell（9 用例全过）;
  `pnpm harness verify --sprint p20/01 --feature F02` 门控通过（含 verify:base）→ F02 = passing。
- 已记录证据: evidence/F02.verify.log
- 提交记录: 分支 worker/wrk-room-1-p20-f02-room-visibility
- 已知风险或未解决问题: 无。未动 rooms/[id]/layout.tsx、members 路由、rooms/[id]/board（F07/F09/F10 并行区）。
- 下一步最佳动作: PR 进 review，coordinator 合并。
