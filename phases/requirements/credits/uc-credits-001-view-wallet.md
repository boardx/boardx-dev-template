Use Case 名称：
查看积分钱包

Actor：
Team Owner、Team Admin、Team Member、注册用户

目标：
Team 管理角色查看团队 Credit 余额、购买记录和消耗记录；普通用户在用户菜单查看个人 Credit 余额入口。

系统边界：
BoardX / Credits

前端入口：
1. Team 设置页面 > Credits。
2. Team Credits 页面 > 钱包摘要卡片。
3. Team Credits 页面 > Usage 标签页。
4. Team Credits 页面 > Purchase 标签页。
5. 用户菜单中的 Credit 余额区域。

前置条件：
用户已进入 Team Credits 页面或打开用户菜单。

触发条件：
用户打开积分模块或用户菜单。

主流程：
1. Team Owner 或 Team Admin 进入 Team Credits 页面，系统先读取当前团队信息。
2. 如果团队信息尚未就绪，系统展示 loading team 状态。
3. 如果当前计费模式不是 credits，系统展示 credits not enabled 提示。
4. 如果当前用户不是 Team Admin 或 Owner，系统展示 no permission 提示，不展示团队钱包数据、购买按钮或团队流水。
5. 有权限时，系统展示团队 Credits 页面标题、说明和 Buy Credits 按钮。
6. 系统展示四个摘要卡片：当前余额、累计购买、累计授予、累计消耗；余额加载中时显示占位符。
7. 页面默认展示 Usage 标签页，表格列出消耗时间、用户、消耗原因、消耗数量和消耗后余额。
8. 用户切换 Purchase 标签页，系统展示购买、赠送或管理员授予记录，包括时间、类型、描述、来源、增加数量和变更后余额。
9. 如果某个表格没有记录，系统展示对应空状态。
10. 注册用户在 credits 计费模式下打开用户菜单时，可以看到个人 Credit 余额区域；点击该区域可打开个人 Credit 记录弹窗。

备选流程：
- A1：Team 管理角色只查看摘要，不切换标签页。
- A2：普通用户只从用户菜单查看个人余额。

异常流程：
- E1：团队信息缺失，系统停留在 loading team 状态。
- E2：当前不是 credits 计费模式，系统提示积分功能未启用。
- E3：当前 Team 角色无权限，系统提示仅 Team Owner/Admin 可管理团队 Credit。

权限与可见性：
1. Team Owner/Admin 可以查看 Team 钱包、购买积分并查看 Team 维度流水。
2. Team Member 在 Team Credits 页面中看到无权限提示，不能查看团队钱包、团队流水或购买按钮。
3. 注册用户只能在用户菜单查看自己的个人 Credit 余额和个人记录入口。
4. 系统管理员可以在后台为用户或团队手动上分，但不等同于进入某个 Team Credits 页面代替 Team Owner/Admin 操作。

后置条件：
用户完成积分状态查看。

不包含：
1. 不包含支付系统内部结算。
2. 不包含 AI token 统计内部计算。

业务规则：
1. Team Credits 页面按当前 teamId 查询团队钱包。
2. Team Credits 页面只对 Team Owner/Admin 展示钱包和流水。
3. 用户菜单的 Credit 区域展示个人钱包余额。
