# Admin 详细交互图

本图按 Admin 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Admin["系统管理员进入 Admin Panel"] --> Home["Admin Home 显示统计和模块入口"]
  Home --> Users["Users"]
  Users --> SearchUser["搜索或筛选用户"]
  SearchUser --> UserTable["用户表格刷新"]
  Users --> CreateUser["创建用户"]
  CreateUser --> CreateResult["创建成功或表单错误"]
  Users --> EditUser["编辑用户"]
  EditUser --> UserSaved["用户信息更新或失败"]
  Home --> Teams["Teams"]
  Teams --> SearchTeam["搜索或筛选 Team"]
  SearchTeam --> TeamTable["Team 表格刷新"]
  Teams --> TeamType["修改团队类型"]
  TeamType --> TeamUpdated["团队状态更新"]
  Teams --> AddCredit["手动增加 Credit"]
  AddCredit --> CreditUpdated["Credit 状态更新"]
  Home --> StoreApproval["AI Store Approval"]
  StoreApproval --> ApprovalGrid["加载 BoardX AI Store 资源网格"]
  ApprovalGrid --> ApprovalSearch["搜索名称或描述"]
  ApprovalSearch --> ApprovalFiltered["资源列表刷新或显示空状态"]
  ApprovalGrid --> ApprovalType["切换 Agent / AI Tool / Image Tool / Template"]
  ApprovalType --> ApprovalFiltered
  ApprovalGrid --> ApprovalTags["点击标签筛选或清除筛选"]
  ApprovalTags --> ApprovalFiltered
  ApprovalGrid --> ApprovalCard["查看资源卡片、标识和操作"]
  ApprovalCard --> ApprovalDetail["点击卡片打开资源详情"]
  ApprovalDetail --> ApprovalDetailState["查看名称、描述、配置、指令或提示词"]
  ApprovalCard --> ApprovalVisible{"是否为 BoardX Resource"}
  ApprovalVisible -->|是| ApprovalAction["显示平台审核按钮"]
  ApprovalVisible -->|否| ApprovalNoAction["不显示平台审核按钮"]
  ApprovalAction --> ApprovalConfirm["打开批准或撤销批准确认弹窗"]
  ApprovalConfirm --> ApprovalCancel["取消后关闭弹窗，状态不变"]
  ApprovalConfirm --> ApprovalSubmit["确认提交审核状态更新"]
  ApprovalSubmit --> ApprovalLoading["按钮显示 loading"]
  ApprovalLoading --> ApprovalUpdated["BoardXApprovalStatus 在 APPROVED / PENDING 间切换"]
  ApprovalLoading --> ApprovalFailed["更新失败，保留原状态"]
  Home --> Featured["AI Store Featured"]
  Featured --> FeaturedGrid["加载已通过平台审核的资源网格"]
  FeaturedGrid --> FeaturedSearch["搜索名称或描述"]
  FeaturedSearch --> FeaturedFiltered["候选列表刷新或显示空状态"]
  FeaturedGrid --> FeaturedType["切换 Agent / AI Tool / Image Tool / Template"]
  FeaturedType --> FeaturedFiltered
  FeaturedGrid --> FeaturedTags["点击标签筛选或清除筛选"]
  FeaturedTags --> FeaturedFiltered
  FeaturedGrid --> FeaturedCard["查看资源卡片和 Featured 标识"]
  FeaturedCard --> FeaturedAllowed{"BoardXApprovalStatus 是否 APPROVED"}
  FeaturedAllowed -->|是| FeatureAction["显示星标按钮"]
  FeaturedAllowed -->|否| FeatureHidden["不显示精选按钮"]
  FeatureAction --> ToggleFeatured["点击星标切换精选或取消精选"]
  ToggleFeatured --> FeaturedUpdated["isFeatured 状态更新，卡片标识刷新"]
  ToggleFeatured --> FeaturedFailed["更新失败，保留原精选状态"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["管理员管理用户"]
    D1Start["Actor：系统管理员"]
    D1Entry["可见入口/区域：Admin Panel 中的 Users 页面。；Users 页面中的 添加用户 /<br/> 创建用户入口。；用户列表中的编辑、删除、复制 ID 和手动上分操作。"]
    D1Start --> D1Entry
    D1S1["1. 系统管理员进入 Users 页面，系统展示用户管理标题、管理系统用户和权限设置说明<br/>、总用户数、普通用户、管理员、已禁用统计卡片、筛选区、用户表格、分页控件和添加用户入口。"]
    D1Entry --> D1S1
    D1S2["2. 管理员可以在搜索框输入邮箱关键字，按管理员或用户角色筛选，并点击查询；系统刷新列表<br/>结果，点击重置后清空筛选条件。"]
    D1S1 --> D1S2
    D1S3["3. 用户表格展示用户、用户 ID、邮箱、角色、积分、加入时间和操作入口；加载中显示加载<br/>中状态，没有数据时显示暂无用户数据。"]
    D1S2 --> D1S3
    D1S4["4. 管理员点击分页上一页或下一页，系统加载对应页码并保持筛选条件。"]
    D1S3 --> D1S4
    D1S5["5. 管理员点击创建用户入口，系统进入创建页，管理员填写用户基础信息、邮箱、角色等字段并<br/>提交。"]
    D1S4 --> D1S5
    D1S6["6. 管理员点击编辑操作，系统进入编辑页，展示该用户当前信息并允许修改。"]
    D1S5 --> D1S6
    D1S7["7. 管理员打开用户操作入口，可以复制用户 ID、进入编辑、手动上分或删除用户；复制成功<br/>或失败时系统显示对应提示。"]
    D1S6 --> D1S7
    D1S8["8. 管理员点击手动上分，系统打开弹窗，展示当前剩余 Credit、增加 Credit <br/>输入框和备注输入框。"]
    D1S7 --> D1S8
    D1S9["9. 管理员输入正数 Credit 和备注并提交；系统展示提交中状态，成功后提示手动上分<br/>成功并关闭弹窗。"]
    D1S8 --> D1S9
    D1S10["10. 管理员删除用户时，系统展示确认对话框；确认后用户被软删除，列表状态更新。"]
    D1S9 --> D1S10
    D1Alt{"备选：A1：管理员创建新用户。；A2：管理员只查看用户信息。"}
    D1S10 --> D1Alt
    D1Err{"异常：E1：非 admin 用户访问，系统拒绝。；E2：用户不存在，系统提示无法操作。；E3：<br/>创建或更新字段无效，系统提示修正。"}
    D1S10 --> D1Err
    D1Perm["权限/可见性：1. 系统管理员可以访问后台管理入口，可以查看、创建、编辑、删除用户，并为用户手动增加 <br/>Credit。；2. 系统普通用户、Team Owner、Team Admin 和 Te<br/>am Member 不因团队角色获得后台用户管理权限；访问时系统拒绝或跳转。；3. Te<br/>am Owner/Admin 只能在 Team 范围管理成员，不能在 Admin Pan<br/>el 管理平台用户。"]
    D1S10 --> D1Perm
  end
  subgraph D2G["管理员管理团队"]
    D2Start["Actor：系统管理员"]
    D2Entry["可见入口/区域：Admin Panel 中的 Teams 页面。；团队名称、用户名、团队类型筛选区。<br/>；团队表格中的编辑和手动上分操作。"]
    D2Start --> D2Entry
    D2S1["1. 系统管理员进入 Teams 页面，系统展示团队管理标题、搜索和管理系统中的团队说明<br/>、团队名称输入框、用户名输入框、团队类型选择、搜索按钮、清除按钮、团队表格和分页控件。"]
    D2Entry --> D2S1
    D2S2["2. 管理员输入团队名称、用户名或选择团队类型后点击搜索；系统在查询中展示搜索中状态，完<br/>成后展示搜索结果或未找到团队的空状态。"]
    D2S1 --> D2S2
    D2S3["3. 管理员点击清除，系统清空搜索条件并回到无筛选的团队列表。"]
    D2S2 --> D2S3
    D2S4["4. 团队表格展示团队、拥有者、成员数、类型、Credit 或使用 Tokens、创建时<br/>间、更新时间和操作按钮。"]
    D2S3 --> D2S4
    D2S5["5. 管理员调整每页数量或点击上一页、下一页、页码按钮；系统加载对应页并保留当前筛选条件<br/>。"]
    D2S4 --> D2S5
    D2S6["6. 管理员点击编辑按钮，系统打开团队编辑弹窗，展示团队名称为只读字段，并允许修改团队类<br/>型。"]
    D2S5 --> D2S6
    D2S7["7. 管理员保存团队类型后，系统展示更新中状态；成功时提示团队更新成功并关闭弹窗，失败时<br/>提示更新失败。"]
    D2S6 --> D2S7
    D2S8["8. 当 Credit 计费启用时，表格展示团队 Credit 余额，并在操作区展示手动<br/>上分按钮。"]
    D2S7 --> D2S8
    D2S9["9. 管理员点击手动上分，系统打开弹窗，展示当前团队 Credit 余额、增加 Cred<br/>it 输入框和备注输入框。"]
    D2S8 --> D2S9
    D2S10["10. 管理员输入正数 Credit 后提交；系统展示上分中状态，成功后提示团队手动上分<br/>成功并关闭弹窗，失败时保留弹窗并展示错误提示。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：管理员只筛选和查看团队。；A2：管理员取消编辑或取消手动上分，系统关闭弹窗且不更新<br/>团队。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：搜索失败，系统展示搜索失败提示。；E2：团队类型更新失败，系统展示失败原因或更新失<br/>败提示。；E3：手动上分金额为空、非数字或小于等于 0，系统展示无效金额提示。；E4：管<br/>理员权限不足，系统拒绝访问后台页面。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：1. 系统管理员可以访问后台团队管理，查询团队，编辑团队类型，并在 Credit 计费启<br/>用时为团队手动上分。；2. Team Owner/Admin 只能管理自己团队范围内的设<br/>置、成员、知识库和积分，不能进入 Admin Panel 查询或修改其他团队。；3. T<br/>eam Member 不能执行后台团队管理或后台手动上分。；4. 非系统管理员访问后台团<br/>队管理时，系统拒绝或跳转。"]
    D2S10 --> D2Perm
  end
  subgraph D3G["管理员审核 AI Store"]
    D3Start["Actor：系统管理员"]
    D3Entry["可见入口/区域：Admin Panel 中的 Store Approval / AI Store A<br/>pproval 页面。；Admin 首页或侧边菜单中的 Store Approval<br/> 入口。"]
    D3Start --> D3Entry
    D3S1["1. 系统管理员进入 AI Store Approval 页面，系统加载 BoardX <br/>Admin 资源管理界面。"]
    D3Entry --> D3S1
    D3S2["2. 页面展示搜索框、结果数量、资源类型 Tab、标签筛选区和资源卡片网格；加载中展示 <br/>loading 状态，加载失败时展示错误和重试入口，没有结果时展示空状态。"]
    D3S1 --> D3S2
    D3S3["3. 管理员在搜索框输入名称或描述关键字，系统按关键字刷新资源卡片；管理员清空搜索后恢复<br/>当前筛选范围。"]
    D3S2 --> D3S3
    D3S4["4. 管理员点击标签，系统把标签加入筛选条件；已选标签高亮，管理员可以再次点击取消单个标<br/>签，或点击 Clear All 清除全部标签。"]
    D3S3 --> D3S4
    D3S5["5. 管理员在 Agent、AI Tool、Image Tool、Template 类型<br/>间切换，系统按当前类型展示资源，并保留或重新计算搜索、标签筛选结果。"]
    D3S4 --> D3S5
    D3S6["6. 资源卡片展示图标或预览图、名称、描述、标签，以及 Featured、Deep Ag<br/>ent、专家、共享或已授权等当前资源具备的标识。"]
    D3S5 --> D3S6
    D3S7["7. 管理员点击卡片主体，系统打开资源详情弹窗或详情视图，展示资源名称、描述、公开配置内<br/>容，以及该资源提供的指令或提示词信息。"]
    D3S6 --> D3S7
    D3S8["8. 只有 isBoardXResource 的资源卡片展示平台审核按钮；非 Board<br/>X Resource 不显示平台审核按钮。"]
    D3S7 --> D3S8
    D3S9["9. 如果资源当前 BoardX 审核状态不是 APPROVED，审核按钮显示待批准状态<br/>；管理员点击后，系统打开确认批准弹窗。"]
    D3S8 --> D3S9
    D3S10["10. 如果资源当前 BoardX 审核状态是 APPROVED，审核按钮显示已批准状态<br/>；管理员点击后，系统打开撤销批准确认弹窗。"]
    D3S9 --> D3S10
    D3S11["11. 确认弹窗展示当前操作含义，并展示资源名称、描述和指令/提示词内容（如果该资源提供<br/>）。"]
    D3S10 --> D3S11
    D3S12["12. 管理员点击取消，系统关闭确认弹窗，不改变资源状态。"]
    D3S11 --> D3S12
    D3S13["13. 管理员点击确认，系统提交审核状态更新；确认按钮显示 loading，避免重复提交<br/>。"]
    D3S12 --> D3S13
    D3S14["14. 更新成功后，系统关闭确认弹窗，并把资源的 BoardX 审核状态在 APPROV<br/>ED 与 PENDING 之间切换；资源卡片上的审核按钮状态同步更新。"]
    D3S13 --> D3S14
    D3S15["15. 更新失败时，系统保留原审核状态，关闭或保留当前弹窗并显示失败反馈，管理员可以稍后<br/>重试。"]
    D3S14 --> D3S15
    D3Alt{"备选：A1：管理员取消确认弹窗，系统不改变资源状态。；A2：管理员只搜索、筛选、切换类型和查看<br/>资源详情，不执行审核动作。；A3：当前搜索、标签或类型筛选没有匹配结果时，系统显示空状态<br/>，管理员可以清空搜索或筛选条件。；A4：资源不是 BoardX Resource 时，管<br/>理员仍可查看卡片和详情，但不能从该卡片执行平台审核。"}
    D3S15 --> D3Alt
    D3Err{"异常：E1：资源列表加载失败，系统展示错误状态和重试入口。；E2：审核状态更新失败，系统保留原<br/>状态并允许管理员稍后重试。；E3：资源在操作期间被删除、权限变化或状态已被其他管理员更新<br/>时，系统刷新列表或保留原状态并提示操作失败。"}
    D3S15 --> D3Err
    D3Perm["权限/可见性：1. 系统管理员可以进入平台级 Store Approval 页面，对平台审核资源执行批<br/>准或撤销批准。；2. Team Owner/Admin 可以在 Team 范围参与团队审<br/>核，但不能替代系统管理员执行平台官方审批。；3. Team Member 或 AI St<br/>ore 创建者可以提交或查看自己有权访问的项目状态，但不能在 Admin Panel 审<br/>批平台项目。；4. 非系统管理员访问后台审核页面时，系统拒绝或跳转。"]
    D3S15 --> D3Perm
  end
  subgraph D4G["设置官方精选 AI Store 项目"]
    D4Start["Actor：系统管理员"]
    D4Entry["可见入口/区域：Admin Panel 中的 Store Featured / AI Store F<br/>eatured 页面。；Admin 首页或侧边菜单中的 Store Featured<br/> 入口。"]
    D4Start --> D4Entry
    D4S1["1. 系统管理员进入 AI Store Featured 页面，系统加载 BoardX <br/>Admin 资源管理界面。"]
    D4Entry --> D4S1
    D4S2["2. 页面展示搜索框、结果数量、资源类型 Tab、标签筛选区和资源卡片网格；加载中展示 <br/>loading 状态，加载失败时展示错误和重试入口，没有结果时展示空状态。"]
    D4S1 --> D4S2
    D4S3["3. 管理员在搜索框输入名称或描述关键字，系统按关键字刷新资源卡片；管理员清空搜索后恢复<br/>当前筛选范围。"]
    D4S2 --> D4S3
    D4S4["4. 管理员点击标签，系统把标签加入筛选条件；已选标签高亮，管理员可以再次点击取消单个标<br/>签，或点击 Clear All 清除全部标签。"]
    D4S3 --> D4S4
    D4S5["5. 管理员在 Agent、AI Tool、Image Tool、Template 类型<br/>间切换，系统按当前类型展示资源。"]
    D4S4 --> D4S5
    D4S6["6. 资源卡片展示图标或预览图、名称、描述、标签，以及 Featured、Deep Ag<br/>ent、专家、共享或已授权等当前资源具备的标识；已精选项目显示 Featured 标识。"]
    D4S5 --> D4S6
    D4S7["7. 管理员点击卡片主体，系统打开资源详情弹窗或详情视图，展示资源名称、描述和公开配置内<br/>容。"]
    D4S6 --> D4S7
    D4S8["8. 只有 BoardXApprovalStatus 为 APPROVED 的资源显示星<br/>标精选按钮；未通过平台审核的资源不显示精选按钮。"]
    D4S7 --> D4S8
    D4S9["9. 未精选项目显示空心星标；管理员点击后，系统提交精选状态更新，把 isFeature<br/>d 切换为 true。"]
    D4S8 --> D4S9
    D4S10["10. 已精选项目显示实心星标和 Featured 标识；管理员点击后，系统提交取消精选<br/>，把 isFeatured 切换为 false。"]
    D4S9 --> D4S10
    D4S11["11. 操作成功后，资源卡片的星标状态和 Featured 标识随之更新。"]
    D4S10 --> D4S11
    D4S12["12. 操作失败时，系统保留原精选状态，管理员可稍后重试。"]
    D4S11 --> D4S12
    D4Alt{"备选：A1：管理员只搜索、筛选和查看资源详情。；A2：管理员取消某个项目的精选状态。；A3：当<br/>前搜索、标签或类型筛选没有匹配结果时，系统显示空状态，管理员可以清空搜索或筛选条件。；A<br/>4：资源未通过平台审核时，管理员可以查看卡片或详情，但不能从该卡片设置精选。"}
    D4S12 --> D4Alt
    D4Err{"异常：E1：资源列表加载失败，系统展示错误状态和重试入口。；E2：精选状态保存失败，系统保留原<br/>状态。；E3：资源在操作期间被删除、权限变化或审核状态不再是 APPROVED 时，系统<br/>刷新列表或保留原状态并提示操作失败。"}
    D4S12 --> D4Err
    D4Perm["权限/可见性：1. 系统管理员可以进入平台级 Store Featured 页面，设置或取消官方精选。<br/>；2. Team Owner/Admin 可以管理 Team 范围内项目或审核，但不能设<br/>置平台官方精选。；3. Team Member 和 AI Store 创建者可以浏览精选<br/>或维护自己有权管理的项目，不能在 Admin Panel 修改精选状态。；4. 非系统管<br/>理员访问后台精选页面时，系统拒绝或跳转。"]
    D4S12 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["管理员工作台"]
    D5Start["Actor：系统管理员"]
    D5Entry["可见入口/区域：Admin Panel 首页。；Admin Panel 侧边菜单中的 Home 入口<br/>。"]
    D5Start --> D5Entry
    D5S1["1. 系统管理员访问 Admin Panel，系统校验管理员身份并展示后台布局、Admi<br/>n 菜单和首页内容。"]
    D5Entry --> D5S1
    D5S2["2. 首页顶部展示 BoardX 标识、Admin Control Panel 标题、平<br/>台管理说明和 Administrator Access 标识。"]
    D5S1 --> D5S2
    D5S3["3. 系统加载平台统计数据，并展示总用户数、AI Tools 数、待审核数量、精选 To<br/>ols 数等摘要卡片。"]
    D5S2 --> D5S3
    D5S4["4. 首页展示管理模块卡片，包括商店探索、商店审批、精选商店、用户、分析等入口；管理员可<br/>从侧边菜单进入 Home、Store Explore、Store Approval、St<br/>ore Featured、Users、Teams。"]
    D5S3 --> D5S4
    D5S5["5. 每个模块卡片展示图标、名称、描述、分类和徽标，例如待审核数量或 New 标记。"]
    D5S4 --> D5S5
    D5S6["6. 管理员点击模块卡片，系统跳转到对应后台页面。"]
    D5S5 --> D5S6
    D5S7["7. 管理员也可以通过 Admin 菜单在 Home、Users、Teams、AI St<br/>ore Approval、AI Store Featured 等模块间切换。"]
    D5S6 --> D5S7
    D5S8["8. 如果统计数据加载中，系统展示 loading 或占位状态；加载失败时，首页仍保留导<br/>航入口。"]
    D5S7 --> D5S8
    D5Alt{"备选：A1：管理员通过侧边栏切换模块。"}
    D5S8 --> D5Alt
    D5Err{"异常：E1：非管理员访问，系统拒绝或跳转。；E2：管理数据加载失败，系统展示错误状态。"}
    D5S8 --> D5Err
    D5Perm["权限/可见性：1. 系统管理员可以访问后台首页、统计摘要、管理模块卡片和 Admin 菜单。；2. T<br/>eam Owner/Admin/Member 不因团队角色获得后台首页访问权。；3. 非<br/>系统管理员访问后台首页时，系统拒绝或跳转。"]
    D5S8 --> D5Perm
  end
```

