# Board Use Cases

本目录描述用户围绕 Board 列表、打开、访问控制、Header、菜单、画布、协作、组件和本地工作区的真实操作场景。

## 用户入口

- Room/Team/最近访问中的 Board 卡片、搜索结果、创建按钮和更多菜单。
- 公开分享链接进入的 Board 页面。
- Board 内 Header、Board Menu、Widget Menu、Context Menu、Canvas 与协作状态。

## 权限口径

- Owner/Admin/Member 在具备编辑权限时可以使用创建和编辑能力。
- Visitor 与 public visitor 以查看、导航和允许的导出/复制能力为主，不能改变 Board 内容或访问策略。
- 分享范围以 public、team、room、board 等 Board 访问策略和当前用户在 Room/Team 中的身份共同决定。

## 业务规则

- 用用户可见入口描述流程，不用代码路径代表界面入口。
- 所有创建、编辑、删除、移动、分享范围变更都必须先判断角色权限。
- public visitor 只获得公开策略允许的能力。
