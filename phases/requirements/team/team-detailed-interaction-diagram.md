# Team 详细交互图

本图按 Team 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  AppShell["登录后应用壳加载 Team 数据"] --> HasTeam{"是否已有 Team"}
  HasTeam -->|否| ForceCreate["自动打开创建 Team 弹窗"]
  ForceCreate --> CreateName["输入 Team 名称"]
  CreateName --> SubmitCreate["点击创建或按 Enter"]
  SubmitCreate --> CreateOk["创建成功，当前用户成为 Team Owner"]
  SubmitCreate --> CreateFail["名称为空或创建失败，弹窗保留"]
  CreateOk --> TeamHome["进入 Team Home 或当前默认工作区"]
  HasTeam -->|是| TeamHome
  TeamHome --> Dashboard["查看统计、成员、AI 工具、待处理和 Token 数据"]
  Dashboard --> General["Team General"]
  Dashboard --> Members["Team Member"]
  Dashboard --> Credits["Team Credits"]
  Dashboard --> Memory["Team Memory"]
  Dashboard --> Knowledge["Team Knowledge Base"]
  Dashboard --> Store["Team AI Store"]
  Dashboard --> Surveys["Team Surveys"]

  General --> EditTeam["修改团队名称或基础设置"]
  EditTeam --> TeamSaved["显示保存成功或失败"]
  General --> DeleteTeam["删除团队"]
  DeleteTeam --> DeleteConfirm["确认后删除或取消"]

  Members --> Invite["邀请成员"]
  Invite --> InviteResult["生成邀请或显示失败"]
  Members --> Role["修改角色 / Token 权限"]
  Role --> RoleResult["成员列表和权限状态更新"]
  Members --> Remove["移除成员"]
  Remove --> RemoveResult["成员从列表移除或 owner 保护提示"]

  Credits --> Purchase["购买 Credit"]
  Purchase --> Payment["打开支付二维码"]
  Credits --> Records["查看 Credit 记录"]

  Memory --> AddMemory["添加 Memory"]
  AddMemory --> MemoryList["列表刷新"]
  Memory --> DeleteMemory["删除 Memory"]

  Knowledge --> Upload["上传文件"]
  Upload --> FileStatus["显示上传、处理、完成或失败状态"]

  Store --> StoreExplore["探索 / 订阅 / 审核团队 AI Store"]
  Surveys --> SurveyManage["创建、发布、下线、查看报告"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["创建团队"]
    D1Start["Actor：已登录用户"]
    D1Entry["可见入口/区域：左侧团队头像菜单中的 Create Team。；用户没有任何团队时自动出现的创建团队<br/>弹窗。"]
    D1Start --> D1Entry
    D1S1["1. 用户打开团队头像菜单，看到当前团队、自己的团队角色、Manage Team、Tea<br/>m Knowledge Base、Create Team 以及团队列表。"]
    D1Entry --> D1S1
    D1S2["2. 用户点击 Create Team，系统打开创建团队弹窗。"]
    D1S1 --> D1S2
    D1S3["3. 弹窗中展示团队名称输入框和创建按钮；如果用户尚无任何团队，系统不允许直接关闭该弹窗<br/>。"]
    D1S2 --> D1S3
    D1S4["4. 用户输入团队名称，可以按 Enter 或点击创建按钮提交。"]
    D1S3 --> D1S4
    D1S5["5. 系统检查团队名称不能为空。"]
    D1S4 --> D1S5
    D1S6["6. 系统创建团队，创建期间按钮显示创建中状态并避免重复提交。"]
    D1S5 --> D1S6
    D1S7["7. 创建成功后，系统提示团队创建成功，把新团队保存为当前团队，并刷新团队列表。"]
    D1S6 --> D1S7
    D1S8["8. 系统清理与旧团队相关的 AVA 会话状态，并保持应用处于新团队上下文。"]
    D1S7 --> D1S8
    D1S9["9. 用户再次打开团队菜单时，可以看到新团队出现在团队列表中。"]
    D1S8 --> D1S9
    D1Alt{"备选：A1：用户已有团队时，可以取消创建并回到当前团队。；A2：用户没有任何团队时，关闭弹窗不<br/>会生效，用户需要先创建团队。"}
    D1S9 --> D1Alt
    D1Err{"异常：E1：团队名称为空，系统提示团队名称为空，弹窗保持打开。；E2：创建失败，系统提示创建团<br/>队失败，弹窗保留用户输入。"}
    D1S9 --> D1Err
    D1Perm["权限/可见性：- 创建者成为该团队的 owner。；- owner/admin 进入团队菜单时可以使用<br/> Manage Team。；- member 点击 Manage Team 时，系统提示<br/>其没有权限进入团队管理面板。；- 未登录用户不能创建团队；需要先完成登录。"]
    D1S9 --> D1Perm
  end
  subgraph D2G["查看并切换团队"]
    D2Start["Actor：已加入至少一个团队的用户"]
    D2Entry["可见入口/区域：左侧团队头像菜单。"]
    D2Start --> D2Entry
    D2S1["1. 用户点击团队头像按钮，系统展开团队菜单。"]
    D2Entry --> D2S1
    D2S2["2. 菜单顶部展示当前团队名称、团队头像或首字母、当前用户在团队中的角色，以及团队类型标<br/>识 Personal 或 Enterprise。"]
    D2S1 --> D2S2
    D2S3["3. 菜单中展示 Manage Team、Team Knowledge Base、Cre<br/>ate Team，以及 Team List。"]
    D2S2 --> D2S3
    D2S4["4. 用户在 Team List 中看到每个团队的名称、头像/首字母和团队类型；当前团队<br/>用选中样式标记。"]
    D2S3 --> D2S4
    D2S5["5. 用户点击另一个团队，系统显示加载状态并关闭菜单。"]
    D2S4 --> D2S5
    D2S6["6. 系统把该团队保存为当前团队，清理旧团队的 AVA 会话状态，加载新团队信息。"]
    D2S5 --> D2S6
    D2S7["7. 切换完成后，系统进入 Home 页面。"]
    D2S6 --> D2S7
    D2S8["8. 后续房间、成员、知识库、AI Store 等内容均以新团队为上下文。"]
    D2S7 --> D2S8
    D2Alt{"备选：A1：用户点击当前团队，系统不重复切换。；A2：用户点击 Create Team，进入创<br/>建团队流程。；A3：用户点击 Team Knowledge Base，进入当前团队知识库<br/>。"}
    D2S8 --> D2Alt
    D2Err{"异常：E1：团队列表为空，菜单展示 noTeamsFound，并允许用户创建团队。；E2：切换<br/>失败，系统提示 errorSwitchingTeam。"}
    D2S8 --> D2Err
    D2Perm["权限/可见性：- owner/admin 可以从菜单进入 Manage Team。；- member <br/>可以切换自己已加入的团队，但进入 Manage Team 时会看到无权限提示。；- 未加<br/>入任何团队的已登录用户不会看到可切换团队列表；未登录用户需要先登录。"]
    D2S8 --> D2Perm
  end
  subgraph D3G["邀请团队成员"]
    D3Start["Actor：团队 owner、团队 admin"]
    D3Entry["可见入口/区域：Team 管理页的 Members 页面。"]
    D3Start --> D3Entry
    D3S1["1. 用户进入 Members 页面，看到邀请输入区域、Invite 按钮、Copy I<br/>nvitation Link 按钮，以及当前成员列表。"]
    D3Entry --> D3S1
    D3S2["2. 用户在邀请输入框中输入邮箱地址。"]
    D3S1 --> D3S2
    D3S3["3. 用户按 Enter 或逗号，系统校验邮箱格式；格式正确时把该邮箱显示为可移除的标签<br/>。"]
    D3S2 --> D3S3
    D3S4["4. 用户可继续输入多个邮箱，也可以点击标签上的关闭图标移除某个邮箱。"]
    D3S3 --> D3S4
    D3S5["5. 用户点击 Invite，系统逐个处理邀请列表。"]
    D3S4 --> D3S5
    D3S6["6. 如果邮箱对应已注册用户且该用户不在团队中，系统把用户加入团队并赋予 member <br/>角色。"]
    D3S5 --> D3S6
    D3S7["7. 如果邮箱尚未注册，系统按邀请流程处理该邮箱，并在界面显示邀请发送结果。"]
    D3S6 --> D3S7
    D3S8["8. 用户点击 Copy Invitation Link，系统复制当前团队邀请链接，并提<br/>示已复制。"]
    D3S7 --> D3S8
    D3Alt{"备选：A1：用户只复制邀请链接，不输入邮箱。；A2：用户在发送前移除某个邮箱标签。；A3：用户<br/>一次输入多个邮箱并一起邀请。"}
    D3S8 --> D3Alt
    D3Err{"异常：E1：邮箱为空，系统提示请输入邮箱地址。；E2：邮箱格式无效，系统提示 invalidE<br/>mail。；E3：用户已在团队中，系统提示 userAlreadyInTeam。；E4：<br/>邀请链接复制失败，系统提示 copyFailed。"}
    D3S8 --> D3Err
    D3Perm["权限/可见性：- owner/admin 是当前可进入成员管理并发起邀请的角色。；- 新加入用户默认为<br/> member。；- member 不能从团队菜单进入团队管理，因此通常无法到达该邀请入<br/>口。；- visitor/未加入团队的用户不能进入 Members 页面，也不能发起团队<br/>邀请。"]
    D3S8 --> D3Perm
  end
  subgraph D4G["通过邀请链接加入团队"]
    D4Start["Actor：受邀用户"]
    D4Entry["可见入口/区域：团队邀请链接页面。"]
    D4Start --> D4Entry
    D4S1["1. 用户打开邀请链接，页面显示加载状态。"]
    D4Entry --> D4S1
    D4S2["2. 系统校验邀请链接，并在处理期间显示加载反馈。"]
    D4S1 --> D4S2
    D4S3["3. 如果用户已登录，系统使用该邀请，把用户加入邀请对应的团队。"]
    D4S2 --> D4S3
    D4S4["4. 系统记录用户来自邀请流程，避免随后的团队加载阶段误弹创建团队弹窗。"]
    D4S3 --> D4S4
    D4S5["5. 系统切换当前团队，把邀请对应团队设置为当前团队。"]
    D4S4 --> D4S5
    D4S6["6. 系统进入该团队的 recent rooms 页面并显示页面加载状态。"]
    D4S5 --> D4S6
    D4S7["7. 用户在 recent rooms 页面看到当前团队上下文、房间列表、空状态或可继续<br/>访问的房间入口。"]
    D4S6 --> D4S7
    D4S8["8. 用户点击房间卡片时，系统打开该房间；用户点击团队菜单时，系统按 Team Memb<br/>er 权限展示允许的入口。"]
    D4S7 --> D4S8
    D4Alt{"备选：A1：用户尚未登录，系统把邀请标记为待处理，并跳转到注册页。；A2：用户注册或登录完成后<br/>回到邀请链接，系统再次处理邀请。"}
    D4S8 --> D4Alt
    D4Err{"异常：E1：邀请无效或处理失败，用户不会被加入团队，并看到失败状态或停留在邀请处理页。；E2：<br/>登录后处理失败时，系统会进行有限重试；仍失败时保留失败状态。"}
    D4S8 --> D4Err
    D4Perm["权限/可见性：- 受邀加入团队的用户按当前邀请处理逻辑成为团队成员。；- 邀请链接页面不提供选择 ad<br/>min 或 owner 的入口。；- owner/admin 可在成员管理中后续调整成员<br/>角色。；- visitor/未登录用户打开邀请链接时会先进入登录或注册路径，完成后再处理<br/>邀请。"]
    D4S8 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["管理团队成员"]
    D5Start["Actor：团队 owner、团队 admin"]
    D5Entry["可见入口/区域：Team 管理页的 Members 页面。"]
    D5Start --> D5Entry
    D5S1["1. 用户进入 Members 页面，系统展示成员表格。"]
    D5Entry --> D5S1
    D5S2["2. 表格展示成员姓名/头像、邮箱、角色、token 用量、token 权限开关和操作菜<br/>单。"]
    D5S1 --> D5S2
    D5S3["3. 用户点击成员姓名，系统打开该成员 token 用量详情弹窗。"]
    D5S2 --> D5S3
    D5S4["4. 详情弹窗展示总 token、prompt token、completion tok<br/>en、调用次数，以及按时间列出的模型、方法、客户端、状态和摘要。"]
    D5S3 --> D5S4
    D5S5["5. 用户切换 token 权限开关，系统更新该成员是否可使用团队 token，并显示启<br/>用或禁用成功提示。"]
    D5S4 --> D5S5
    D5S6["6. 用户打开成员操作菜单，可以把 member 设为 admin，把 admin 设为<br/> member，或移除成员。"]
    D5S5 --> D5S6
    D5S7["7. 系统更新成员列表；被调整的成员下一次进入团队相关功能时按新角色生效。"]
    D5S6 --> D5S7
    D5Alt{"备选：A1：用户只查看成员列表，不做变更。；A2：用户打开用量详情后关闭弹窗，成员状态不变。"}
    D5S7 --> D5Alt
    D5Err{"异常：E1：尝试把 owner 改为 admin/member，系统提示 ownerNotRo<br/>leChange。；E2：尝试移除 owner，系统提示 ownerNotRemovab<br/>leTeam。；E3：尝试把已是 admin 的成员设为 admin，系统提示 alre<br/>adyAnAdmin。；E4：尝试把已是 member 的成员设为 member，系统提<br/>示 alreadyAmember。；E5：token 权限更新失败，系统提示更新失败。"}
    D5S7 --> D5Err
    D5Perm["权限/可见性：- owner 不能被降级，也不能被移除。；- admin 可以被设回 member，也<br/>可以被移除。；- member 可以被设为 admin，也可以被移除。；- visito<br/>r/未加入团队的用户看不到团队成员管理页面。"]
    D5S7 --> D5Perm
  end
  subgraph D6G["更新或删除团队"]
    D6Start["Actor：团队 owner、团队 admin"]
    D6Entry["可见入口/区域：Team 管理页的 General 页面。"]
    D6Start --> D6Entry
    D6S1["1. 用户进入 General 页面，看到团队头像上传区、团队名称输入框、Update <br/>按钮，以及 Danger Zone。"]
    D6Entry --> D6S1
    D6S2["2. 用户拖入或点击选择图片文件，系统上传并更新团队头像；成功后展示新头像并提示上传成功<br/>。"]
    D6S1 --> D6S2
    D6S3["3. 如果已有头像，用户可点击头像上的删除按钮移除头像；系统成功后展示头像已移除提示。"]
    D6S2 --> D6S3
    D6S4["4. 用户修改团队名称并点击 Update。"]
    D6S3 --> D6S4
    D6S5["5. 系统检查名称不能为空；通过后更新团队名称，并提示 teamUpdated。"]
    D6S4 --> D6S5
    D6S6["6. 用户在 Danger Zone 点击 Delete Team。"]
    D6S5 --> D6S6
    D6S7["7. 系统打开确认弹窗，提示删除风险，并要求用户输入团队名称。"]
    D6S6 --> D6S7
    D6S8["8. 用户输入与当前团队名称完全一致的文本。"]
    D6S7 --> D6S8
    D6S9["9. 用户点击 Delete Team，系统删除团队，清除本地当前团队信息，并返回应用首<br/>页。"]
    D6S8 --> D6S9
    D6Alt{"备选：A1：用户只更新头像，不修改团队名称。；A2：用户打开删除确认后点击取消，团队不被删除。<br/>；A3：用户移除头像后继续保留团队名称。"}
    D6S9 --> D6Alt
    D6Err{"异常：E1：团队名称为空，系统提示 teamNameEmpty。；E2：更新失败，系统提示 u<br/>pdateFailed。；E3：删除确认名称不匹配，系统提示 teamNameNotMa<br/>tch。；E4：删除失败，系统提示 deleteFailed。"}
    D6S9 --> D6Err
    D6Perm["权限/可见性：- owner/admin 可以从团队菜单进入管理页。；- member 点击 Mana<br/>ge Team 时收到无权限提示，通常无法进入 General 页面。；- visito<br/>r/未加入团队的用户不能进入团队 General 页面。"]
    D6S9 --> D6Perm
  end
  subgraph D7G["管理团队通用设置"]
    D7Start["Actor：团队 owner、团队 admin"]
    D7Entry["可见入口/区域：团队头像菜单中的 Manage Team。"]
    D7Start --> D7Entry
    D7S1["1. 用户点击团队菜单中的 Manage Team。"]
    D7Entry --> D7S1
    D7S2["2. 系统进入 Team 管理页，左侧展示 Team Management 标题、团队类<br/>型标识，以及分组菜单。"]
    D7S1 --> D7S2
    D7S3["3. Management 分组展示 Home、General，若启用积分计费且用户为 <br/>owner/admin，还展示 Credits。"]
    D7S2 --> D7S3
    D7S4["4. People 分组展示 Members。"]
    D7S3 --> D7S4
    D7S5["5. Knowledge 分组展示 Memory 和 Knowledge Base。"]
    D7S4 --> D7S5
    D7S6["6. AI Store 分组展示 Store Explore、Store Subscri<br/>be、Store Approval。"]
    D7S5 --> D7S6
    D7S7["7. 用户点击任一菜单项，系统高亮当前项并进入对应页面。"]
    D7S6 --> D7S7
    D7Alt{"备选：A1：用户点击当前所在菜单项，系统不重复跳转。；A2：移动设备上，系统以适配移动端的导航<br/>方式展示管理菜单。"}
    D7S7 --> D7Alt
    D7Err{"异常：E1：页面跳转过程中，菜单项显示加载态，避免重复点击导致多次跳转。"}
    D7S7 --> D7Err
    D7Perm["权限/可见性：- owner/admin 可以进入 Team 管理页并看到上述管理导航。；- memb<br/>er 从团队菜单点击 Manage Team 时收到无权限提示，不能进入该管理入口。；-<br/> visitor/未加入团队的用户看不到 Team 管理导航。"]
    D7S7 --> D7Perm
  end
  subgraph D8G["查看团队 Home"]
    D8Start["Actor：团队 owner、团队 admin"]
    D8Entry["可见入口/区域：Team 管理页左侧菜单中的 Home。"]
    D8Start --> D8Entry
    D8S1["1. 用户在团队菜单点击 Manage Team，或在 Team 管理页左侧点击 Hom<br/>e。"]
    D8Entry --> D8S1
    D8S2["2. 系统展示团队管理框架，左侧为 Team Management 导航。"]
    D8S1 --> D8S2
    D8S3["3. Home 区域展示 Dashboard 标题、说明文字，以及团队统计卡片。"]
    D8S2 --> D8S3
    D8S4["4. 用户看到 Active Members、AI Tools、Pending Revi<br/>ews、Total Tokens；数据加载中时数字位置显示省略状态。"]
    D8S3 --> D8S4
    D8S5["5. 用户看到管理入口卡片：General、Members、Memory、Store E<br/>xplore、Store Subscribe、Store Approval；启用积分计费<br/>且用户为 owner/admin 时还看到 Credits。"]
    D8S4 --> D8S5
    D8S6["6. 用户点击任一入口卡片，系统保持当前团队上下文并进入对应页面。"]
    D8S5 --> D8S6
    D8S7["7. 页面底部展示快速入口，用户可以直接进入团队设置或成员管理。"]
    D8S6 --> D8S7
    D8S8["8. 如果用户切换到另一个团队后再次进入 Team Home，系统刷新为新团队的统计和入<br/>口上下文。"]
    D8S7 --> D8S8
    D8Alt{"备选：A1：用户从其他团队管理页面点击 Home，系统返回 Team Home。"}
    D8S8 --> D8Alt
    D8Err{"异常：E1：如果当前团队尚未加载，页面依赖全局团队加载流程；当前用例不假设具体空态文案。"}
    D8S8 --> D8Err
    D8Perm["权限/可见性：- owner/admin 可以进入 Home。；- member 无法通过团队菜单进入<br/> Team 管理 Home。；- visitor/未加入团队的用户不能进入 Team H<br/>ome。"]
    D8S8 --> D8Perm
  end
```

```mermaid
flowchart TD
  subgraph D9G["管理团队 Memory"]
    D9Start["Actor：团队 owner、团队 admin"]
    D9Entry["可见入口/区域：Team 管理页左侧菜单中的 Memory。"]
    D9Start --> D9Entry
    D9S1["1. 用户在 Team 管理页左侧点击 Memory。"]
    D9Entry --> D9S1
    D9S2["2. 系统进入当前团队的 Memory 页面，并保持 Team 管理页导航可见。"]
    D9S1 --> D9S2
    D9S3["3. 系统展示团队 Memory 列表、搜索输入、新增 Memory 输入区和新增按钮；<br/>加载时先展示占位状态。"]
    D9S2 --> D9S3
    D9S4["4. 用户可以输入关键字搜索，系统只显示匹配的 Memory，并保留总数和过滤结果状态。"]
    D9S3 --> D9S4
    D9S5["5. 用户在新增输入区输入内容，可以按 Enter 或点击新增按钮保存；Shift+En<br/>ter 用于在输入中换行。"]
    D9S4 --> D9S5
    D9S6["6. 如果内容为空，系统不新增；如果内容已存在，系统提示已存在。"]
    D9S5 --> D9S6
    D9S7["7. 新增成功后，系统把 Memory 加入列表并显示成功提示。"]
    D9S6 --> D9S7
    D9S8["8. 用户点击某条 Memory 的删除入口，系统打开确认弹窗。"]
    D9S7 --> D9S8
    D9S9["9. 用户确认删除后，系统从列表移除该 Memory 并显示删除成功提示。"]
    D9S8 --> D9S9
    D9S10["10. 保存失败时，系统回退本次新增或删除，并提示保存失败。"]
    D9S9 --> D9S10
    D9Alt{"备选：A1：用户只查看 Memory 内容，不做修改。；A2：用户从 Memory 切换到其他<br/>团队管理页面。"}
    D9S10 --> D9Alt
    D9Err{"异常：E1：如果团队信息缺失，页面无法准确关联当前团队。"}
    D9S10 --> D9Err
    D9Perm["权限/可见性：- owner/admin 可以通过 Team 管理页进入 Memory。；- memb<br/>er 不能通过 Manage Team 入口进入该页面；本用例不授予 member 管理<br/>团队 Memory 的能力。；- visitor/未加入团队的用户不能进入团队 Memo<br/>ry 页面。"]
    D9S10 --> D9Perm
  end
  subgraph D10G["查看团队 AI Store"]
    D10Start["Actor：团队 owner、团队 admin"]
    D10Entry["可见入口/区域：Team 管理页左侧 AI Store 分组中的 Store Explore、Sto<br/>re Subscribe、Store Approval。"]
    D10Start --> D10Entry
    D10S1["1. 有管理权限的用户进入 Team 管理页，在 AI Store 分组看到 Store<br/> Explore、Store Subscribe、Store Approval。"]
    D10Entry --> D10S1
    D10S2["2. 用户点击 Store Explore，系统进入团队 AI Store 探索页面，并<br/>显示搜索、分类、标签或项目卡片等当前可见浏览入口。"]
    D10S1 --> D10S2
    D10S3["3. 用户在探索页面点击项目卡片，系统展示项目详情、订阅或使用相关操作。"]
    D10S2 --> D10S3
    D10S4["4. 用户点击 Store Subscribe，系统进入团队订阅页面，并展示当前团队已订<br/>阅项目、空状态或加载状态。"]
    D10S3 --> D10S4
    D10S5["5. 用户点击 Store Approval，系统进入团队 AI Store 审批页面，<br/>并展示待审批项目、审批状态或空状态。"]
    D10S4 --> D10S5
    D10S6["6. 用户从任一 AI Store 页面返回 Team 管理菜单时，系统保留当前团队上下<br/>文。"]
    D10S5 --> D10S6
    D10S7["7. 用户切换团队后再次进入 AI Store 分组，系统刷新为新团队的探索、订阅或审批<br/>内容。"]
    D10S6 --> D10S7
    D10Alt{"备选：A1：用户切换团队后再次进入 AI Store，系统展示新团队上下文内容。；A2：用户从<br/> AI Store 页面返回 Team 管理其他页面。"}
    D10S7 --> D10Alt
    D10Err{"异常：E1：当前团队未加载时，页面无法准确展示团队范围内容。"}
    D10S7 --> D10Err
    D10Perm["权限/可见性：- owner/admin 可以从 Team 管理菜单进入 AI Store 分组。；-<br/> member 无法通过 Team 管理菜单进入这些页面；是否可通过顶层 AI Stor<br/>e 页面浏览个人可见内容，不在本用例范围内。；- visitor/未加入团队的用户不能从<br/> Team 管理菜单进入团队 AI Store 页面。"]
    D10S7 --> D10Perm
  end
```

