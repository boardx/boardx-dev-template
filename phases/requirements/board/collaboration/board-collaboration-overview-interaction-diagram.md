# Board Collaboration 粗粒度交互图

本图用于快速说明 Board Collaboration 模块有哪些参与角色、入口、主要能力和结果状态。它不展开每个控件的全部状态，详细交互见 [board-collaboration-detailed-interaction-diagram.md](./board-collaboration-detailed-interaction-diagram.md)。

```mermaid
flowchart TD
  Start["进入 Board Collaboration 模块"]
  Start --> Actors{"参与角色"}
  Actors --> A1["Board Owner"]
  Actors --> A2["Board Admin"]
  Actors --> A3["Board Member"]
  Actors --> A4["Board Visitor"]
  Actors --> A5["public visitor"]
  Start --> Entry{"可见入口或页面区域"}
  Entry --> E1["用户进入 Board 后，在 Header 区域看到<br/>在线成员头像。"]
  Entry --> E2["多人同时在线时，头像区域显示当前用户、其他在线用户和<br/>“更多在线用户”入口。"]
  Entry --> E3["画布中可看到协作者创建、移动、修改或删除后的组件变化<br/>。"]
  Entry --> E4["只读用户可以观察同步结果，但不能编辑内容。"]
  Entry --> E5["头像区域优先显示当前用户和部分其他在线用户；人数较多<br/>时显示“+N”更多入口。"]
  Entry --> E6["协作者移动鼠标时，画布可显示对方的光标位置和用户标识<br/>。"]
  Entry --> E7["用户进入 Board 后，在 Header 区域看到<br/>在线成员头像和跟随相关入口。"]
  Entry --> E8["启用跟随后，画布顶部显示跟随状态条。"]
  Entry --> E9["跟随状态条显示正在被跟随的人或“成员正在跟随你”，并<br/>提供暂停、恢复和停止入口。"]
  Entry --> Capabilities{"用户可执行的主要操作"}
  Capabilities --> UC1["实时同步协作内容"]
  Capabilities --> UC2["查看在线成员和光标"]
  Capabilities --> UC3["跟随协作者视角"]
  Capabilities --> Result["界面显示成功、失败、空状态、权限状态或下一步入口"]
```
