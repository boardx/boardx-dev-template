Use Case 名称：
邀请并管理房间成员

Actor：
Room owner、Room admin

目标：
房间管理者邀请团队成员或外部邮箱进入房间，并维护房间成员角色。

系统边界：
BoardX / Room Members

前端入口：
房间顶部设置按钮打开的 Room Settings 弹窗。

前置条件：
- 用户已登录并已进入目标房间。
- 用户在该房间中是 owner 或 admin。

触发条件：
用户打开 Room Settings，输入成员或邮箱并点击 Invite，或在成员表格中选择角色/移除操作。

主流程：
1. 用户在房间顶部点击设置按钮。
2. 系统打开 Room Settings 弹窗，展示 Room Name、Invite New Members、Current Members 和 Danger Zone。
3. 用户在 Invite New Members 输入框中输入至少 2 个字符。
4. 系统从当前团队成员中搜索候选人，并排除已经在房间中的用户和已经选中的用户。
5. 用户点击候选人，系统把该成员显示为可移除标签。
6. 用户也可以输入邮箱并按 Enter 或逗号；系统校验邮箱格式，通过后把邮箱显示为标签。
7. 用户点击 Invite，系统逐个处理标签。
8. 已注册且不在房间中的用户被直接加入房间，角色为 member。
9. 未注册邮箱由系统邀请流程处理发送房间邀请。
10. 用户点击 Copy Link，系统复制房间邀请链接并提示已复制。
11. 用户在 Current Members 中看到成员姓名、头像、角色和操作菜单。
12. 用户可用搜索框按姓名、用户名或邮箱过滤成员。
13. 用户打开成员操作菜单，可以把 member 设为 admin、把 admin 设为 member，或移除成员。

备选流程：
- A1：用户只复制房间邀请链接，不输入成员。
- A2：用户在发送前移除某个邀请标签。
- A3：用户只搜索成员，不修改成员角色。

异常流程：
- E1：邮箱为空，系统提示 pleaseEnterEmailAddress。
- E2：邮箱格式无效，系统提示 invalidEmail。
- E3：用户已在房间中，系统提示已邀请或已在房间。
- E4：复制链接失败，系统提示 copyFailed。

权限与可见性：
- owner 不显示可操作菜单，不能被移除。
- admin 不能移除另一个 admin；系统提示 adminRemoveUser。
- member 可以被提升为 admin，也可以被移除。
- Room Settings 入口只对 owner/admin 展示。
- visitor/未加入房间的用户不能打开 Room Settings，也不能邀请或管理房间成员。

后置条件：
- 邀请成功时，已注册用户成为房间 member。
- 未注册邮箱由系统邀请流程处理发送邀请。
- 角色变更或移除成功时，成员列表更新。

不包含：
- 不包含团队成员本身的邀请流程。
- 不包含邮件内容。

业务规则：
- 已经在房间中的成员不会作为候选人重复添加。
- Room Settings 弹窗组件本身未二次隐藏成员操作，依赖房间顶部只对 owner/admin 展示设置入口。
