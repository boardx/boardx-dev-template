# Home Page 详细交互图

本图按 Home Page 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  DefaultEntry["登录后进入应用默认入口"] --> Root{"访问 /[language] 根路径"}
  Root -->|非邀请回调| AvaDefault["重定向到 /ava"]
  Root -->|用户打开 /home| Home["进入 /home"]
  AvaDefault --> AppShell["应用壳加载 Team 数据"]
  Home --> AppShell
  AppShell --> HasTeam{"用户是否已有 Team"}
  HasTeam -->|否| CreateTeam["自动打开创建 Team 弹窗"]
  CreateTeam --> TeamCreated["创建成功后进入 AVA 或当前默认工作区"]
  HasTeam -->|是| Sections["看到 Agent 分组、我的订阅、团队推荐、BoardX 推荐功能"]
  TeamCreated --> Sections
  Sections --> Search["搜索 Agent"]
  Search --> SearchResult["列表过滤或显示空状态"]
  Sections --> QuickChat["点击 Agent 快速对话"]
  QuickChat --> AvaChat["进入 AVA 对话并带入 Agent"]
  Sections --> More["点击更多"]
  More --> Store["进入 AI Store 或更多列表"]
  Sections --> Recommended["点击 BoardX 推荐功能"]
  Recommended --> FeatureTarget["进入对应功能或打开对话"]
  Sections --> Continue["继续上次对话"]
  Continue --> LastThread["打开最近聊天线程"]
  Sections --> EmptyTeam["团队推荐为空"]
  EmptyTeam --> EmptyState["显示空状态，不阻断其它分组"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["查看 Home Page"]
    D1Start["Actor：已登录用户"]
    D1Entry["可见入口/区域：应用左侧导航中的 Home。；登录后默认进入的 Home Page。；浏览器直接访问<br/>当前语言下的 Home 地址。"]
    D1Start --> D1Entry
    D1S1["1. 用户进入当前语言下的 Home Page。"]
    D1Entry --> D1S1
    D1S2["2. 系统先展示页面加载状态；客户端初始化完成后展示 Agent Home 页面。"]
    D1S1 --> D1S2
    D1S3["3. 系统加载当前用户、当前团队、我的订阅 Agent、团队订阅 Agent、最近使用 <br/>Agent 和可用 Agent 数据。"]
    D1S2 --> D1S3
    D1S4["4. 系统在顶部欢迎区域展示用户名称，并在有团队名称时展示当前团队名称。"]
    D1S3 --> D1S4
    D1S5["5. 系统展示搜索框，用户可按 Agent 名称、描述或标签搜索当前页面可见的 Agen<br/>t。"]
    D1S4 --> D1S5
    D1S6["6. 如果当前状态中存在可继续的聊天线程，系统展示“继续上次对话”入口；用户点击后进入该<br/> AVA 聊天。"]
    D1S5 --> D1S6
    D1S7["7. 系统展示“最近使用的 Agent”“我订阅的 Agent”“团队推荐的 Agent<br/>”等区域；区域中无数据时展示空状态。"]
    D1S6 --> D1S7
    D1S8["8. Agent 卡片展示头像或默认图标、名称、来源标签、描述、标签或模型信息、使用次数<br/>、最近使用时间、浏览量、喜欢数和“快捷对话”按钮。"]
    D1S7 --> D1S8
    D1S9["9. 用户点击“更多”时，对应横向卡片列表继续滚动。"]
    D1S8 --> D1S9
    D1S10["10. 用户点击“快捷对话”时，系统按所选 Agent 创建或转换聊天线程，设置模型和 <br/>Agent 上下文，并跳转到 AVA 聊天页面。"]
    D1S9 --> D1S10
    D1S11["11. 系统展示“BoardX 推荐功能”区域，包含用户研究、深度研究和实时转录入口。"]
    D1S10 --> D1S11
    D1S12["12. 用户点击推荐功能按钮时，系统创建对应 AVA 聊天线程并跳转到聊天页面；实时转录<br/>入口会记录自动打开转录的状态。"]
    D1S11 --> D1S12
    D1S13["13. 如果数据仍在加载，系统在对应区域展示加载占位；如果加载失败或为空，用户仍可使用可<br/>见入口进入 AI Store、创建 Agent 或会话列表。"]
    D1S12 --> D1S13
    D1Alt{"备选：A1：用户没有可用团队时，系统引导用户创建或加入团队。；A2：用户没有任何可用 Agen<br/>t 时，系统展示空状态，并提供创建 Agent 或进入 AI Store 的入口。；A3<br/>：用户输入搜索关键词后，系统仅保留名称、描述或标签匹配的 Agent；没有匹配项时展示空<br/>状态。；A4：用户所在团队没有推荐 Agent 时，“团队推荐的 Agent”区域展示当<br/>前分组暂无可展示 Agent。"}
    D1S13 --> D1Alt
    D1Err{"异常：E1：用户未登录，系统跳转登录。；E2：当前团队信息加载失败，系统保留页面框架，并提示用<br/>户刷新或重新选择团队。；E3：Agent 数据加载失败，系统在对应区域展示空状态或错误反<br/>馈。；E4：用户点击快速对话但对话创建失败，系统停止加载状态，并保留用户在 Home P<br/>age。"}
    D1S13 --> D1Err
    D1Perm["权限/可见性：1. 注册用户可以查看首页工作台。；2. 未登录用户应进入身份认证入口。；3. “我订阅<br/>的 Agent”仅展示当前用户在当前团队上下文下可使用的 Agent。；4. “团队推荐<br/>的 Agent”仅展示当前团队可向成员推荐或共享的 Agent。；5. 只有对当前 Ag<br/>ent 有使用权限的用户才能从卡片进入快速对话。"]
    D1S13 --> D1Perm
  end
  subgraph D2G["打开最近访问白板"]
    D2Start["Actor：已登录用户"]
    D2Entry["可见入口/区域：Home 页面中出现的最近白板入口。；Recent 页面中出现的最近白板入口。"]
    D2Start --> D2Entry
    D2S1["1. 用户进入当前 Home Page，系统展示 Agent Home、Agent 分组<br/>、推荐功能和当前可见的继续入口。"]
    D2Entry --> D2S1
    D2S2["2. 系统不把最近白板列表作为当前 Home Page 必然展示内容。"]
    D2S1 --> D2S2
    D2S3["3. 用户如果在旧版 Recent Boards 组件、Room 页面或其它页面看到最近<br/>白板卡片，卡片展示白板名称和日期。"]
    D2S2 --> D2S3
    D2S4["4. 用户点击某个白板卡片，系统按卡片携带的白板标识跳转到 Board 页面。"]
    D2S3 --> D2S4
    D2S5["5. Board 页面加载目标白板，并展示 Header、画布内容、协作状态和当前角色可<br/>用入口。"]
    D2S4 --> D2S5
    D2S6["6. 如果用户只有只读权限，系统进入白板查看状态，并隐藏或禁用编辑入口。"]
    D2S5 --> D2S6
    D2S7["7. 如果当前 Home Page 没有最近白板入口，用户需要通过 Room、Board<br/>、全局搜索或其它已展示入口继续访问真实白板资源。"]
    D2S6 --> D2S7
    D2Alt{"备选：A1：最近白板为空，系统展示创建或进入房间的入口。；A2：最近白板入口尚未在当前页面启用<br/>时，系统展示开发中、空状态或不展示该入口。"}
    D2S7 --> D2Alt
    D2Err{"异常：E1：白板已删除，系统提示资源不存在。；E2：用户失去访问权限，系统拒绝访问。"}
    D2S7 --> D2Err
    D2Perm["权限/可见性：1. 注册用户可以查看首页工作台。；2. 未登录用户应进入身份认证入口。"]
    D2S7 --> D2Perm
  end
  subgraph D3G["首页新用户引导"]
    D3Start["Actor：新注册用户、首次进入团队的用户"]
    D3Entry["可见入口/区域：Home 页面或 Team Home 页面中的新手引导区域。；Board 页面中的教<br/>程或引导入口。"]
    D3Start --> D3Entry
    D3S1["1. 用户首次进入 Home Page 时，系统展示 Agent Home 的欢迎区、A<br/>gent 分组、空状态和推荐功能入口。"]
    D3Entry --> D3S1
    D3S2["2. 如果用户没有可展示 Agent，系统在分组中展示空状态，并提供进入 AI Stor<br/>e 或创建 Agent 的入口。"]
    D3S1 --> D3S2
    D3S3["3. 用户查看“我订阅的 Agent”“团队推荐的 Agent”或“BoardX 推荐功<br/>能”等分组，系统展示卡片、空状态或更多入口。"]
    D3S2 --> D3S3
    D3S4["4. 用户点击 Agent 卡片中的快捷对话，系统进入 AVA 对话创建或打开流程。"]
    D3S3 --> D3S4
    D3S5["5. 用户点击推荐功能，例如用户研究、深度研究或实时转录，系统创建对应 AVA 场景或进<br/>入相应功能入口。"]
    D3S4 --> D3S5
    D3S6["6. 用户点击 AI Store 或更多入口，系统进入对应浏览页面。"]
    D3S5 --> D3S6
    D3S7["7. 如果页面或团队上下文仍在加载，系统先展示加载状态；加载完成后再展示可操作入口。"]
    D3S6 --> D3S7
    D3S8["8. Home Page 本身不确认创建团队、房间或白板的完整引导流程；这些流程由对应模<br/>块完成。"]
    D3S7 --> D3S8
    D3Alt{"备选：A1：用户跳过教程，系统关闭引导。；A2：用户稍后再次打开教程。"}
    D3S8 --> D3Alt
    D3Err{"异常：E1：创建资源失败，系统提示重试。；E2：用户无权限创建资源，系统显示可用入口。"}
    D3S8 --> D3Err
    D3Perm["权限/可见性：1. 注册用户可以查看首页工作台。；2. 未登录用户应进入身份认证入口。"]
    D3S8 --> D3Perm
  end
  subgraph D4G["查看最近访问页面"]
    D4Start["Actor：注册用户"]
    D4Entry["可见入口/区域：Recent 页面。；导航或首页中的 Recent 入口。"]
    D4Start --> D4Entry
    D4S1["1. 用户从导航或直接地址进入 Recent 页面。"]
    D4Entry --> D4S1
    D4S2["2. 系统展示 Recent Activity 标题。"]
    D4S1 --> D4S2
    D4S3["3. 系统展示“This page is under development.”提示。"]
    D4S2 --> D4S3
    D4S4["4. 页面主体不展示最近资源卡片、列表、筛选器、排序器或打开资源按钮。"]
    D4S3 --> D4S4
    D4S5["5. 用户停留在该页面时，只能查看开发中提示，不能从该页面直接打开最近资源。"]
    D4S4 --> D4S5
    D4S6["6. 用户可通过浏览器返回、左侧导航、Home、Room、Board 或全局搜索继续访问<br/>工作内容。"]
    D4S5 --> D4S6
    D4S7["7. 用户离开 Recent 页面后，系统按目标导航加载对应模块。"]
    D4S6 --> D4S7
    D4Alt{"备选：A1：用户没有可用最近资源或功能尚未启用时，系统展示空状态、开发中提示或导航到其他工作入<br/>口。；A2：后续支持团队范围时，系统展示当前团队范围内的最近资源。"}
    D4S7 --> D4Alt
    D4Err{"异常：E1：资源加载失败，系统提示重试。；E2：最近资源已无权限访问，系统提示无法打开并从可见<br/>列表移除或标记不可访问。"}
    D4S7 --> D4Err
    D4Perm["权限/可见性：1. 用户只能看到自己有权限访问的最近资源。；2. Team 私有资源不能展示给非成员。"]
    D4S7 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["搜索 Home Page Agent"]
    D5Start["Actor：已登录用户"]
    D5Entry["可见入口/区域：Home Page 顶部搜索框。"]
    D5Start --> D5Entry
    D5S1["1. 用户进入 Home Page，看到 Agent Home 欢迎区和搜索框。"]
    D5Entry --> D5S1
    D5S2["2. 用户在搜索框输入关键词。"]
    D5S1 --> D5S2
    D5S3["3. 系统按关键词过滤当前已加载的 Agent，匹配范围包括 Agent 名称、描述和标<br/>签。"]
    D5S2 --> D5S3
    D5S4["4. 系统在“我订阅的 Agent”“团队推荐的 Agent”等分组中只展示匹配卡片，并<br/>更新分组计数。"]
    D5S3 --> D5S4
    D5S5["5. 如果分组没有匹配项，系统在该分组展示空状态。"]
    D5S4 --> D5S5
    D5S6["6. 用户清空搜索框后，系统恢复展示当前团队上下文下已加载的可见 Agent。"]
    D5S5 --> D5S6
    D5S7["7. 用户可点击匹配 Agent 的“快捷对话”进入带有该 Agent 上下文的 AVA<br/> 聊天。"]
    D5S6 --> D5S7
    D5Alt{"备选：A1：没有匹配结果时，系统在对应分组展示空状态。；A2：用户只输入部分关键词时，系统仍按<br/>可识别文本进行过滤。"}
    D5S7 --> D5Alt
    D5Err{"异常：E1：Agent 数据仍在加载时，系统展示加载占位，搜索结果随数据返回后刷新。；E2：A<br/>gent 数据加载失败时，系统展示空状态或错误反馈。"}
    D5S7 --> D5Err
    D5Perm["权限/可见性：1. 搜索只作用于用户已经有权查看的 Agent。；2. 搜索结果不得暴露当前用户无权访<br/>问的团队或私有 Agent。"]
    D5S7 --> D5Perm
  end
  subgraph D6G["从 Home Page 发起 Agent 快速对话"]
    D6Start["Actor：已登录用户"]
    D6Entry["可见入口/区域：最近使用的 Agent 卡片。；我订阅的 Agent 卡片。；团队推荐的 Agent<br/> 卡片。"]
    D6Start --> D6Entry
    D6S1["1. 用户在 Home Page 的 Agent 分组或最近使用区域浏览 Agent 卡<br/>片。"]
    D6Entry --> D6S1
    D6S2["2. 系统在卡片上展示 Agent 名称、描述、来源标签、能力标签或模型、使用次数、最近<br/>使用时间、浏览量、喜欢数和“快捷对话”按钮。"]
    D6S1 --> D6S2
    D6S3["3. 用户点击某个 Agent 的“快捷对话”。"]
    D6S2 --> D6S3
    D6S4["4. 系统显示启动中的状态，并防止重复点击。"]
    D6S3 --> D6S4
    D6S5["5. 系统读取该 Agent 的配置，判断是否需要持久化 Agent 选择、是否启用 D<br/>eep Agent，以及应使用 auto、Agent 指定模型或默认模型。"]
    D6S4 --> D6S5
    D6S6["6. 系统创建新的 AVA 聊天线程，写入线程名称、Agent、模型和研究类型等当前聊天<br/>状态。"]
    D6S5 --> D6S6
    D6S7["7. 系统将虚拟线程转换为真实线程后，跳转到 AVA 聊天页面。"]
    D6S6 --> D6S7
    D6S8["8. 用户在聊天页面继续输入问题或任务。"]
    D6S7 --> D6S8
    D6Alt{"备选：A1：用户从“最近使用的 Agent”进入时，系统按该最近记录对应的来源继续打开。；A2<br/>：用户从“团队推荐的 Agent”进入时，系统以团队推荐来源打开，但仍使用当前用户身份发<br/>起对话。"}
    D6S8 --> D6Alt
    D6Err{"异常：E1：Agent 已被取消订阅或无权访问，系统提示当前 Agent 不可用，并停留在 H<br/>ome Page。；E2：对话创建失败，系统取消启动状态，并允许用户重试。；E3：Age<br/>nt 配置加载失败，系统提示无法打开该 Agent。"}
    D6S8 --> D6Err
    D6Perm["权限/可见性：1. 用户只能发起自己有权使用的 Agent 对话。；2. 团队推荐 Agent 对团队<br/>成员可见时，成员可以从 Home Page 发起对话。；3. 私有或未授权 Agent <br/>不应出现在可点击列表中。"]
    D6S8 --> D6Perm
  end
  subgraph D7G["从 Home Page 启动 BoardX 推荐功能"]
    D7Start["Actor：已登录用户"]
    D7Entry["可见入口/区域：Home Page 的 BoardX 推荐功能区域。"]
    D7Start --> D7Entry
    D7S1["1. 用户在 Home Page 查看“BoardX 推荐功能”区域。"]
    D7Entry --> D7S1
    D7S2["2. 系统展示用户研究、深度研究和实时转录三类推荐功能卡片。"]
    D7S1 --> D7S2
    D7S3["3. 每张卡片展示功能名称、说明、辅助说明、标签和操作按钮。"]
    D7S2 --> D7S3
    D7S4["4. 用户点击“用户研究”的创建入口，系统创建 AVA 聊天线程，设置研究类型为 use<br/>r_research，并进入聊天页面。"]
    D7S3 --> D7S4
    D7S5["5. 用户点击“深度研究”的开始入口，系统创建 AVA 聊天线程，设置研究类型为 dee<br/>p_research，并进入聊天页面。"]
    D7S4 --> D7S5
    D7S6["6. 用户点击“实时转录”的开始入口，系统创建普通 AVA 聊天线程，记录自动打开实时转<br/>录的状态，并进入聊天页面。"]
    D7S5 --> D7S6
    D7S7["7. 创建过程中按钮展示加载状态；创建失败时系统停止加载，用户仍停留在 Home Pag<br/>e。"]
    D7S6 --> D7S7
    D7Alt{"备选：A1：用户只浏览推荐功能但不点击，系统保持 Home Page 当前状态。；A2：推荐功<br/>能启动后，用户在 AVA 页面继续完成具体任务。"}
    D7S7 --> D7Alt
    D7Err{"异常：E1：当前团队或用户信息缺失，系统不启动推荐功能，并保留在 Home Page。；E2：<br/>创建 AVA 对话失败，系统停止加载状态，并允许用户重试。；E3：实时转录需要麦克风权限<br/>时，后续由 AVA 对话中的转录流程处理授权。"}
    D7S7 --> D7Err
    D7Perm["权限/可见性：1. 已登录用户在有可用团队上下文时可以看到推荐功能。；2. 推荐功能的最终使用仍受 A<br/>VA、团队和 Credit 相关规则约束。"]
    D7S7 --> D7Perm
  end
  subgraph D8G["从 Home Page 继续上次对话"]
    D8Start["Actor：已登录用户"]
    D8Entry["可见入口/区域：Home Page 顶部欢迎区域中的“继续上次对话”入口。"]
    D8Start --> D8Entry
    D8S1["1. 用户进入 Home Page。"]
    D8Entry --> D8S1
    D8S2["2. 系统展示 Agent Home 顶部区域、Agent 分组和推荐功能。"]
    D8S1 --> D8S2
    D8S3["3. 系统读取当前 AVA 状态中的当前聊天线程。"]
    D8S2 --> D8S3
    D8S4["4. 如果当前线程存在有效 id，系统展示“继续上次对话”入口。"]
    D8S3 --> D8S4
    D8S5["5. 用户点击该入口，系统跳转到对应 AVA 聊天页面。"]
    D8S4 --> D8S5
    D8S6["6. AVA 页面加载目标线程，展示消息列表、输入框、Agent 选择或当前线程标题。"]
    D8S5 --> D8S6
    D8S7["7. 如果没有当前聊天线程，系统不展示该入口；用户可从 Agent 卡片、推荐功能或会话<br/>列表开始新的对话。"]
    D8S6 --> D8S7
    D8Alt{"备选：A1：用户没有可继续的对话时，系统不展示该入口。；A2：用户可以改为从 Agent 卡片<br/>或推荐功能创建新的 AVA 对话。"}
    D8S7 --> D8Alt
    D8Err{"异常：E1：对应对话已不存在，系统提示无法打开，并停留在 Home Page。；E2：用户失去<br/>该对话访问权限，系统拒绝打开。"}
    D8S7 --> D8Err
    D8Perm["权限/可见性：1. 只有当前用户有权访问的 AVA 对话才能作为继续入口展示。；2. 团队切换后，继续<br/>入口应以当前团队上下文下可访问的对话为准。"]
    D8S7 --> D8Perm
  end
```

