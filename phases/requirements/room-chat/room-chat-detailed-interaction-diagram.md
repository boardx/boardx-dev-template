# Room Chat 详细交互图

本图按 Room Chat 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  ChatPage["进入 /room/[roomId]/chat/[chatId]"] --> MessageList["看到聊天消息、输入区、文件入口和线程状态"]
  MessageList --> Send["输入并发送消息"]
  Send --> Sending["消息进入发送或生成状态"]
  Sending --> Reply["消息追加或 AI 回复展示"]
  Sending --> SendFail["失败提示并保留可重试状态"]
  MessageList --> Upload["上传文件"]
  Upload --> FileState["文件显示上传、处理中、可用或失败"]
  MessageList --> Switch["打开其它聊天线程"]
  Switch --> OtherThread["消息区切换到目标线程"]
  MessageList --> Delete["删除聊天"]
  Delete --> DeleteConfirm["确认后移除线程或取消"]
  MessageList --> Readonly{"是否只读线程"}
  Readonly -->|是| DisableInput["输入和发送入口禁用"]
  Readonly -->|否| Send
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["在房间中新建聊天"]
    D1Start["Actor：Room member、Room admin、Room owner"]
    D1Entry["可见入口/区域：房间 Chat 页签中的 New Chat 按钮。"]
    D1Start --> D1Entry
    D1S1["1. 用户进入房间页面并点击 Chat 页签。"]
    D1Entry --> D1S1
    D1S2["2. 系统展示房间聊天列表，顶部显示 Chat List 和 New Chat 按钮。"]
    D1S1 --> D1S2
    D1S3["3. 如果还没有聊天，系统展示空状态，提示新聊天创建后会出现在这里。"]
    D1S2 --> D1S3
    D1S4["4. 用户点击 New Chat。"]
    D1S3 --> D1S4
    D1S5["5. 系统检查是否存在当前房间下尚未发送消息的虚拟线程；如果存在，直接打开该线程。"]
    D1S4 --> D1S5
    D1S6["6. 如果不存在，系统创建一个新的虚拟聊天线程，并把它设为当前聊天。"]
    D1S5 --> D1S6
    D1S7["7. 页面切换到聊天工作区，中间显示 AVA 聊天区域，左侧为 Room Files，右<br/>侧为 Studio。"]
    D1S6 --> D1S7
    D1Alt{"备选：A1：已有未使用的虚拟线程时，系统复用该线程，不创建新的线程。；A2：用户返回房间列表，<br/>当前线程选择被清除。"}
    D1S7 --> D1Alt
    D1Err{"异常：E1：创建线程失败时，系统不创建空白线程，并在当前聊天区域或全局提示中显示失败反馈。"}
    D1S7 --> D1Err
    D1Perm["权限/可见性：- owner/admin/member 都可以在自己已加入的房间中新建房间聊天。；- <br/>非房间成员不能进入房间 Chat 页签。；- visitor/未登录用户不能新建房间聊天<br/>。"]
    D1S7 --> D1Perm
  end
  subgraph D2G["查看并打开房间聊天"]
    D2Start["Actor：Room member、Room admin、Room owner"]
    D2Entry["可见入口/区域：房间 Chat 页签中的聊天列表。"]
    D2Start --> D2Entry
    D2S1["1. 用户进入房间 Chat 页签。"]
    D2Entry --> D2S1
    D2S2["2. 系统加载当前团队、当前房间下的聊天线程，并合并本地已存在的房间线程。"]
    D2S1 --> D2S2
    D2S3["3. 系统过滤掉虚拟线程和已被当前页面标记删除的线程。"]
    D2S2 --> D2S3
    D2S4["4. 系统按最近更新时间或创建时间倒序排列线程。"]
    D2S3 --> D2S4
    D2S5["5. 聊天按日期分组展示，例如今天、昨天、几天前或具体日期。"]
    D2S4 --> D2S5
    D2S6["6. 每个聊天卡片展示名称、日期、最后编辑者或创建者信息。"]
    D2S5 --> D2S6
    D2S7["7. 用户点击某个聊天卡片。"]
    D2S6 --> D2S7
    D2S8["8. 系统把该线程设为当前聊天，并进入房间聊天详情地址。"]
    D2S7 --> D2S8
    D2S9["9. 页面显示返回房间按钮、AI agent 选择入口、聊天头部菜单、AVA 聊天主体、<br/>Room Files 和 Studio 面板。"]
    D2S8 --> D2S9
    D2S10["10. 如果打开的是其他成员创建的已保存聊天线程，聊天输入和文件操作区域显示仅查看状态。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：没有线程时，系统展示空状态，并提供 New Chat。；A2：用户点击返回房间，系<br/>统回到 Chat 列表。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：线程加载中，系统展示骨架卡片。；E2：正在删除的线程卡片会降低可操作性，避免重复操<br/>作。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：- owner/admin/member 都可以查看当前房间可见的聊天列表。；- own<br/>er/admin/member 的房间角色不会自动授予编辑其他成员聊天线程的权限；他人创<br/>建的已保存线程以仅查看方式呈现。；- 删除菜单只在当前用户相关的线程卡片上显示。；- v<br/>isitor/未加入房间的用户不能查看或打开房间聊天列表。"]
    D2S10 --> D2Perm
  end
  subgraph D3G["在房间聊天中发送消息"]
    D3Start["Actor：Room member、Room admin、Room owner"]
    D3Entry["可见入口/区域：房间聊天线程中的 AVA 聊天输入区。"]
    D3Start --> D3Entry
    D3S1["1. 用户打开房间聊天线程后，系统展示三栏聊天工作区。"]
    D3Entry --> D3S1
    D3S2["2. 中间聊天区域展示 AVA 聊天主体。"]
    D3S1 --> D3S2
    D3S3["3. 用户可以在聊天输入区输入问题或指令。"]
    D3S2 --> D3S3
    D3S4["4. 用户发送消息后，系统在当前聊天线程中追加用户消息。"]
    D3S3 --> D3S4
    D3S5["5. 系统以 room chat 类型和当前 roomId 处理对话，使回复与当前房间关<br/>联。"]
    D3S4 --> D3S5
    D3S6["6. 用户可以在同一线程中继续发送消息。"]
    D3S5 --> D3S6
    D3S7["7. 用户点击返回房间，系统清除当前聊天选择，并回到房间 Chat 列表。"]
    D3S6 --> D3S7
    D3Alt{"备选：A1：用户收起 Room Files 或 Studio 面板后继续发送消息。；A2：用户<br/>更换可用 AI agent 后继续对话。"}
    D3S7 --> D3Alt
    D3Err{"异常：E1：如果当前线程被删除，系统返回房间 Chat 列表。；E2：AI 回复失败或额度问题<br/>由 AVA 聊天区展示；当前 Room Chat 容器只承载聊天工作区。"}
    D3S7 --> D3Err
    D3Perm["权限/可见性：- owner/admin/member 都可以在自己创建或可编辑的房间聊天线程中发送消<br/>息。；- 打开其他成员创建的已保存聊天线程时，页面提示仅可查看内容，不能发送消息或修改。<br/>；- 非房间成员不能进入该线程。；- visitor/未登录用户不能发送房间聊天消息。"]
    D3S7 --> D3Perm
  end
  subgraph D4G["删除房间聊天"]
    D4Start["Actor：聊天创建者或当前用户相关线程的用户"]
    D4Entry["可见入口/区域：房间 Chat 页签中聊天卡片的更多菜单。"]
    D4Start --> D4Entry
    D4S1["1. 用户进入房间 Chat 页签，看到聊天线程卡片。"]
    D4Entry --> D4S1
    D4S2["2. 对于当前用户创建或归属当前用户的线程，卡片右上角显示更多菜单。"]
    D4S1 --> D4S2
    D4S3["3. 用户点击更多菜单，选择 Delete。"]
    D4S2 --> D4S3
    D4S4["4. 系统打开确认弹窗，展示删除标题和确认说明；如果线程有名称，说明中包含线程名称。"]
    D4S3 --> D4S4
    D4S5["5. 用户点击 Delete，系统把该线程标记为删除中，并从当前列表中隐藏。"]
    D4S4 --> D4S5
    D4S6["6. 系统删除聊天线程。"]
    D4S5 --> D4S6
    D4S7["7. 如果用户当前正打开该线程，系统返回房间 Chat 列表。"]
    D4S6 --> D4S7
    D4Alt{"备选：A1：用户点击 Cancel，系统关闭弹窗，不删除线程。"}
    D4S7 --> D4Alt
    D4Err{"异常：E1：删除失败，系统记录错误，并把线程恢复到列表中。；E2：删除过程中，删除按钮显示加载<br/>状态并禁用重复点击。"}
    D4S7 --> D4Err
    D4Perm["权限/可见性：- owner/admin/member 都只能在页面显示删除菜单的线程上发起删除。；-<br/> 当前只确认 room owner/admin 不会因为角色自动看到其他成员线程的删除菜<br/>单。；- visitor/未加入房间的用户不能看到房间聊天删除入口。"]
    D4S7 --> D4Perm
  end
```

