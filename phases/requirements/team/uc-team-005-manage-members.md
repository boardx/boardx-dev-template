Use Case 名称：
管理团队成员

Actor：
团队 owner、团队 admin

目标：
团队管理者查看成员、调整成员角色、移除成员、管理成员 token 使用权限，并查看成员 token 用量。

系统边界：
BoardX / Team Member Management

前端入口：
Team 管理页的 Members 页面。

前置条件：
- 用户已登录并位于当前团队。
- 用户可以进入 Team 管理中的 Members 页面。

触发条件：
用户进入 Members 页面，或在成员表格中点击角色、移除、token 权限、用量详情等操作。

主流程：
1. 用户进入 Members 页面，系统展示成员表格。
2. 表格展示成员姓名/头像、邮箱、角色、token 用量、token 权限开关和操作菜单。
3. 用户点击成员姓名，系统打开该成员 token 用量详情弹窗。
4. 详情弹窗展示总 token、prompt token、completion token、调用次数，以及按时间列出的模型、方法、客户端、状态和摘要。
5. 用户切换 token 权限开关，系统更新该成员是否可使用团队 token，并显示启用或禁用成功提示。
6. 用户打开成员操作菜单，可以把 member 设为 admin，把 admin 设为 member，或移除成员。
7. 系统更新成员列表；被调整的成员下一次进入团队相关功能时按新角色生效。

备选流程：
- A1：用户只查看成员列表，不做变更。
- A2：用户打开用量详情后关闭弹窗，成员状态不变。

异常流程：
- E1：尝试把 owner 改为 admin/member，系统提示 ownerNotRoleChange。
- E2：尝试移除 owner，系统提示 ownerNotRemovableTeam。
- E3：尝试把已是 admin 的成员设为 admin，系统提示 alreadyAnAdmin。
- E4：尝试把已是 member 的成员设为 member，系统提示 alreadyAmember。
- E5：token 权限更新失败，系统提示更新失败。

权限与可见性：
- owner 不能被降级，也不能被移除。
- admin 可以被设回 member，也可以被移除。
- member 可以被设为 admin，也可以被移除。
- visitor/未加入团队的用户看不到团队成员管理页面。

后置条件：
- 成功时，成员角色或 token 权限被更新。
- 成功时，成员列表刷新或展示最新状态。
- 失败时，原成员状态保持不变。

不包含：
- 不包含成员用量统计的计算规则。
- 不包含团队外用户搜索。

业务规则：
- owner 不可被降级或移除。
- 当前成员表组件本身未再次限制操作者角色；入口层通过团队菜单限制 member 进入管理页。
