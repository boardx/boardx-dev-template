# BoardX 模块访问权限 Use Case Diagram

本文档按模块描述“哪些角色可以访问哪些一级功能”。当某个模块存在 owner/admin/member/visitor 等权限差异时，本文件只画模块级边界，具体操作下钻到模块目录中的 Use Case。

## Team 模块访问

```mermaid
flowchart LR
  TeamOwner["Team Owner"]
  TeamAdmin["Team Admin"]
  TeamMember["Team Member"]

  subgraph Team["Team 模块"]
    Settings(("Team 设置"))
    Members(("成员管理"))
    Rooms(("Room 管理"))
    Boards(("Board 列表"))
    AIStore(("Team AI Store"))
    Knowledge(("Team 知识库"))
    Surveys(("Team 问卷"))
    Credits(("积分管理"))
    CreditsDenied(("积分无权限提示"))
    Stats(("统计"))
  end

  TeamOwner --> Settings
  TeamOwner --> Members
  TeamOwner --> Rooms
  TeamOwner --> Boards
  TeamOwner --> AIStore
  TeamOwner --> Knowledge
  TeamOwner --> Surveys
  TeamOwner --> Credits
  TeamOwner --> Stats
  TeamAdmin --> Settings
  TeamAdmin --> Members
  TeamAdmin --> Rooms
  TeamAdmin --> Boards
  TeamAdmin --> AIStore
  TeamAdmin --> Knowledge
  TeamAdmin --> Surveys
  TeamAdmin --> Credits
  TeamAdmin --> Stats
  TeamMember --> Rooms
  TeamMember --> Boards
  TeamMember --> AIStore
  TeamMember --> Knowledge
  TeamMember --> Surveys
  TeamMember --> CreditsDenied
```

## Room 模块访问

```mermaid
flowchart LR
  RoomOwner["Room Owner"]
  RoomAdmin["Room Admin"]
  RoomMember["Room Member"]
  PublicUser["公开访问用户"]

  subgraph Room["Room 模块"]
    RoomHome(("Room 首页"))
    RoomSettings(("Room 设置"))
    RoomMembers(("Room 成员权限"))
    RoomBoards(("Room 内 Board"))
    RoomChat(("Room Chat"))
    RoomFiles(("Room 文件"))
    JoinRoom(("加入公开 Room"))
  end

  RoomOwner --> RoomHome
  RoomOwner --> RoomSettings
  RoomOwner --> RoomMembers
  RoomOwner --> RoomBoards
  RoomOwner --> RoomChat
  RoomOwner --> RoomFiles
  RoomAdmin --> RoomHome
  RoomAdmin --> RoomSettings
  RoomAdmin --> RoomMembers
  RoomAdmin --> RoomBoards
  RoomAdmin --> RoomChat
  RoomAdmin --> RoomFiles
  RoomMember --> RoomHome
  RoomMember --> RoomBoards
  RoomMember --> RoomChat
  RoomMember --> RoomFiles
  PublicUser --> RoomHome
  PublicUser --> JoinRoom
```

## Board 模块访问

```mermaid
flowchart LR
  BoardOwner["Board Owner"]
  BoardAdmin["Board Admin"]
  BoardMember["Board Member"]
  BoardVisitor["Board Visitor"]
  PublicUser["公开访问用户"]

  subgraph Board["Board 模块"]
    BoardInfo(("Board 信息"))
    BoardAccess(("Board 权限共享"))
    Canvas(("Canvas"))
    Header(("Header"))
    BoardMenu(("Board Menu"))
    WidgetMenu(("Widget Menu"))
    ContextMenu(("Context Menu"))
    Slides(("演示页"))
    Export(("导出"))
    JoinBoard(("加入公开 Board"))
  end

  BoardOwner --> BoardInfo
  BoardOwner --> BoardAccess
  BoardOwner --> Canvas
  BoardOwner --> Header
  BoardOwner --> BoardMenu
  BoardOwner --> WidgetMenu
  BoardOwner --> ContextMenu
  BoardOwner --> Slides
  BoardOwner --> Export
  BoardAdmin --> BoardInfo
  BoardAdmin --> BoardAccess
  BoardAdmin --> Canvas
  BoardAdmin --> Header
  BoardAdmin --> BoardMenu
  BoardAdmin --> WidgetMenu
  BoardAdmin --> ContextMenu
  BoardAdmin --> Slides
  BoardAdmin --> Export
  BoardMember --> BoardInfo
  BoardMember --> Canvas
  BoardMember --> Header
  BoardMember --> BoardMenu
  BoardMember --> WidgetMenu
  BoardMember --> ContextMenu
  BoardMember --> Slides
  BoardMember --> Export
  BoardVisitor --> BoardInfo
  BoardVisitor --> Canvas
  BoardVisitor --> Header
  BoardVisitor --> Slides
  BoardVisitor --> Export
  PublicUser --> BoardInfo
  PublicUser --> JoinBoard
```

## Survey 模块访问

```mermaid
flowchart LR
  SurveyOwner["Survey Owner"]
  SurveyAdmin["Survey Admin"]
  SurveyMember["Survey Member"]
  Respondent["问卷答题人"]

  subgraph Survey["问卷模块"]
    Design(("问卷设计"))
    Publish(("发布与分享"))
    Report(("报告"))
    Template(("模板"))
    Answer(("答题"))
  end

  SurveyOwner --> Design
  SurveyOwner --> Publish
  SurveyOwner --> Report
  SurveyOwner --> Template
  SurveyAdmin --> Design
  SurveyAdmin --> Publish
  SurveyAdmin --> Report
  SurveyAdmin --> Template
  SurveyMember --> Design
  SurveyMember --> Answer
  SurveyMember --> Report
  Respondent --> Answer
```
