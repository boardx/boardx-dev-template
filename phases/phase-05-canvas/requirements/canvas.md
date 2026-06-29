# 原始需求 — Canvas（板内容）

> 由 agent 起草（用户未提供 canvas use case）。CAP-CANVAS。
> Room 是容器（phase-04 已建），本阶段做 Room 内的「板内容」：增删改 item + 持久化 + 渲染。
> 架构定位：**CanvasX 命令运行时（纯逻辑核心）+ 渲染适配器**。本轮渲染用轻量 DOM
> （可 Playwright 测），Fabric.js 作为可替换适配器留作后续；实时协作（Yjs）留 phase-06。

## 背景 / 为什么做
Room 只有元数据还不是白板。要让用户在 Room 里放便签/形状、移动、编辑、删除，并持久化，
作为后续实时协作与画布能力的基础。

## 原始需求（用户故事）
- 作为房间成员，我想要打开房间的板，看到板上已有的 item。
- 作为房间成员，我想要添加一个便签（带文字、位置）。
- 作为房间成员，我想要移动 item 到新位置 / 修改文字。
- 作为房间成员，我想要删除 item。
- 板内容要持久化：刷新后仍在；只有有权限看 Room 的人能看/改其板。

## 验收线索
- 打开 `/rooms/:id/board`：渲染该房间全部 item。
- 添加：POST 后 item 出现在板上并落库；刷新仍在。
- 移动/编辑：item 的位置/文字更新并持久化。
- 删除：item 从板上与库中消失。
- 权限：无权看 Room 的人访问其板/改其 item → 403。

## 范围与边界
- 本阶段做：board item 的增删改查 + 命令运行时（纯逻辑）+ DOM 渲染 + 权限。
- 明确不做（留后续）：实时多端同步（Yjs/CAP-COLLAB）、Fabric.js 富画布、撤销重做 UI、图片/文件 item。

## 已知约束 / 依赖
- 依赖 phase-04 的 rooms + 权限（canViewRoom / isRoomOwner）。
- 命令运行时应是纯函数（apply(state, command) → state'），便于后续接 Yjs/撤销。
- item 位置用数值坐标；持久化到 Postgres。
