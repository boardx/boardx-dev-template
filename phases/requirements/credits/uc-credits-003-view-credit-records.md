Use Case 名称：
查看积分流水

Actor：
Team Owner、Team Admin、注册用户

目标：
用户查看自己或团队被允许范围内的 Credit 余额和交易记录。

系统边界：
BoardX / Credits

前端入口：
1. 用户菜单 > Credit 余额区域 > Credit Records 弹窗。
2. Team Credits 页面 > Usage 标签页。
3. Team Credits 页面 > Purchase 标签页。
4. Buy Credits 弹窗 > 最近交易记录。

前置条件：
用户已进入积分记录入口。

触发条件：
用户打开 Credit Records 弹窗、Team Credits 页面或 Buy Credits 弹窗。

主流程：
1. 注册用户点击用户菜单中的 Credit 余额区域，系统打开 Credit Records 弹窗。
2. 弹窗加载个人钱包摘要，并展示剩余 Credit 和累计消耗 Credit 两个摘要卡片。
3. 弹窗加载个人消费记录时，列表区域展示“加载记录中”。
4. 加载完成后，弹窗展示个人消费记录；每条记录展示消费类型或原因、Credit 消耗数量和变更后余额等信息。
5. 如果没有个人消费记录，系统展示“暂无消费记录”空状态。
6. 用户可以滚动弹窗列表，查看更多记录；关闭弹窗后返回原页面。
7. Team Owner/Admin 在 Team Credits 页面通过 Usage 标签页查看团队消耗记录。
8. Team Owner/Admin 在 Team Credits 页面通过 Purchase 标签页查看团队购买、赠送和管理员授予记录。
9. 用户在 Buy Credits 弹窗底部查看最近交易记录，包括购买、赠送、授予或消耗等记录。

备选流程：
- A1：用户只查看摘要卡片后关闭弹窗。
- A2：Team 管理角色只查看 Usage 或 Purchase 中的一个标签页。

异常流程：
- E1：记录加载失败，系统保持弹窗或页面可见，并允许用户稍后重新打开或刷新。

权限与可见性：
1. Team Owner/Admin 可以查看 Team 维度记录。
2. Team Member 在 Team Credits 页面中不能查看团队钱包和团队流水。
3. 注册用户只能查看自己被允许访问的个人 Credit Records。
4. 系统管理员可以在 Admin Panel 查看或触发手动上分相关操作，但不能把后台权限下放给 Team Member。

后置条件：
用户完成积分流水查看。

不包含：
1. 不包含支付系统内部结算。
2. 不包含 AI token 统计内部计算。
3. 不包含用户在页面手动修改流水。

业务规则：
1. 个人 Credit Records 弹窗展示个人消费记录和个人钱包摘要。
2. Team Credits 页面按 Team 权限展示团队消耗、购买、赠送和授予记录。
3. 流水记录的余额变化以系统记录为准。
