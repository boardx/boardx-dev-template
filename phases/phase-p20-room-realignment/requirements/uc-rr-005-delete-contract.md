Use Case 名称：
删除房间的级联契约（Danger Zone）

Actor：
Room owner

目标：
把「删除房间会连带删除什么」从隐式 DB 行为（现状：全 ON DELETE CASCADE，UI 无告知）变成
显式产品契约：UI 明示级联范围，需求与实现一致（对齐原型 Danger Zone「Permanently remove
this room and its boards」与旧后端 rooms.service.ts 的级联删除）。

系统边界：
BoardX / Room

前端入口：
房间设置（Members tab 或设置弹窗）中的 DANGER ZONE 区块。

前置条件：
- 用户是该房间 owner（admin 不可删除房间）。

主流程：
1. owner 打开房间设置，看到 DANGER ZONE：「Delete room — Permanently remove this room and
   its boards, chats, files and surveys」。
2. 点击 Delete room，二次确认弹窗要求输入房间名（或明确 confirm），并逐项列出将被删除的
   内容类别与数量（X boards、Y chats、Z files）。
3. 确认后 DELETE /api/rooms/[id]，级联删除 boards（及 board_items）、room_chats（及消息）、
   room_files（存储对象标记清理）、room_members、room 级 survey 关联。
4. 跳回房间列表并 toast；被删房间对所有成员消失。

异常流程：
- E1：admin/member 调 DELETE → 403（现有行为保留，UI 不展示入口）。
- E2：输入房间名不匹配 → 确认按钮禁用。

后置条件：
- 相关数据不可再经任何 API 访问（404）。

不包含：
- 回收站/软删恢复（明确本期不做，写入产品文案「Permanently」）。

业务规则：
- DB 已有 CASCADE 保持；本 UC 的增量是**契约化**：确认弹窗内容 + 需求文档 + e2e 断言级联结果。
- 弹窗带 `data-testid=room-delete-confirm`（含 room-delete-cascade-summary）。
