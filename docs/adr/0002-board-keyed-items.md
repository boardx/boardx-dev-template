# ADR 0002: 画布 item 归属从 room-keyed 演进为 board-keyed（加法过渡）

- 状态: Accepted
- 适用层：项目实现（BoardX 专属：模板只带模式引用）
- 日期: 2026-06-30
- 相关: [[ADR-0001]]（ADR 实践）；phases/phase-p5-board、phases/phase-p6-canvas

## 背景

P5 引入了一等实体 **Board**：一个 Room 可以有多个 Board（`boards` 表，归属 room）。
但画布内容表 `board_items`（`migrations/005_canvas.sql`）是 **room-keyed**（`room_id NOT NULL`，
无 board 维度），它是 P6 早期「便签 item CRUD 种子」（phase-p6-canvas F01-F04，已 passing）。

矛盾：P6 剩余功能（选择/组件/复制/撤销）、P7 统计/备份、P8 实时协作都需要把画布内容
**归属到具体 board**。room-keyed 模型无法区分同一 room 下的多个 board。

约束：F01-F04（room-keyed `/api/rooms/:id/items`）已 passing，其测试不可破坏
（与「不拆已 passing 的 phase-04」同一偏好——见 [[boardx-impl-progress]]）。

## 决策

**加法过渡**，不破坏已 passing 的 room-keyed 端点/测试：

1. `board_items` 增加 `board_id bigint NULL REFERENCES boards(id) ON DELETE CASCADE`（additive migration）。
2. 新画布功能走 **board-scoped** 端点 `/api/boards/:id/items`；新 item 同时写
   `room_id = board.room_id` 与 `board_id = board.id`（满足 room_id NOT NULL 约束 + 加 board 维度）。
3. 现有 room-keyed `/api/rooms/:id/items`（F01-F04）保留为 **legacy**，不动。
4. P6 F06+ 的 canvas-surface 渲染、选择、命令运行时均基于 `board_id` 过滤。

## 后果

正面：
- 已 passing 的 F01-F04 零回归。
- P6/P7/P8 解除阻塞，画布内容正确归属 board。

负面 / 已知技术债：
- 短期 **两套 item 入口并存**（legacy room-keyed + 新 board-keyed）。Agent 读代码需知道
  「新功能一律用 board-scoped」。
- `board_id` 可空（legacy 行为 NULL），查询需注意。

迁移收尾路径（待 room-keyed 不再需要时）：回填存量 `board_id`（按 room 的默认 board）→
将 `board_id` 置为 NOT NULL → 废弃 `/api/rooms/:id/items` 与 F01-F04 spec → 标本 ADR 区段完成。

## 备选（已否决）

- **立即迁移 F01-F04 为 board-keyed**：要改动已 passing 的端点/测试，违反「不动 passing」偏好，
  且把数据迁移与功能开发耦合在一次大改里，风险高。否决（保留为收尾路径）。
- **维持纯 room-keyed**：无法支持「一个 room 多个 board」的画布隔离，与 P5 模型冲突。否决。
