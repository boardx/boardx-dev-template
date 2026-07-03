# Room Admin Use Case Diagram

Room Admin 拥有 Room 内日常管理权限（权威矩阵见 uc-rr-006）：可邀请/移除 member、
修改房间名/可见性/AI 上下文字段、删除他人文件。与 owner 的差异——admin **不能**：
提升/降级 admin、移除 admin、删除房间、移除/变更 owner（这些操作 API 一律返回 403）。

```mermaid
flowchart LR
  RoomAdmin["Room Admin"]
  Mail["邮件服务"]
  Storage["文件存储服务"]
  AI["AI 服务"]

  subgraph BoardX["BoardX 协作空间"]
    RoomHome(("访问 Room 首页"))
    RoomBoard(("访问/创建 Room 内 Board"))
    RoomChat(("访问/创建 Room Chat"))
    RoomFiles(("访问/上传 Room 文件"))
    RoomSurvey(("访问 Room Survey"))
    RoomAIContext(("访问 Room 文件 AI 上下文"))
    RoomSettings(("修改房间名/可见性/AI 字段"))
    InviteMember(("邀请/移除 member"))
    DeleteOthersFiles(("删除他人文件"))
    Notification(("访问 Room 成员通知"))
  end

  RoomAdmin --> RoomHome
  RoomAdmin --> RoomBoard
  RoomAdmin --> RoomChat
  RoomAdmin --> RoomFiles
  RoomAdmin --> RoomSurvey
  RoomAdmin --> RoomAIContext
  RoomAdmin --> RoomSettings
  RoomAdmin --> InviteMember
  RoomAdmin --> DeleteOthersFiles
  RoomAdmin --> Notification

  InviteMember --> Mail
  Notification --> Mail
  RoomFiles --> Storage
  RoomAIContext --> AI
```

> 不含节点（owner 专属，admin 调用返回 403）：提升/降级/移除 admin、删除房间、移除/变更 owner。
