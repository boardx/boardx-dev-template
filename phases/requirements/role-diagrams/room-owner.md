# Room Owner Use Case Diagram

Room Owner 是 Room 的最高权限角色（权威矩阵见 uc-rr-006）。除 owner/admin 共有的房间管理能力
（邀请/移除 member、修改房间名/可见性/AI 上下文字段、删除他人文件）外，**仅 owner** 拥有：
提升/降级 admin、移除 admin、删除房间。owner 本人不可被移除（owner 变更本期不做）。

```mermaid
flowchart LR
  RoomOwner["Room Owner"]
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
    ManageAdmin(("提升/降级/移除 admin — 仅 owner"))
    DeleteRoom(("删除房间 — 仅 owner"))
    Notification(("访问 Room 成员通知"))
  end

  RoomOwner --> RoomHome
  RoomOwner --> RoomBoard
  RoomOwner --> RoomChat
  RoomOwner --> RoomFiles
  RoomOwner --> RoomSurvey
  RoomOwner --> RoomAIContext
  RoomOwner --> RoomSettings
  RoomOwner --> InviteMember
  RoomOwner --> DeleteOthersFiles
  RoomOwner --> ManageAdmin
  RoomOwner --> DeleteRoom
  RoomOwner --> Notification

  InviteMember --> Mail
  Notification --> Mail
  RoomFiles --> Storage
  RoomAIContext --> AI
```
