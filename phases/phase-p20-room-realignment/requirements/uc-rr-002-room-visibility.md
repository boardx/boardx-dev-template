Use Case 名称：
创建房间时选择可见性

Actor：
Team member（创建者，成为 Room owner）

目标：
用户在创建房间时即可二选一设置可见性（Private / Team），消除「创建时不可选、列表却显示
Private 徽章」的需求矛盾（原 uc-room-001:60 vs uc-room-002:27）。

系统边界：
BoardX / Room

前端入口：
房间列表页「New Room」弹窗。

前置条件：
- 用户已登录且处于某个团队上下文（个人 room 亦可，team_id 可空的现有模型不变）。

主流程：
1. 用户点击 New Room，弹窗展示：房间名输入（≥3 字符）+ 可见性二选一卡片：
   - 🔒 Private：「Only invited members can find and join」
   - 🌐 Team：「Anyone on the team can discover and join」
2. 默认选中 Private。
3. 用户提交，POST /api/rooms 带 `visibility` 字段落库。
4. 列表卡片按可见性展示 🔒/🌐 徽章，与创建时的选择一致。

备选流程：
- A1：owner/admin 事后在房间设置中修改可见性（现有 F12 PATCH 能力保留），列表徽章随之更新。

异常流程：
- E1：房间名 <3 字符时提交按钮禁用并提示。
- E2：未选可见性不可能发生（有默认值）。

权限与可见性：
- visibility=team 的房间对同团队成员在房间列表可发现并可加入（加入即成为 member）；
  visibility=private 的房间仅成员可见。

后置条件：
- rooms.visibility 与 UI 徽章、可发现性行为三者一致。

不包含：
- 跨团队/公网公开房间。

业务规则：
- 词汇统一为 `private | team`（对应原型的 private/public 语义）。
- 弹窗控件带 `data-testid`（room-create-visibility-private / -team）。
