# Profile 详细交互图

本图按 Profile 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Menu["打开用户菜单"] --> MenuItems["看到头像、显示名或邮箱、Profile、Settings、Memory、邀请、退出登录"]
  MenuItems --> Profile["点击 Profile"]
  MenuItems --> SettingsEntry["点击 Settings"]
  Profile --> AccountProfile["进入账号中心并打开 Personal info"]
  SettingsEntry --> AccountSettings["进入账号中心并打开 Settings"]
  AccountProfile --> ProfileOps["看到邮箱、显示名、头像预览、候选头像、AI generate、保存按钮"]
  ProfileOps --> PickAvatar["选择候选头像或 AI 生成头像"]
  PickAvatar --> SaveProfile["保存显示名和头像"]
  SaveProfile --> ProfileResult["用户菜单和账号中心显示最新头像、显示名或错误提示"]
  AccountProfile --> Security["切换 Security"]
  Security --> PasswordOps["填写当前密码、新密码、确认新密码并提交"]
  PasswordOps --> PasswordResult["密码更新成功后要求重新登录或展示错误"]
  AccountSettings --> SettingsOps["选择 AI 模型偏好、默认隐私级别并保存"]
  SettingsOps --> SettingsResult["保存成功后保留最新选择或展示错误"]
  Menu --> Memory["个人 Memory"]
  Memory --> MemoryOps["搜索、添加、删除"]
  MemoryOps --> MemoryResult["列表刷新或错误提示"]
  MenuItems --> Logout["退出登录"]
  Logout --> Signin["清除会话并进入 signin"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["查看账号中心"]
    D1Start["Actor：注册用户"]
    D1Entry["可见入口/区域：用户菜单中的 Profile / 个人资料入口；用户菜单中的 Settings / 设置入口；账号中心。"]
    D1Start --> D1Entry
    D1S1["1. 用户打开用户菜单。"]
    D1Entry --> D1S1
    D1S2["2. 系统展示当前用户头像、显示名或邮箱，并展示 Profile、Settings、退出登录等账号入口。"]
    D1S1 --> D1S2
    D1S3["3. 用户点击 Profile 时，系统进入账号中心并默认打开 Personal info 分区；用户点击 Settings 时，系统进入账号中心并默认打开 Settings 分区。"]
    D1S2 --> D1S3
    D1S4["4. 系统展示账号中心标题、返回工作区入口、Personal info、Security、Settings 分区导航和当前分区内容。"]
    D1S3 --> D1S4
    D1S5["5. Personal info 显示邮箱、显示名、头像预览、候选头像、AI generate 和保存按钮。"]
    D1S4 --> D1S5
    D1S6["6. Security 显示当前密码、新密码、确认新密码和提交按钮。"]
    D1S5 --> D1S6
    D1S7["7. Settings 显示 AI 模型偏好、默认隐私级别和保存按钮。"]
    D1S6 --> D1S7
    D1S8["8. 用户切换分区时，系统只切换账号中心内容区，不退出登录，也不丢失已加载资料。"]
    D1S7 --> D1S8
    D1Perm["权限/可见性：1. 注册用户只能管理自己的账号中心。；2. 访客不能进入账号中心。；3. Profile 和 Settings 是不同默认分区入口。"]
    D1S8 --> D1Perm
  end
  subgraph D2G["编辑个人信息和头像"]
    D2Start["Actor：注册用户"]
    D2Entry["可见入口/区域：账号中心 Personal info 分区。"]
    D2Start --> D2Entry
    D2S1["1. 系统打开 Personal info 分区，展示邮箱、显示名输入框、头像预览、候选头像、AI generate 和 Save personal info。"]
    D2Entry --> D2S1
    D2S2["2. 用户点击候选头像，系统立即更新头像预览，并用选中态标识该头像。"]
    D2S1 --> D2S2
    D2S3["3. 用户点击 AI generate，系统基于显示名、邮箱或用户标识生成新头像，并更新头像预览。"]
    D2S2 --> D2S3
    D2S4["4. 用户修改 Display name，系统保留输入。"]
    D2S3 --> D2S4
    D2S5["5. 用户点击 Save personal info，系统校验 Display name 不能为空。"]
    D2S4 --> D2S5
    D2S6["6. 保存中按钮进入提交状态；保存成功后，系统展示成功提示，并刷新账号中心和用户菜单中的头像、显示名。"]
    D2S5 --> D2S6
    D2S7["7. 保存失败时，系统展示错误，保留当前输入和头像选择，用户可重试。"]
    D2S6 --> D2S7
    D2S8["8. 用户离开但未保存时，系统不更新账号资料。"]
    D2S7 --> D2S8
    D2Perm["权限/可见性：1. 注册用户只能编辑自己的显示名和头像。；2. 访客不能进入账号中心。"]
    D2S8 --> D2Perm
  end
  subgraph D3G["使用用户菜单"]
    D3Start["Actor：注册用户"]
    D3Entry["可见入口/区域：页面中的头像或用户菜单入口。；侧边栏或顶部导航中的账号入口。"]
    D3Start --> D3Entry
    D3S1["1. 用户在页面右上角或侧边栏看到头像按钮。"]
    D3Entry --> D3S1
    D3S2["2. 用户点击头像按钮，系统展开用户菜单。"]
    D3S1 --> D3S2
    D3S3["3. 非简化菜单顶部展示当前团队名称、用户头像、姓名、邮箱或基础身份信息，以及可用的升级<br/>或 Credit 入口。"]
    D3S2 --> D3S3
    D3S4["4. 系统展示账号相关菜单项：Profile / 个人资料、Settings / 设置、个人知识库，以及在非 Credit 计费模式下的升级或管理计划入口。"]
    D3S3 --> D3S4
    D3S5["5. 系统展示邀请好友入口和退出登录入口。"]
    D3S4 --> D3S5
    D3S6["6. 系统展示语言区域，列出 English 和中文，并标识当前语言。"]
    D3S5 --> D3S6
    D3S7["7. 如果当前视图启用主题切换，系统展示浅色、深色和系统主题选项，并标识当前主题。"]
    D3S6 --> D3S7
    D3S8["8. 用户点击 Profile / 个人资料，系统进入账号中心并打开 Personal info 分区。"]
    D3S7 --> D3S8
    D3S9["9. 用户点击 Settings / 设置，系统进入账号中心并打开 Settings 分区。"]
    D3S8 --> D3S9
    D3S10["10. 用户点击个人知识库、邀请好友、升级/Credit 或记录入口时，系统打开对应页面或弹窗。"]
    D3S9 --> D3S10
    D3S11["11. 用户点击退出登录，系统清除登录状态并跳转到当前语言对应的 signin 页面。"]
    D3S10 --> D3S11
    D3Alt{"备选：A1：用户关闭菜单，不执行操作。；A2：移动端以抽屉或菜单形式展示。"}
    D3S11 --> D3Alt
    D3Err{"异常：E1：登录状态失效，系统要求重新登录。；E2：某入口不可用或未启用时，系统不展示该入口或<br/>不允许继续操作。"}
    D3S11 --> D3Err
    D3Perm["权限/可见性：1. 只有注册用户可以看到完整用户菜单。；2. 访客只能看到登录或注册入口。"]
    D3S11 --> D3Perm
  end
  subgraph D4G["管理个人 Memory"]
    D4Start["Actor：注册用户"]
    D4Entry["可见入口/区域：用户菜单中的个人 Memory 入口。；个人设置中的 Memory 入口。"]
    D4Start --> D4Entry
    D4S1["1. 用户从个人 Memory 入口或相关设置入口打开个人 Memory 页面或面板。"]
    D4Entry --> D4S1
    D4S2["2. 系统加载当前用户的 Memory 列表，并展示搜索框、输入区、添加按钮、空状态或现<br/>有 Memory 项。"]
    D4S1 --> D4S2
    D4S3["3. 用户在输入区输入个人偏好、事实或长期信息。"]
    D4S2 --> D4S3
    D4S4["4. 用户点击添加按钮，或在输入区按 Enter 提交；Shift+Enter 用于换行<br/>。"]
    D4S3 --> D4S4
    D4S5["5. 系统校验内容不能为空，并检查是否与已有 Memory 重复。"]
    D4S4 --> D4S5
    D4S6["6. 保存中系统禁用重复保存；保存成功后列表按文本排序展示新 Memory，并显示成功反<br/>馈。"]
    D4S5 --> D4S6
    D4S7["7. 用户输入搜索关键词时，系统按关键词过滤当前 Memory 列表。"]
    D4S6 --> D4S7
    D4S8["8. 用户点击删除入口，系统打开确认弹窗。"]
    D4S7 --> D4S8
    D4S9["9. 用户确认删除后，系统保存更新后的列表，成功后移除该 Memory 并展示成功反馈。"]
    D4S8 --> D4S9
    D4S10["10. 保存失败时，系统回退本地列表并展示错误反馈。"]
    D4S9 --> D4S10
    D4Alt{"备选：A1：用户删除不再需要的 Memory。；A2：用户只查看 Memory，不做修改。"}
    D4S10 --> D4Alt
    D4Err{"异常：E1：Memory 内容为空，系统阻止保存。；E2：保存失败，系统保留输入并提示重试。"}
    D4S10 --> D4Err
    D4Perm["权限/可见性：1. 用户只能管理自己的个人 Memory。；2. 其他用户和 Team 成员不能查看个<br/>人 Memory，除非用户主动授权。"]
    D4S10 --> D4Perm
  end
  subgraph D5G["管理账号设置"]
    D5Start["Actor：注册用户"]
    D5Entry["可见入口/区域：用户菜单中的 Settings / 设置入口；账号中心 Settings 分区。"]
    D5Start --> D5Entry
    D5S1["1. 用户点击 Settings / 设置。"]
    D5Entry --> D5S1
    D5S2["2. 系统进入账号中心，默认打开 Settings 分区，并高亮该分区。"]
    D5S1 --> D5S2
    D5S3["3. 系统展示 AI model preference 下拉选择，可选 Auto、Local first、BoardX cloud 等可用选项。"]
    D5S2 --> D5S3
    D5S4["4. 系统展示 Default privacy 下拉选择，可选 Local only、Confidential、Internal、Cloud allowed、Public 等可用选项。"]
    D5S3 --> D5S4
    D5S5["5. 用户修改一个或多个设置项并点击 Save settings。"]
    D5S4 --> D5S5
    D5S6["6. 系统校验所选值属于允许选项集合；校验通过后按钮进入提交状态并保存设置。"]
    D5S5 --> D5S6
    D5S7["7. 保存成功后，系统展示成功提示，并在 Settings 分区保留最新选择。"]
    D5S6 --> D5S7
    D5S8["8. 保存失败时，系统展示错误，保留页面上的当前选择，已保存设置不被覆盖。"]
    D5S7 --> D5S8
    D5Perm["权限/可见性：1. 注册用户只能修改自己的账号设置。；2. 受团队或企业策略限制的设置必须显示为受限或不可编辑状态。"]
    D5S8 --> D5Perm
  end
```
