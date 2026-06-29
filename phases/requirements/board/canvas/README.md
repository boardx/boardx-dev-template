# Board Canvas Use Cases

本目录描述 Board 内画布导航、缩放、小地图、对齐、键盘和选择操作。

## 用户入口

- Board 画布主体。
- 缩放、小地图、键盘、框选、选中框和对齐参考线。

## 权限口径

- Owner/Admin/Member 在具备编辑权限时可以使用创建和编辑能力。
- Visitor 与 public visitor 以查看、导航和允许的导出/复制能力为主，不能改变 Board 内容或访问策略。
- 分享范围以 public、team、room、board 等 Board 访问策略和当前用户在 Room/Team 中的身份共同决定。

## 业务规则

- 只读角色可以导航和查看，不能通过快捷键或菜单改变内容。
- 锁定对象不应被普通编辑动作改变。
