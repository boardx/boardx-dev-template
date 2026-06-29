# AI Store 详细交互图

本图按 AI Store 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Store["进入 AI Store"] --> Shell["显示左侧 AI 商店菜单和右侧内容区"]
  Shell --> Browsing["Browsing 分组"]
  Shell --> Creation["Creation 分组"]

  Browsing --> ExploreNav["探索：发现 AI 工具和代理"]
  Browsing --> SubscribeNav["订阅：管理已订阅项目"]
  Creation --> CreateNav["创建：构建新的 AI 资源"]
  Creation --> AuthorizedNav["已授权智能体：查看授权给我的资源"]
  Creation --> SharedNav["已分享：管理已分享的 AI 资源"]

  ExploreNav --> Explore["Explore 页面加载资源网格"]
  Explore --> Search["搜索 AI 资源名称或描述"]
  Search --> Result["结果数量和卡片列表刷新"]
  Explore --> TypeTabs["切换 智能体 / AI工具 / 图像工具 / 模板"]
  TypeTabs --> Result
  Explore --> TagFilter["点击标签筛选；已选标签高亮"]
  TagFilter --> Result
  Result --> ClearFilters["清空搜索或标签"]
  ClearFilters --> Explore
  Result --> Empty["无结果时显示空状态和调整筛选入口"]
  Explore --> Card["资源卡片"]

  Card --> CardContent["展示图标或预览图、名称、描述、最多两个标签、作者/来源、浏览量、喜欢数"]
  CardContent --> Badges["显示 Featured、深度智能体、专家、shared、已授权等标识"]
  CardContent --> Help["有学习文档时显示文档按钮"]
  Help --> OpenDoc["新窗口打开学习文档"]
  Card --> OpenDetail["点击卡片主体"]
  OpenDetail --> Detail["打开资源详情弹窗"]
  Detail --> DetailInfo["查看说明、描述、配置和可用操作"]

  Card --> SubscribeAction{"当前资源是否可订阅"}
  SubscribeAction -->|已通过 Team 或 BoardX 审核| Subscribe["显示订阅按钮"]
  SubscribeAction -->|未通过或不可见| NoSubscribe["不显示订阅按钮"]
  Subscribe --> Submitting["点击订阅，按钮或卡片进入处理中"]
  Submitting --> Subscribed["订阅状态更新，按钮变为已订阅/可取消"]
  Submitting --> SubscribeFailed["订阅失败，保留原状态并提示错误"]

  SubscribeNav --> SubscribedList["显示已订阅资源列表"]
  SubscribedList --> UseItem["点击使用 Agent / AI Tool / Image Tool / Template"]
  UseItem --> AvaOrTool["进入 AVA、工具执行或模板选择入口，并带入资源配置"]
  SubscribedList --> CancelSub["取消订阅"]
  CancelSub --> CancelResult["订阅列表或卡片状态刷新"]

  CreateNav --> ManageList["显示自己可管理的资源列表、发布状态筛选和创建按钮"]
  ManageList --> CreateButton["点击创建"]
  CreateButton --> TypeCreator["按当前类型打开 Agent / AI Tool / Image Tool / Template 创建器"]
  ManageList --> EditAction["点击卡片编辑按钮"]
  EditAction --> TypeCreator
  TypeCreator --> Form["填写名称、描述、图标、标签、提示词、工具参数、模板内容或输出格式"]
  Form --> Save["保存、更新、发布或提交审核"]
  Save --> SaveResult["成功提示并返回列表；失败时保留表单和错误"]

  AuthorizedNav --> AuthorizedList["显示已授权给当前用户管理的资源"]
  AuthorizedList --> AuthorizedBadge["卡片显示已授权标识"]
  AuthorizedList --> AuthorizedEdit["在授权范围内编辑或管理资源"]

  SharedNav --> SharedList["显示 shared 管理资源"]
  SharedList --> SharedBadge["卡片显示 shared 标识"]
  SharedList --> ShareManage["打开分享管理弹窗"]
  ShareManage --> CopyLink["复制授权链接"]
  ShareManage --> CloseShare["关闭分享链接"]
  ShareManage --> AuthorizedUsers["查看或移除已授权用户"]

  TeamAdmin["Team Owner/Admin"] --> TeamApproval["团队 AI Store 审核和团队订阅"]
  TeamApproval --> TeamApprovalResult["团队范围批准、撤销或订阅状态更新"]
  SysAdmin["系统管理员"] --> PlatformApproval["平台审核和官方精选"]
  PlatformApproval --> PlatformResult["BoardX 审核或精选状态更新"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["浏览和筛选 AI Store 项目"]
    D1Start["Actor：普通用户、Team 成员、AI Store 创作者、Team Adm<br/>in、BoardX Admin"]
    D1Entry["可见入口/区域：AI Store 页面 > Explore；AI Store 页面 > Subscr<br/>ibe；AI Store 页面 > 分类和筛选区域；AI Store 页面 > 搜索<br/>框；AI Store 页面 > 项目卡片列表；AI Store 项目卡片 > 查看详<br/>情"]
    D1Start --> D1Entry
    D1S1["1. 用户打开 AI Store，系统显示左侧 AI 商店菜单和右侧内容区。"]
    D1Entry --> D1S1
    D1S2["2. 左侧菜单展示 Browsing 分组：Explore 和 Subscribe；Cr<br/>eation 分组：Create、Authorized Agents、Shared。"]
    D1S1 --> D1S2
    D1S3["3. 用户点击 Explore，系统在右侧显示搜索框、结果数量、资源类型 Tab、标签筛<br/>选区和资源卡片网格。"]
    D1S2 --> D1S3
    D1S4["4. 系统按当前用户、团队、角色、页面类型和当前资源类型加载资源；加载中展示 loadi<br/>ng，加载失败展示错误和重试入口。"]
    D1S3 --> D1S4
    D1S5["5. 用户可在 Agent、AI Tool、Image Tool、Template 类型<br/>之间切换，系统刷新当前类型下的结果数量、标签和资源卡片。"]
    D1S4 --> D1S5
    D1S6["6. 用户输入关键词，系统按名称或描述过滤当前已加载资源；输入框出现清除入口，清空后恢复<br/>当前类型和标签范围。"]
    D1S5 --> D1S6
    D1S7["7. 用户点击标签，系统按标签过滤资源；已选标签高亮并显示 filters active<br/>，用户可再次点击标签或点击 Clear All 清除筛选。"]
    D1S6 --> D1S7
    D1S8["8. 资源卡片展示图标或预览图、名称、描述、最多两个可见标签、作者或来源、浏览量、喜欢数<br/>，以及 Featured、Deep Agent、专家、shared 或已授权等当前存在的<br/>标识。"]
    D1S7 --> D1S8
    D1S9["9. 资源提供学习文档时，卡片右上角显示文档按钮；用户点击后，系统在新窗口打开学习文档，<br/>不打开资源详情。"]
    D1S8 --> D1S9
    D1S10["10. 用户点击资源卡片主体，系统打开详情弹窗，展示该资源的说明、描述、公开配置和当前角<br/>色可用操作。"]
    D1S9 --> D1S10
    D1S11["11. 如果当前搜索、类型或标签没有匹配结果，系统展示空状态；存在筛选条件时展示清空筛选<br/>入口。"]
    D1S10 --> D1S11
    D1S12["12. Explore 分页加载时，用户可通过加载更多继续追加资源；追加后原有筛选和类型<br/>状态保持。"]
    D1S11 --> D1S12
    D1Alt{"备选：A1：用户查看 BoardX 官方精选项目，系统突出官方或 featured 标识。；A<br/>2：用户查看自己创建的项目，系统展示编辑、发布或分享管理入口。；A3：用户查看团队已订阅<br/>项目，系统展示使用或取消订阅入口。；A4：列表为空时，系统展示空状态和创建或调整筛选的入<br/>口。；A5：用户点击 Subscribe 菜单时，系统展示已订阅资源列表，而不是 Exp<br/>lore 全量资源。；A6：用户点击 Authorized Agents 时，系统展示已<br/>授权给当前用户管理的资源，并在卡片上显示已授权标识。；A7：用户点击 Shared 时，<br/>系统展示与管理分享相关的资源，并在卡片上显示 shared 标识。"}
    D1S12 --> D1Alt
    D1Err{"异常：E1：列表加载失败，系统提示稍后重试，并提供重试入口。；E2：项目不存在或不可访问，系统<br/>提示不可访问并返回列表。；E3：团队上下文加载失败，系统提示切换或刷新团队。"}
    D1S12 --> D1Err
    D1Perm["权限/可见性：1. 普通用户和 Team 成员可以浏览、订阅和使用自己可见的项目。；2. AI Sto<br/>re 创作者可以看到自己创建项目的编辑、发布、删除或管理分享入口。；3. Team Ad<br/>min 可以看到团队审核和团队订阅相关入口。；4. BoardX Admin 可以看到平<br/>台审核和精选管理入口。"]
    D1S12 --> D1Perm
  end
  subgraph D2G["创建或更新 AI Store 项目"]
    D2Start["Actor：AI Store 创作者、Team Admin、BoardX Adm<br/>in、AI 服务"]
    D2Entry["可见入口/区域：AI Store 页面 > Create；AI Store 创建页 > 项目类型选择<br/>；Agent 创建器 > 配置表单；Agent 创建器 > 智能体创建助手；Agen<br/>t 创建器 > 预览区域；Tool、Image Tool 或 Template 创建<br/>器 > 配置表单"]
    D2Start --> D2Entry
    D2S1["1. 创作者点击左侧 Creation 分组中的 Create，或从自己有权管理的资源卡<br/>片点击编辑。"]
    D2Entry --> D2S1
    D2S2["2. 系统展示搜索框、Agent / AI Tool / Image Tool / Te<br/>mplate 类型 Tab、Team Publish Status 和 System P<br/>ublish Status 筛选、资源卡片列表，以及“创建”按钮。"]
    D2S1 --> D2S2
    D2S3["3. 用户选择 Agent、AI Tool、Image Tool 或 Template <br/>类型，系统刷新列表和创建按钮对应的资源类型。"]
    D2S2 --> D2S3
    D2S4["4. 用户点击“创建”时，系统按当前类型打开对应创建器；从卡片点击编辑时，系统打开对应编<br/>辑器并预填当前资源信息。"]
    D2S3 --> D2S4
    D2S5["5. 创建或编辑器展示该类型需要填写的名称、描述、图标、标签、提示词、工具参数、模板内容<br/>、输出格式等配置项；具体字段随类型变化。"]
    D2S4 --> D2S5
    D2S6["6. 用户填写或修改配置，并可上传图标、背景图、文件或模板相关内容。"]
    D2S5 --> D2S6
    D2S7["7. 系统在表单中校验必填字段和格式；校验失败时展示字段错误。"]
    D2S6 --> D2S7
    D2S8["8. 用户点击保存、更新、发布或提交审核等当前可见操作。"]
    D2S7 --> D2S8
    D2S9["9. 系统提交保存请求，并在成功后展示保存成功、更新成功、提交成功等反馈；失败时展示失败<br/>反馈。"]
    D2S8 --> D2S9
    D2S10["10. 返回资源列表后，系统按当前类型、筛选和权限展示更新后的资源。"]
    D2S9 --> D2S10
    D2S11["11. 用户进入 Authorized Agents 时，系统展示被授权管理的资源；卡片<br/>显示已授权标识，并只允许在授权范围内编辑或管理。"]
    D2S10 --> D2S11
    D2S12["12. 用户进入 Shared 时，系统展示 shared 管理资源；卡片显示 shar<br/>ed 标识，并提供分享管理入口。"]
    D2S11 --> D2S12
    D2Alt{"备选：A1：用户编辑已有项目，系统预填当前项目数据。；A2：用户保存草稿但不发布，项目只在创作<br/>者管理范围可见。；A3：用户复制已有模板创建，系统带入模板内容并允许修改。；A4：管理员<br/>编辑团队或平台项目，系统展示审核、精选或下架相关操作。；A5：用户在 Create 页面<br/>按团队发布状态或系统发布状态筛选，系统只更新列表，不修改资源状态。；A6：当前列表为空且<br/>无筛选条件时，系统展示创建第一个资源的入口。"}
    D2S12 --> D2Alt
    D2Err{"异常：E1：必填字段缺失，系统在对应字段显示错误提示。；E2：项目名称或标识冲突，系统提示修改<br/>。；E3：用户无权编辑该项目，系统禁止进入编辑或保存。；E4：保存失败，系统保留表单内容<br/>并提示重试。；E5：发布校验失败，系统提示未满足发布条件。"}
    D2S12 --> D2Err
    D2Perm["权限/可见性：1. 创作者只能编辑自己创建或被授权管理的项目。；2. Team Admin 可以管理团<br/>队范围内的项目。；3. BoardX Admin 可以管理平台级项目。；4. 普通订阅用<br/>户不能编辑项目定义。；5. AI 服务不决定项目是否发布或可见，只按已保存配置执行。"]
    D2S12 --> D2Perm
  end
  subgraph D3G["订阅并使用 AI Store 项目"]
    D3Start["Actor：普通用户、Team 成员、Team Admin、AI 服务"]
    D3Entry["可见入口/区域：AI Store 页面 > Subscribe；Team 页面 > AI Store<br/> Subscribe；AI Store 项目卡片 > 个人订阅按钮；AI Store<br/> 项目卡片 > 团队订阅按钮；AI Store 项目卡片 > 取消订阅按钮；AI S<br/>tore 项目卡片或详情页 > 使用 Agent、Tool、Image Tool 或<br/> Template"]
    D3Start --> D3Entry
    D3S1["1. 用户打开 AI Store Explore、Subscribe 或资源详情。"]
    D3Entry --> D3S1
    D3S2["2. 系统在资源卡片上展示资源名称、描述、标签、浏览量、喜欢数和当前可用操作；详情弹窗中<br/>也展示当前角色可用操作。"]
    D3S1 --> D3S2
    D3S3["3. 对已通过团队或 BoardX 审核的资源，普通用户可看到个人订阅按钮；团队管理员可<br/>看到团队订阅或取消订阅按钮。"]
    D3S2 --> D3S3
    D3S4["4. 用户点击订阅按钮，系统提交订阅状态变更，并在操作期间保持卡片可见。"]
    D3S3 --> D3S4
    D3S5["5. 操作成功后，系统更新订阅状态和可用按钮；失败时展示错误反馈并保留原状态。"]
    D3S4 --> D3S5
    D3S6["6. 用户点击左侧 Subscribe，系统展示已订阅资源列表。"]
    D3S5 --> D3S6
    D3S7["7. 已订阅资源卡片展示使用入口或取消订阅入口。"]
    D3S6 --> D3S7
    D3S8["8. 用户点击取消订阅，系统提交取消订阅；成功后资源从订阅列表移除或按钮状态更新，失败时<br/>保留原订阅状态。"]
    D3S7 --> D3S8
    D3S9["9. 用户点击使用 Agent、使用 AI Tool、使用 Image Tool 或使用<br/> Template。"]
    D3S8 --> D3S9
    D3S10["10. 系统按资源类型进入 AVA、工具执行、模板选择或相关使用入口，并带入当前资源配置<br/>。"]
    D3S9 --> D3S10
    D3S11["11. 用户在目标入口输入需求或选择上下文。"]
    D3S10 --> D3S11
    D3S12["12. AI 服务按资源配置、当前用户权限和团队上下文执行，并把结果返回到聊天、Boar<br/>d 或模板入口。"]
    D3S11 --> D3S12
    D3Alt{"备选：A1：Team Admin 为团队订阅项目，团队成员随后可在团队上下文中使用。；A2：用<br/>户已经订阅，系统展示取消订阅或直接使用入口。；A3：项目需要审核或授权，系统展示申请或等<br/>待状态。；A4：资源未通过 Team 或 BoardX 审核时，系统不展示订阅入口。；A<br/>5：Featured 资源可以显示 Featured 标识，但精选状态不等于已订阅状态。"}
    D3S12 --> D3Alt
    D3Err{"异常：E1：用户无权订阅该项目，系统提示权限不足。；E2：订阅失败，系统保持未订阅状态并提示重<br/>试。；E3：项目已下架，系统提示不可订阅或不可使用。；E4：跳转目标入口失败，系统保留当<br/>前项目详情并提示重试。"}
    D3S12 --> D3Err
    D3Perm["权限/可见性：1. 普通用户可以订阅个人可见项目。；2. Team Admin 可以执行团队订阅。；3<br/>. 团队成员只能使用团队已授权或自己已订阅的项目。；4. 私有项目只对授权用户或团队可见<br/>。；5. AI 服务只能使用当前用户有权调用的项目配置。"]
    D3S12 --> D3Perm
  end
  subgraph D4G["查看 AI Store 项目收藏/喜欢状态"]
    D4Start["Actor：普通用户、Team 成员"]
    D4Entry["可见入口/区域：AI Store 页面 > Explore；AI Store 项目卡片 > 浏览量、<br/>喜欢数量、收藏状态图标；AI Store 项目详情页 > 项目统计信息"]
    D4Start --> D4Entry
    D4S1["1. 用户打开 AI Store Explore 页面。"]
    D4Entry --> D4S1
    D4S2["2. 系统展示资源卡片列表，每张卡片包含名称、描述、类型标签、浏览量、喜欢数量和心形图标<br/>。"]
    D4S1 --> D4S2
    D4S3["3. 用户查看心形图标和喜欢数量，了解资源当前的喜欢统计。"]
    D4S2 --> D4S3
    D4S4["4. 当前卡片中的喜欢/收藏切换为只读展示，不能把点击心形写成已确认的收藏成功流程。"]
    D4S3 --> D4S4
    D4S5["5. 用户点击卡片主体时，系统打开资源详情弹窗。"]
    D4S4 --> D4S5
    D4S6["6. 用户可在详情中继续查看说明，并按当前角色使用订阅、快速使用、编辑或分享管理等其它操<br/>作。"]
    D4S5 --> D4S6
    D4S7["7. 用户返回列表后，系统保持当前搜索、类型和标签筛选状态。"]
    D4S6 --> D4S7
    D4Alt{"备选：A1：项目没有喜欢数量时，系统展示 0 或默认统计值。；A2：项目已收藏/喜欢时，系统用<br/>已激活的心形图标展示状态。；A3：项目未收藏/喜欢时，系统用未激活的心形图标展示状态。"}
    D4S7 --> D4Alt
    D4Err{"异常：E1：项目统计加载失败，系统仍展示项目基础信息，并将统计区域显示为空值、0 或加载失败状<br/>态。；E2：项目已不可访问，系统提示项目不存在或无权限。；E3：用户未登录访问受保护 A<br/>I Store 页面，系统引导登录。"}
    D4S7 --> D4Err
    D4Perm["权限/可见性：1. 用户只能查看自己可见项目的统计和状态。；2. AI Store Explore 卡<br/>片中的收藏/喜欢图标是状态展示，不作为卡片内直接切换收藏的操作入口。；3. 管理员精选、<br/>项目 likes/views、用户收藏和用户订阅是不同状态。"]
    D4S7 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["管理 AI Store 项目分享"]
    D5Start["Actor：AI Store 创作者、被授权协作者、BoardX Admin"]
    D5Entry["可见入口/区域：AI Store 我的项目 > 项目卡片；AI Store 项目卡片 > 分享管理按<br/>钮；AI Store 项目卡片 > shared 或 已授权标识；分享管理弹窗 > <br/>复制授权链接；分享管理弹窗 > 关闭分享链接；分享管理弹窗 > 已授权用户列表"]
    D5Start --> D5Entry
    D5S1["1. 用户打开 AI Store 左侧 Creation 分组中的 Create 页面，<br/>并查看自己拥有且可管理的 Agent、AI Tool 或 Image Tool 卡片。"]
    D5Entry --> D5S1
    D5S2["2. 系统在符合条件的资源卡片操作区展示分享管理入口；不符合分享管理条件的资源不展示该入<br/>口。"]
    D5S1 --> D5S2
    D5S3["3. 资源拥有者点击分享入口。"]
    D5S2 --> D5S3
    D5S4["4. 系统生成管理授权链接，复制到剪贴板，并提示“管理授权链接已复制”或“分享已重新开启<br/>”。"]
    D5S3 --> D5S4
    D5S5["5. 被授权协作者打开授权链接后，可在 Authorized Agents 或授权视图中<br/>看到该资源，并在卡片上看到已授权标识。"]
    D5S4 --> D5S5
    D5S6["6. 用户点击左侧 Shared，系统展示与分享管理相关的资源；卡片显示 shared <br/>标识。"]
    D5S5 --> D5S6
    D5S7["7. 协作者或拥有者在 shared 管理项中点击管理分享入口时，系统打开管理分享弹窗。"]
    D5S6 --> D5S7
    D5S8["8. 弹窗展示复制授权链接、关闭分享链接和已授权用户列表。"]
    D5S7 --> D5S8
    D5S9["9. 用户点击复制授权链接时，系统重新复制当前授权链接并展示成功提示。"]
    D5S8 --> D5S9
    D5S10["10. 用户点击关闭分享链接时，系统使当前授权链接失效并展示关闭成功提示。"]
    D5S9 --> D5S10
    D5S11["11. 用户移除某个授权用户时，系统提交移除请求，成功后刷新授权用户列表并提示已移除授权<br/>。"]
    D5S10 --> D5S11
    D5Alt{"备选：A1：项目已开启分享，系统复制当前有效授权链接。；A2：分享链接已关闭后，项目拥有者重新<br/>复制时系统重新开启并生成可用链接。；A3：授权用户列表为空时，系统展示无已授权用户的状态<br/>。"}
    D5S11 --> D5Alt
    D5Err{"异常：E1：用户无分享管理权限，系统隐藏入口或提示无权限。；E2：生成分享链接失败，系统提示重<br/>试。；E3：分享链接无效或项目已下架，访问者看到不可访问提示。"}
    D5S11 --> D5Err
    D5Perm["权限/可见性：1. 只有项目创建者或具备授权管理关系的用户可以看到对应分享管理入口。；2. 被授权协作<br/>者只能在授权范围内管理项目，不能因此获得平台审核或团队审核权限。；3. 私有项目关闭分享<br/>后，旧链接不能继续访问。"]
    D5S11 --> D5Perm
  end
  subgraph D6G["审核和精选 AI Store 项目"]
    D6Start["Actor：Team Admin、BoardX Admin、AI Store 创<br/>作者"]
    D6Entry["可见入口/区域：Admin Panel > AI Store Approval；Admin Pane<br/>l > AI Store Featured；Team 管理页面 > AI Store<br/> Approval；AI Store 审核列表 > 项目卡片；AI Store 审核<br/>列表 > 通过或撤回审核按钮；AI Store 精选列表 > 精选或取消精选按钮"]
    D6Start --> D6Entry
    D6S1["1. 管理员打开 AI Store 审核或精选相关页面。"]
    D6Entry --> D6S1
    D6S2["2. 系统展示资源列表、搜索框、类型 Tab、标签筛选和资源卡片。"]
    D6S1 --> D6S2
    D6S3["3. 管理员点击资源卡片查看详情，系统展示名称、描述、提示词或说明等可见信息。"]
    D6S2 --> D6S3
    D6S4["4. 在 BoardX 管理员审核场景，系统在资源卡片操作区展示审核按钮。"]
    D6S3 --> D6S4
    D6S5["5. 管理员点击审核按钮，系统打开确认弹窗，展示资源名称、描述和提示词等信息。"]
    D6S4 --> D6S5
    D6S6["6. 管理员确认后，系统把 BoardX 审核状态在 APPROVED 和 PENDIN<br/>G 之间切换。"]
    D6S5 --> D6S6
    D6S7["7. 在团队管理员审核场景，系统展示团队审核操作，并按团队资源状态切换审核结果。"]
    D6S6 --> D6S7
    D6S8["8. 管理员在精选页面或可精选资源卡片上点击精选按钮。"]
    D6S7 --> D6S8
    D6S9["9. 系统切换资源的 featured 状态。"]
    D6S8 --> D6S9
    D6S10["10. 更新后，系统在资源卡片上通过 featured 标识反映当前精选状态；失败时保留<br/>原状态并记录错误。"]
    D6S9 --> D6S10
    D6Alt{"备选：A1：Team Admin 只审核团队范围项目。；A2：BoardX Admin 审核平<br/>台项目，并可设置官方精选。；A3：管理员批量查看不同状态项目，如待审核、已通过、已拒绝。"}
    D6S10 --> D6Alt
    D6Err{"异常：E1：管理员无权限访问审核页，系统提示无权限。；E2：项目状态已被其他管理员修改，系统刷<br/>新并提示状态变化。；E3：审核操作失败，系统保留原状态并提示重试。；E4：项目缺少名称、<br/>描述或说明时，管理员只能基于当前可见信息判断，不在文档中假定额外审核材料。"}
    D6S10 --> D6Err
    D6Perm["权限/可见性：1. Team Admin 只能管理自己团队范围内的审核。；2. BoardX Admi<br/>n 可以管理平台级审核和精选。；3. 普通用户不能访问审核和精选操作。；4. 创建者只能<br/>查看自己的提交状态，不能自审平台项目。"]
    D6S10 --> D6Perm
  end
```

