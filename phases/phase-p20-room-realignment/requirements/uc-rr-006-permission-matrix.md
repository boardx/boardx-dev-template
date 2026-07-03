Use Case 名称：
房间权限矩阵统一

Actor：
Room owner、Room admin、Room member

目标：
消除 owner/admin 权限在「数据层（canManageRoom = owner∨admin）/ phase-04 F12 描述（仅 owner）/
role-diagrams（owner=admin）」三处互相矛盾的口径，落定唯一权限矩阵并在 API 层逐端点断言。

系统边界：
BoardX / Room

权威权限矩阵（本 UC 即权威，其他文档向它对齐）：

| 能力 | owner | admin | member |
|---|---|---|---|
| 查看房间/Boards/Files/Chat/Survey | ✅ | ✅ | ✅ |
| 上传文件 / 创建聊天 / 创建 board | ✅ | ✅ | ✅ |
| 删除他人文件 | ✅ | ✅ | ❌（仅本人） |
| 邀请成员 / 移除 member | ✅ | ✅ | ❌ |
| 提升/降级 admin | ✅ | ❌ | ❌ |
| 移除 admin | ✅ | ❌ | ❌ |
| 修改房间名/可见性/AI 上下文字段 | ✅ | ✅ | ❌ |
| 删除房间 / 移除 owner / 变更 owner | ✅（owner 不可被移除；owner 变更本期不做） | ❌ | ❌ |

主流程：
1. 每个 room 系 API 端点按上表做服务端断言（403 语义一致）。
2. UI 按角色隐藏/禁用不可用入口（Invite、DANGER ZONE、角色菜单）。
3. 更新 `phases/requirements/role-diagrams/room-owner.md / room-admin.md / room-member.md`，
   使 owner 与 admin 的节点差异真实反映上表，并补 Files/Survey/Studio 节点。
4. 修正 phase-04 feature_list F12 的 user_visible_behavior 描述为「owner/admin」。

异常流程：
- E1：admin 试图移除另一 admin → 403（现有 e2e 已覆盖，保留）。
- E2：任何人试图移除 owner → 403。

后置条件：
- 需求、角色图、feature 描述、实现、e2e 五处口径一致。

业务规则：
- e2e 需覆盖矩阵中每行至少一个正/反用例（member 被拒 + admin 通过 + admin 被拒的行）。
