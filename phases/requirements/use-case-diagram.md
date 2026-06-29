# BoardX 按角色拆分的 Use Case Diagram

本文档是 BoardX 用例图索引。原来的全系统图把多个角色的可操作功能耦合在同一张图里，阅读时很难判断“某个角色到底能做什么”。现在按角色拆分，每个角色单独一份 Use Case Diagram。

当前版本只描述每个角色能操作的最外层模块或一级业务能力，用于先确定系统边界和导航级功能范围。模块内部的二级/三级用例应在对应模块文档中继续展开。

本组图统一使用 Mermaid，不使用 PlantUML。角色图按“单一角色 + 可访问模块/一级能力”表达；跨角色授权、协作、审核和提交关系放在多角色交互图中表达。

除单角色可操作范围外，还需要从“角色交互”视角补充用例图，用来表达 owner、admin、member、visitor、respondent 等角色之间如何邀请、授权、协作、审核、提交和管理。交互视角见：[多角色交互 Use Case Diagram](./role-interactions.md)。

## 角色图索引

### 全局角色

- [访客 Use Case Diagram](./role-diagrams/guest.md)
- [注册用户 Use Case Diagram](./role-diagrams/registered-user.md)
- [AI Store 创作者 Use Case Diagram](./role-diagrams/ai-store-creator.md)
- [系统管理员 Use Case Diagram](./role-diagrams/system-admin.md)

### Team 权限角色

- [Team Owner Use Case Diagram](./role-diagrams/team-owner.md)
- [Team Admin Use Case Diagram](./role-diagrams/team-admin.md)
- [Team Member Use Case Diagram](./role-diagrams/team-member.md)

### Room 权限角色

- [Room Owner Use Case Diagram](./role-diagrams/room-owner.md)
- [Room Admin Use Case Diagram](./role-diagrams/room-admin.md)
- [Room Member Use Case Diagram](./role-diagrams/room-member.md)

### Board 权限角色

- [Board Owner Use Case Diagram](./role-diagrams/board-owner.md)
- [Board Admin Use Case Diagram](./role-diagrams/board-admin.md)
- [Board Member Use Case Diagram](./role-diagrams/board-member.md)
- [Board Visitor Use Case Diagram](./role-diagrams/board-visitor.md)
- [Board 编辑者 Use Case Diagram](./role-diagrams/board-editor.md)

### 问卷权限角色

- [Survey Owner Use Case Diagram](./role-diagrams/survey-owner.md)
- [Survey Admin Use Case Diagram](./role-diagrams/survey-admin.md)
- [Survey Member Use Case Diagram](./role-diagrams/survey-member.md)
- [问卷答题人 Use Case Diagram](./role-diagrams/survey-respondent.md)

## 多角色交互图索引

- [Team 角色交互](./role-interactions.md#team-角色交互)
- [Room 角色交互](./role-interactions.md#room-角色交互)
- [Board 角色交互](./role-interactions.md#board-角色交互)
- [Survey 角色交互](./role-interactions.md#survey-角色交互)
- [AI Store 角色交互](./role-interactions.md#ai-store-角色交互)

## 拆分原则

- 每张图只展示一个主 Actor 的可操作一级模块或一级业务能力。
- 细粒度动作如新增、编辑、删除、搜索、下载、审批步骤等先不在角色总图展开，除非它本身就是一级模块入口。
- 单角色图说明“谁能进入什么模块”；多角色交互图说明“谁和谁围绕同一个业务目标发生交互”。
- Team 当前按 `owner / admin / member` 拆分。
- Room 当前按 `owner / admin / member` 拆分。
- Board 当前按 `owner / admin / user / visitor` 拆分；文档中将 `user` 表达为 Board Member。
- Survey 当前按 `owner / admin / member / respondent` 拆分；其中 admin 对应 Team owner/admin 或具备问卷管理权限的角色。
- 外部服务只在该角色的用例会直接触发时出现。
- `include` 表示必然发生的公共能力，例如验证身份、检查权限、发送通知、保存文件。
- `extend` 表示在特定条件下才发生的可选行为，例如 Deep Research、向量化、精选推荐。
- 图中的用例仍保持 UML Use Case 的目标视角，不表达接口路径、组件、数据库或内部实现。

## 覆盖依据

本组 Use Case 主要依据 `boardx-web` 的前端页面、组件、菜单、状态和服务进行分析，详见：[boardx-web 功能覆盖说明](./boardx-web-coverage.md)。

- 前端页面入口：`home`、`team`、`room`、`board`、`ava`、`aistore`、`personal/knowledge-base`、`team/knowledge-base`、`survey`、`admin-panel`、`profile`、`signin`、`sign-up`、`invite` 等。
- Board 前端交互：`boardHeader`、`boardMenu`、`widgetMenu`、`contextMenu`、`canvas/WBCanvas`、`userList`、`widgets`。
- 前端服务分层：`team`、`room`、`board`、`widget`、`board-subscription`、`room-subscription`、`room-chat`、`ai-store`、`ai-service`、`deep-research`、`file`、`room-file`、`credit`、`statistics`、`template`、`slides`、`presentations`、`studio`、`user` 等。
- 后端仅作为权限角色和数据边界的辅助参考，不作为本轮 Use Case 的主要来源。
