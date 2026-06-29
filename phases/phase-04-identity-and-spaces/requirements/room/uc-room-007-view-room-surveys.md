Use Case 名称：
查看房间 Survey 页签

Actor：
Room member、Room admin、Room owner

目标：
用户在房间内进入 Survey 页签，查看团队问卷列表，必要时创建、编辑、分享、启停或查看结果。

系统边界：
BoardX / Room Survey

前端入口：
房间顶部的 Survey 页签。

前置条件：
- 用户已登录并已进入目标房间。
- 用户是该房间成员。

触发条件：
用户点击房间顶部 Survey 页签。

主流程：
1. 用户进入房间页面。
2. 页面顶部展示 Board、Chat、Survey 三个页签。
3. 用户点击 Survey。
4. 系统切换到 Survey 页签内容区。
5. 系统展示嵌入式问卷工作区，默认进入 Team Surveys 列表视图。
6. 用户看到问卷列表标题、Refresh、Create Survey、问卷卡片、启用/暂停状态、题目数、答卷数和创建者信息。
7. 用户点击 Create Survey，系统在同一页签切换到创建问卷模式，并保留房间页签上下文。
8. 用户点击 View 或 Results，系统打开该问卷结果区，可在 Summary、Individual、Report 之间切换。
9. 用户点击 Edit，系统进入问卷编辑器；如果用户无编辑权限，页面显示 noEditPermission。
10. 用户点击 Preview，系统打开公开答题页。
11. 用户点击 Share，系统复制答题链接并显示成功或失败反馈。
12. 用户点击 Pause 或 Activate，系统切换问卷状态，并在卡片上显示 Active 或 Paused。
13. 用户点击 Delete，系统打开确认弹窗；确认后删除问卷并刷新列表。

备选流程：
- A1：用户从 Survey 切换回 Board 或 Chat。
- A2：用户在创建模式中返回列表，系统回到 Survey 列表视图。
- A3：没有问卷时，系统显示还没有问卷的空状态。

异常流程：
- E1：Survey 页签加载中时，系统展示页签内容的加载占位。
- E2：问卷加载失败、分享失败、删除失败或状态更新失败时，页面显示错误信息，原状态保持不变。

权限与可见性：
- owner/admin/member 均可看到房间顶部 Survey 页签。
- owner/admin 在房间 Survey 中具备可编辑权限，可以编辑和管理团队范围内问卷。
- member 可以看到 Survey 页签、创建自己的问卷，并管理自己创建的问卷；对其他人创建且自己无管理权限的问卷，不展示操作按钮或显示 noEditPermission。
- respondent 只通过公开答题链接进入答题页，不看到房间 Survey 页签。
- 非房间成员直接访问房间时无法进入该页签。
- visitor/未登录用户不能进入房间 Survey 页签。

后置条件：
- 用户停留在当前房间的 Survey 页签。

不包含：
- 不包含公开答题页的填写流程；该流程由 Survey 答题用例覆盖。
- 不包含问卷报告算法。

业务规则：
- 房间 Survey 页签使用当前房间成员角色和问卷创建者判断管理权限；owner/admin 可管理团队范围内问卷，普通 member 只因创建者身份管理自己的问卷。
