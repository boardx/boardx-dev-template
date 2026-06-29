# Board Local Workspace 粗粒度交互图

本图用于快速说明 Board Local Workspace 模块有哪些参与角色、入口、主要能力和结果状态。它不展开每个控件的全部状态，详细交互见 [board-local-workspace-detailed-interaction-diagram.md](./board-local-workspace-detailed-interaction-diagram.md)。

```mermaid
flowchart TD
  Start["进入 Board Local Workspace 模块"]
  Start --> Actors{"参与角色"}
  Actors --> A1["Board Owner"]
  Actors --> A2["Board Admin"]
  Actors --> A3["Board Member"]
  Start --> Entry{"可见入口或页面区域"}
  Entry --> E1["用户在 Board 内看到聊天或记忆相关入口时，才能<br/>进入该场景。"]
  Entry --> E2["当前 Board 内可确认的相关能力包括 Board<br/> Chat 和 Board Memory。"]
  Entry --> E3["当前 Board 中不把本地工作区、本地模型或本地工<br/>具展示为已确认的用户入口。"]
  Entry --> E4["用户在 Board 内看到 Board Chat 入<br/>口时，才能进入该场景。"]
  Entry --> E5["当前 Board 可确认入口包括 Board Cha<br/>t。"]
  Entry --> E6["本地模型选择和本地工具调用不作为当前 Board 的<br/>已确认可见入口。"]
  Entry --> E7["用户在 Board 内打开 Board Memory<br/> 或包含 Board Memory 的记忆面板。"]
  Entry --> E8["系统显示 Board Memory 标题、说明、记忆<br/>数量、搜索框、记忆列表、添加记忆输入框和添加按钮。"]
  Entry --> E9["每条记忆以可阅读的条目展示，鼠标悬停或聚焦时可看到删<br/>除入口。"]
  Entry --> Capabilities{"用户可执行的主要操作"}
  Capabilities --> UC1["使用 Local Workspace"]
  Capabilities --> UC2["使用 Board Chat"]
  Capabilities --> UC3["使用 Board Memory"]
  Capabilities --> Result["界面显示成功、失败、空状态、权限状态或下一步入口"]
```
