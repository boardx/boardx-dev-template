Use Case 名称：
查看团队 AI Store

Actor：
团队 owner、团队 admin

目标：
用户在当前团队上下文中查看可探索、已订阅或待审批的 AI Store 内容。

系统边界：
BoardX / Team AI Store

前端入口：
Team 管理页左侧 AI Store 分组中的 Store Explore、Store Subscribe、Store Approval。

前置条件：
- 用户已登录并已选择当前团队。
- 当前团队信息已加载。

触发条件：
用户点击 AI Store 分组下的任一菜单项。

主流程：
1. 有管理权限的用户进入 Team 管理页，在 AI Store 分组看到 Store Explore、Store Subscribe、Store Approval。
2. 用户点击 Store Explore，系统进入团队 AI Store 探索页面，并显示搜索、分类、标签或项目卡片等当前可见浏览入口。
3. 用户在探索页面点击项目卡片，系统展示项目详情、订阅或使用相关操作。
4. 用户点击 Store Subscribe，系统进入团队订阅页面，并展示当前团队已订阅项目、空状态或加载状态。
5. 用户点击 Store Approval，系统进入团队 AI Store 审批页面，并展示待审批项目、审批状态或空状态。
6. 用户从任一 AI Store 页面返回 Team 管理菜单时，系统保留当前团队上下文。
7. 用户切换团队后再次进入 AI Store 分组，系统刷新为新团队的探索、订阅或审批内容。

备选流程：
- A1：用户切换团队后再次进入 AI Store，系统展示新团队上下文内容。
- A2：用户从 AI Store 页面返回 Team 管理其他页面。

异常流程：
- E1：当前团队未加载时，页面无法准确展示团队范围内容。

权限与可见性：
- owner/admin 可以从 Team 管理菜单进入 AI Store 分组。
- member 无法通过 Team 管理菜单进入这些页面；是否可通过顶层 AI Store 页面浏览个人可见内容，不在本用例范围内。
- visitor/未加入团队的用户不能从 Team 管理菜单进入团队 AI Store 页面。

后置条件：
- 用户进入所选 AI Store 页面。
- 页面以当前团队为上下文展示内容。

不包含：
- 不包含创建、订阅、审批 AI Store 项目的完整流程。

业务规则：
- Store Approval 在 Team 管理菜单中对 Team Owner 和具备审批权限的 Team Admin 可见；Team Member 不从 Team 管理菜单进入审批流程。
