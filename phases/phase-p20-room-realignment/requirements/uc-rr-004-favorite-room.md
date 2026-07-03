Use Case 名称：
收藏房间

Actor：
Room member、Room admin、Room owner

目标：
用户可收藏/取消收藏房间，并在房间列表中快速筛选收藏（对齐 uc-room-002:31 与旧后端
RoomSubscription.favorite；board 已有同类能力 009_board_favorites，room 缺失）。

系统边界：
BoardX / Room

前端入口：
房间列表卡片的星标按钮；房间详情页头的星标。

前置条件：
- 用户已登录且是该房间成员。

主流程：
1. 用户点击房间卡片星标，POST/DELETE `/api/rooms/[id]/favorite` 切换收藏，星标即时点亮/熄灭。
2. 房间列表提供「Favorites」筛选（tab 或过滤器），只显示已收藏房间。
3. 收藏是**每用户**维度（我的收藏不影响他人）。

异常流程：
- E1：非成员收藏 → 403。
- E2：网络失败 → 星标回滚并 toast。

后置条件：
- 收藏状态持久化，刷新后保持。

业务规则：
- 数据落 `room_members.favorite boolean` 或独立 `room_favorites` 表（实现者二选一，与 board
  favorites 的既有模式保持一致优先）。
- 星标带 `data-testid=room-favorite-toggle`。
