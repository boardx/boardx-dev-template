# CanvasX Widgets Use Cases

本目录描述 CanvasX 组件在 Board 中的创建、选择、编辑和协作状态。

## 用户入口

- Board Menu、资源/模板面板、拖放、粘贴和已有组件。
- 选中后的 Widget Menu 和右键菜单。

## 权限口径

- Owner/Admin/Member 在具备编辑权限时可以使用创建和编辑能力。
- Visitor 与 public visitor 以查看、导航和允许的导出/复制能力为主，不能改变 Board 内容或访问策略。
- 分享范围以 public、team、room、board 等 Board 访问策略和当前用户在 Room/Team 中的身份共同决定。

## 业务规则

- 组件类型决定可用能力。
- 实现中存在的组件类型不等于当前产品界面必然提供创建入口。
