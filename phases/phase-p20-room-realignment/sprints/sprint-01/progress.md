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
