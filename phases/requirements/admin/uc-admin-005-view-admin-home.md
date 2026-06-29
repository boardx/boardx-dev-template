Use Case 名称：
管理员工作台

Actor：
系统管理员

目标：
管理员进入后台首页，快速访问用户、团队、AI Store 等管理模块。

系统边界：
BoardX / Admin Panel

前端入口：
1. Admin Panel 首页。
2. Admin Panel 侧边菜单中的 Home 入口。

前置条件：
- 管理员已登录。
- 管理员拥有 admin 角色。

触发条件：
管理员访问 Admin Panel。

主流程：
1. 系统管理员访问 Admin Panel，系统校验管理员身份并展示后台布局、Admin 菜单和首页内容。
2. 首页顶部展示 BoardX 标识、Admin Control Panel 标题、平台管理说明和 Administrator Access 标识。
3. 系统加载平台统计数据，并展示总用户数、AI Tools 数、待审核数量、精选 Tools 数等摘要卡片。
4. 首页展示管理模块卡片，包括商店探索、商店审批、精选商店、用户、分析等入口；管理员可从侧边菜单进入 Home、Store Explore、Store Approval、Store Featured、Users、Teams。
5. 每个模块卡片展示图标、名称、描述、分类和徽标，例如待审核数量或 New 标记。
6. 管理员点击模块卡片，系统跳转到对应后台页面。
7. 管理员也可以通过 Admin 菜单在 Home、Users、Teams、AI Store Approval、AI Store Featured 等模块间切换。
8. 如果统计数据加载中，系统展示 loading 或占位状态；加载失败时，首页仍保留导航入口。

备选流程：
- A1：管理员通过侧边栏切换模块。

异常流程：
- E1：非管理员访问，系统拒绝或跳转。
- E2：管理数据加载失败，系统展示错误状态。

权限与可见性：
1. 系统管理员可以访问后台首页、统计摘要、管理模块卡片和 Admin 菜单。
2. Team Owner/Admin/Member 不因团队角色获得后台首页访问权。
3. 非系统管理员访问后台首页时，系统拒绝或跳转。

后置条件：
- 成功时，管理员进入目标后台模块。

不包含：
1. 不包含普通 Team 管理页面。
2. 不包含普通用户个人资料编辑。

业务规则：
- Admin 页面只应对 admin 角色开放。
- 后台操作需要有效登录状态和管理员权限。
