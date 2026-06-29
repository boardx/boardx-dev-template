# Board Context Menu 粗粒度交互图

本图用于快速说明 Board Context Menu 模块有哪些参与角色、入口、主要能力和结果状态。它不展开每个控件的全部状态，详细交互见 [board-context-menu-detailed-interaction-diagram.md](./board-context-menu-detailed-interaction-diagram.md)。

```mermaid
flowchart TD
  Start["进入 Board Context Menu 模块"]
  Start --> Actors{"参与角色"}
  Actors --> A1["Board Owner"]
  Actors --> A2["Board Admin"]
  Actors --> A3["Board Member"]
  Actors --> A4["Board Visitor"]
  Actors --> A5["public visitor"]
  Start --> Entry{"可见入口或页面区域"}
  Entry --> E1["用户在画布空白处、单个组件或多选区域打开右键 Con<br/>text Menu。"]
  Entry --> E2["空白画布可显示粘贴、选择所有、导出白板、解锁所有等画<br/>布级动作；对象菜单按对象类型显示编辑、复制、剪切、粘<br/>贴、重复、删除、层级、编组/取消编组、锁定、复制为图<br/>片/文本、导出已选区域、导出白板、打开图片、下载图片<br/>、保存到模板等适用项。"]
  Entry --> E3["锁定对象菜单会收窄，通常保留层级、复制为图片/文本、<br/>导出或打开/下载图片等允许动作。"]
  Entry --> Capabilities{"用户可执行的主要操作"}
  Capabilities --> UC1["使用右键 Context Menu"]
  Capabilities --> UC2["复制、剪切和粘贴内容"]
  Capabilities --> UC3["调整图层顺序"]
  Capabilities --> UC4["编组、取消编组、锁定和解锁"]
  Capabilities --> UC5["导出选中内容"]
  Capabilities --> UC6["保存为模板"]
  Capabilities --> Result["界面显示成功、失败、空状态、权限状态或下一步入口"]
```
