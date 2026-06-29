# Board Widget Menu 粗粒度交互图

本图用于快速说明 Board Widget Menu 模块有哪些参与角色、入口、主要能力和结果状态。它不展开每个控件的全部状态，详细交互见 [board-widget-menu-detailed-interaction-diagram.md](./board-widget-menu-detailed-interaction-diagram.md)。

```mermaid
flowchart TD
  Start["进入 Board Widget Menu 模块"]
  Start --> Actors{"参与角色"}
  Actors --> A1["Board Owner"]
  Actors --> A2["Board Admin"]
  Actors --> A3["Board Member"]
  Start --> Entry{"可见入口或页面区域"}
  Entry --> E1["用户在画布上选中单个组件或框选多个组件后，选中框附近<br/>出现悬浮 Widget Menu。"]
  Entry --> E2["菜单按对象类型显示有限入口：文本/便利贴可显示字号、<br/>字体、字重、对齐、背景色、文字色、格式应用、切换便利<br/>贴类型；连接线可显示颜色、线宽、端点和直线/曲线；图<br/>片可显示裁剪；文件可显示文件名、下载，音频文件可显示<br/>转文本。"]
  Entry --> E3["多数可编辑对象可显示锁定、删除和 AI 助手；锁定对<br/>象通常只保留锁定状态入口。"]
  Entry --> Capabilities{"用户可执行的主要操作"}
  Capabilities --> UC1["使用 Widget Menu"]
  Capabilities --> UC2["调整组件样式"]
  Capabilities --> UC3["锁定或解锁组件"]
  Capabilities --> UC4["裁剪图片"]
  Capabilities --> UC5["下载文件组件"]
  Capabilities --> UC6["音频转文本"]
  Capabilities --> UC7["使用组件 AI 助手"]
  Capabilities --> UC8["删除组件"]
  Capabilities --> UC9["刷新组件"]
  Capabilities --> UC10["应用格式"]
  Capabilities --> UC11["对齐选中组件"]
  Capabilities --> UC12["编辑连接线样式"]
  Capabilities --> UC13["编辑文本样式"]
  Capabilities --> UC14["将文本转换为便利贴"]
  Capabilities --> Result["界面显示成功、失败、空状态、权限状态或下一步入口"]
```
