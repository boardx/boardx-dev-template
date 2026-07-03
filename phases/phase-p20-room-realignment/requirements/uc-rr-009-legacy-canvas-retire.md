Use Case 名称：
下线 legacy 单画布模型

Actor：
Room member（受影响用户）、系统维护者

目标：
消除双画布模型并存的脏状态：`005_canvas.sql` 时代的「房间=单块画布」路由
（`/api/rooms/[id]/items`、`apps/web/app/(app)/rooms/[id]/board/page.tsx`）已被
「房间含多 board」模型（007/012 迁移 + boards 页）取代，但仍是活路由。本 UC 将其正式下线。

系统边界：
BoardX / Room + Canvas

主流程：
1. 数据核查：统计 board_items 中 `board_id IS NULL`（即挂在 legacy 房间画布上）的行。
2. 迁移：为每个含 legacy items 的房间创建一块默认 board（名如 "Main board"），把这些 items
   的 board_id 回填到该 board；迁移幂等、可重跑。
3. 路由收敛：`/rooms/[id]/board` 重定向到 `/rooms/[id]/boards`（或迁移后的默认 board）；
   `/api/rooms/[id]/items` 返回 410 Gone（或移除，e2e 断言不再可用）。
4. 删除 legacy 页面组件与其专属代码路径。

异常流程：
- E1：房间无 legacy items → 迁移跳过，不创建空 board。

后置条件：
- 全库 board_items.board_id 非空；房间画布只有一个模型、一套入口。
- 旧直链不 404，而是重定向到新结构。

不包含：
- board/canvas 功能本体改动（p5/p6 范围）。

业务规则：
- 迁移脚本随 @repo/data migrations 落盘并可验证（迁移后断言 `SELECT count(*) FROM board_items
  WHERE board_id IS NULL` = 0）。
