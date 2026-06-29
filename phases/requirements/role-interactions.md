# BoardX 多角色交互 Use Case Diagram

本文档补充“不同角色之间如何交互”的 Use Case Diagram。单角色图用于说明某个角色能访问哪些一级模块；本文件用于说明多个角色围绕同一个业务目标如何协作、授权、审核、提交和管理。

## Team 角色交互

```mermaid
flowchart LR
  Guest["访客"]
  User["注册用户"]
  TeamOwner["Team Owner"]
  TeamAdmin["Team Admin"]
  TeamMember["Team Member"]
  Mail["邮件服务"]
  Payment["支付系统"]

  subgraph BoardX["BoardX Team 空间"]
    CreateTeam(("创建 Team"))
    ConfigureTeam(("配置 Team"))
    InviteMember(("邀请成员"))
    AcceptTeamInvite(("接受 Team 邀请"))
    ManageMember(("管理成员与角色"))
    AccessTeamWorkspace(("访问 Team 工作区"))
    ManageTeamCredits(("管理 Team 积分"))
    ViewCreditDenied(("查看积分无权限提示"))
    ViewTeamStats(("查看 Team 统计"))
    SendNotification(("发送邀请或通知"))
  end

  User --> CreateTeam
  CreateTeam --> TeamOwner
  TeamOwner --> ConfigureTeam
  TeamOwner --> InviteMember
  TeamOwner --> ManageMember
  TeamOwner --> ManageTeamCredits
  TeamOwner --> ViewTeamStats
  TeamAdmin --> InviteMember
  TeamAdmin --> ManageMember
  TeamAdmin --> ManageTeamCredits
  TeamAdmin --> ViewTeamStats
  Guest --> AcceptTeamInvite
  User --> AcceptTeamInvite
  AcceptTeamInvite --> TeamMember
  TeamMember --> AccessTeamWorkspace
  TeamMember --> ViewCreditDenied

  InviteMember -.->|include| SendNotification
  SendNotification --> Mail
  ManageTeamCredits --> Payment
```

## Room 角色交互

```mermaid
flowchart LR
  TeamOwner["Team Owner"]
  TeamAdmin["Team Admin"]
  TeamMember["Team Member"]
  RoomOwner["Room Owner"]
  RoomAdmin["Room Admin"]
  RoomMember["Room Member"]
  Mail["邮件服务"]

  subgraph BoardX["BoardX Room 空间"]
    CreateRoom(("创建 Room"))
    ConfigureRoom(("配置 Room"))
    InviteRoomMember(("邀请 Room 成员"))
    ManageRoomMember(("管理 Room 成员与角色"))
    AccessRoom(("访问 Room"))
    AccessRoomBoard(("访问 Room 内 Board"))
    AccessRoomChat(("访问 Room Chat"))
    AccessRoomFiles(("访问 Room 文件"))
    SendRoomNotification(("发送 Room 通知"))
  end

  TeamMember --> CreateRoom
  CreateRoom --> RoomOwner
  TeamOwner --> ConfigureRoom
  TeamAdmin --> ConfigureRoom
  RoomOwner --> ConfigureRoom
  RoomOwner --> InviteRoomMember
  RoomOwner --> ManageRoomMember
  RoomAdmin --> InviteRoomMember
  RoomAdmin --> ManageRoomMember
  TeamMember --> AccessRoom
  AccessRoom --> RoomMember
  RoomMember --> AccessRoomBoard
  RoomMember --> AccessRoomChat
  RoomMember --> AccessRoomFiles

  InviteRoomMember -.->|include| SendRoomNotification
  SendRoomNotification --> Mail
```

## Board 角色交互

```mermaid
flowchart LR
  RoomOwner["Room Owner"]
  RoomAdmin["Room Admin"]
  RoomMember["Room Member"]
  BoardOwner["Board Owner"]
  BoardAdmin["Board Admin"]
  BoardMember["Board Member"]
  BoardVisitor["Board Visitor"]
  Realtime["实时协作服务"]
  Storage["文件存储服务"]
  AI["AI 服务"]

  subgraph BoardX["BoardX Board 空间"]
    CreateBoard(("创建 Board"))
    ManageBoardAccess(("管理 Board 权限"))
    OpenBoard(("打开 Board"))
    EditCanvas(("协作编辑画布"))
    ViewCanvas(("浏览画布"))
    ManageBoardContent(("管理 Board 内容"))
    UseBoardAI(("使用白板 AI"))
    UseBoardAssets(("使用白板素材"))
    ExportBoard(("导出 Board"))
  end

  RoomMember --> CreateBoard
  CreateBoard --> BoardOwner
  RoomOwner --> ManageBoardAccess
  RoomAdmin --> ManageBoardAccess
  BoardOwner --> ManageBoardAccess
  BoardAdmin --> ManageBoardAccess
  BoardMember --> OpenBoard
  BoardAdmin --> OpenBoard
  BoardOwner --> OpenBoard
  BoardVisitor --> OpenBoard
  BoardOwner --> ManageBoardContent
  BoardAdmin --> ManageBoardContent
  BoardMember --> EditCanvas
  BoardAdmin --> EditCanvas
  BoardOwner --> EditCanvas
  BoardVisitor --> ViewCanvas
  BoardOwner --> UseBoardAI
  BoardAdmin --> UseBoardAI
  BoardMember --> UseBoardAI
  BoardOwner --> UseBoardAssets
  BoardAdmin --> UseBoardAssets
  BoardMember --> UseBoardAssets
  BoardOwner --> ExportBoard
  BoardAdmin --> ExportBoard
  BoardMember --> ExportBoard
  BoardVisitor --> ExportBoard

  EditCanvas --> Realtime
  UseBoardAssets --> Storage
  UseBoardAI --> AI
```

## Survey 角色交互

```mermaid
flowchart LR
  TeamOwner["Team Owner"]
  TeamAdmin["Team Admin"]
  SurveyOwner["Survey Owner"]
  SurveyAdmin["Survey Admin"]
  SurveyMember["Survey Member"]
  Respondent["问卷答题人"]

  subgraph BoardX["BoardX Survey 空间"]
    CreateSurvey(("创建问卷"))
    ManageSurvey(("管理问卷"))
    PublishSurvey(("发布问卷"))
    ShareSurvey(("分享问卷"))
    AnswerSurvey(("提交问卷答复"))
    ViewSurveyReport(("查看问卷报告"))
    ManageSurveyTemplate(("管理问卷模板"))
  end

  SurveyMember --> CreateSurvey
  CreateSurvey --> SurveyOwner
  SurveyOwner --> ManageSurvey
  SurveyOwner --> PublishSurvey
  SurveyOwner --> ShareSurvey
  SurveyOwner --> ViewSurveyReport
  SurveyAdmin --> ManageSurvey
  SurveyAdmin --> PublishSurvey
  SurveyAdmin --> ViewSurveyReport
  SurveyAdmin --> ManageSurveyTemplate
  TeamOwner --> SurveyAdmin
  TeamAdmin --> SurveyAdmin
  ShareSurvey --> Respondent
  Respondent --> AnswerSurvey
  AnswerSurvey --> ViewSurveyReport
```

## AI Store 角色交互

```mermaid
flowchart LR
  StoreCreator["AI Store 创作者"]
  TeamMember["Team Member"]
  TeamAdmin["Team Admin"]
  SysAdmin["系统管理员"]
  AI["AI 服务"]
  Storage["文件存储服务"]

  subgraph BoardX["BoardX AI Store"]
    CreateStoreItem(("创建 AI Store 项目"))
    ManageStoreItem(("维护 AI Store 项目"))
    ShareManagement(("共享管理权限"))
    TeamReview(("Team 审核项目"))
    PlatformReview(("平台审核项目"))
    FeatureItem(("设置精选"))
    BrowseStore(("浏览 AI Store"))
    SubscribeItem(("订阅 AI Store 项目"))
    UseStoreItem(("使用 AI Store 项目"))
    ViewAgentUsage(("查看 Agent 用量"))
  end

  StoreCreator --> CreateStoreItem
  StoreCreator --> ManageStoreItem
  StoreCreator --> ShareManagement
  StoreCreator --> ViewAgentUsage
  CreateStoreItem --> TeamReview
  TeamAdmin --> TeamReview
  TeamReview --> PlatformReview
  SysAdmin --> PlatformReview
  SysAdmin --> FeatureItem
  TeamMember --> BrowseStore
  TeamMember --> SubscribeItem
  TeamMember --> UseStoreItem
  UseStoreItem --> ViewAgentUsage

  ManageStoreItem --> Storage
  UseStoreItem --> AI
```
