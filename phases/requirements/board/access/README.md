# Board Access Use Cases

本目录描述 Board 公开、团队、房间和成员访问范围的用户场景。

## 用户入口

- Board Header 中的分享入口。
- 用户收到的 Board 分享链接或二维码。
- 无权限时的提示和返回入口。

## 权限口径

- Owner/Admin/Member 在具备编辑权限时可以使用创建和编辑能力。
- Visitor 与 public visitor 以查看、导航和允许的导出/复制能力为主，不能改变 Board 内容或访问策略。
- 分享范围以 public、team、room、board 等 Board 访问策略和当前用户在 Room/Team 中的身份共同决定。

## 业务规则

- 访问级别是 public、team、room、board 等策略与用户身份共同作用的结果。
- 复制分享链接不等于授予编辑权限。
