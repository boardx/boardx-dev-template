Use Case 名称：
管理团队通用设置

Actor：
团队 owner、团队 admin

目标：
团队管理者从 Team 管理页集中查看和进入团队的基础管理入口。

系统边界：
BoardX / Team Management

前端入口：
团队头像菜单中的 Manage Team。

前置条件：
- 用户已登录并已选择当前团队。
- 用户在当前团队中的角色为 owner 或 admin。

触发条件：
用户点击 Manage Team，或在 Team 管理页左侧菜单切换页面。

主流程：
1. 用户点击团队菜单中的 Manage Team。
2. 系统进入 Team 管理页，左侧展示 Team Management 标题、团队类型标识，以及分组菜单。
3. Management 分组展示 Home、General，若启用积分计费且用户为 owner/admin，还展示 Credits。
4. People 分组展示 Members。
5. Knowledge 分组展示 Memory 和 Knowledge Base。
6. AI Store 分组展示 Store Explore、Store Subscribe、Store Approval。
7. 用户点击任一菜单项，系统高亮当前项并进入对应页面。

备选流程：
- A1：用户点击当前所在菜单项，系统不重复跳转。
- A2：移动设备上，系统以适配移动端的导航方式展示管理菜单。

异常流程：
- E1：页面跳转过程中，菜单项显示加载态，避免重复点击导致多次跳转。

权限与可见性：
- owner/admin 可以进入 Team 管理页并看到上述管理导航。
- member 从团队菜单点击 Manage Team 时收到无权限提示，不能进入该管理入口。
- visitor/未加入团队的用户看不到 Team 管理导航。

后置条件：
- 用户进入选择的团队管理子页面。
- 当前团队上下文保持不变。

不包含：
- 不包含每个子页面的详细业务；这些能力分别由成员、Memory、AI Store、Credits 等用例覆盖。

业务规则：
- Store Approval 入口展示时，Team Owner 和具备审批权限的 Team Admin 可以进入；未展示入口时，用户不能从团队通用设置进入审批流程。
