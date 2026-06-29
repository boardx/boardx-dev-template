Use Case 名称：
查看团队 Home

Actor：
团队 owner、团队 admin

目标：
团队管理者进入 Team Home，了解当前团队管理入口与团队工作概况。

系统边界：
BoardX / Team Home

前端入口：
Team 管理页左侧菜单中的 Home。

前置条件：
- 用户已登录。
- 用户可以进入 Team 管理页。

触发条件：
用户进入 Team 管理页，或点击左侧 Home。

主流程：
1. 用户在团队菜单点击 Manage Team，或在 Team 管理页左侧点击 Home。
2. 系统展示团队管理框架，左侧为 Team Management 导航。
3. Home 区域展示 Dashboard 标题、说明文字，以及团队统计卡片。
4. 用户看到 Active Members、AI Tools、Pending Reviews、Total Tokens；数据加载中时数字位置显示省略状态。
5. 用户看到管理入口卡片：General、Members、Memory、Store Explore、Store Subscribe、Store Approval；启用积分计费且用户为 owner/admin 时还看到 Credits。
6. 用户点击任一入口卡片，系统保持当前团队上下文并进入对应页面。
7. 页面底部展示快速入口，用户可以直接进入团队设置或成员管理。
8. 如果用户切换到另一个团队后再次进入 Team Home，系统刷新为新团队的统计和入口上下文。

备选流程：
- A1：用户从其他团队管理页面点击 Home，系统返回 Team Home。

异常流程：
- E1：如果当前团队尚未加载，页面依赖全局团队加载流程；当前用例不假设具体空态文案。

权限与可见性：
- owner/admin 可以进入 Home。
- member 无法通过团队菜单进入 Team 管理 Home。
- visitor/未加入团队的用户不能进入 Team Home。

后置条件：
- 用户停留在当前团队的 Home 页面。
- 用户可以继续进入团队设置、成员、Memory、AI Store 或 Credits 等团队管理能力。

不包含：
- 不包含统计指标的计算规则。

业务规则：
- Credits 入口只在积分计费启用且用户为 owner/admin 时显示。
