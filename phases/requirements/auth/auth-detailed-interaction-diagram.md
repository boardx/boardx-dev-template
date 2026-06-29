# Auth 详细交互图

本图按 Auth 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Start["打开登录、注册或邀请链接"] --> Choose{"用户选择入口"}
  Choose --> Register["填写注册信息"]
  Choose --> Login["填写邮箱和密码"]
  Choose --> Social["选择第三方登录"]
  Choose --> Forgot["忘记密码"]
  Register --> RegisterSubmit["提交注册"]
  RegisterSubmit --> RegisterOk["注册成功并立即登录"]
  RegisterSubmit --> RegisterFail["显示字段错误或注册失败"]
  RegisterOk --> HasCallback{"是否存在 callback / returnTo"}
  HasCallback -->|是| CallbackTarget["回跳到邀请页或目标页面"]
  HasCallback -->|否| DefaultEntry["进入应用默认入口"]
  DefaultEntry --> AppShell["应用壳加载用户和 Team 数据"]
  AppShell --> HasTeam{"用户是否已有 Team"}
  HasTeam -->|否| ForceCreateTeam["自动打开创建 Team 弹窗"]
  ForceCreateTeam --> SubmitTeam["输入 Team 名称并创建"]
  SubmitTeam --> TeamCreated["创建成功，成为 Team Owner"]
  TeamCreated --> AvaDefault["进入 AVA 或当前默认工作区"]
  HasTeam -->|是| AvaDefault
  Login --> LoginSubmit["提交登录"]
  LoginSubmit --> LoginCallback{"是否存在 returnTo / callback"}
  LoginCallback -->|是| CallbackTarget
  LoginCallback -->|否| DefaultEntry
  LoginSubmit --> LoginFail["显示账号、密码或登录失败"]
  Social --> Callback["第三方回调处理中"]
  Callback --> DefaultEntry
  Callback --> LoginFail
  Forgot --> ResetMail["提交邮箱发送重置邮件"]
  ResetMail --> ResetPage["打开重置链接并修改密码"]
  ResetPage --> Login["返回登录"]
  Start --> Invite["打开邀请链接"]
  Invite --> NeedAuth{"是否已登录"}
  NeedAuth -->|否| Login
  NeedAuth -->|是| JoinTarget["加入 Team 或 Room"]
  CallbackTarget --> JoinTarget
  JoinTarget --> InviteDone["进入目标 Room 或 Room Recent；不强制弹创建 Team"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["邮箱注册 BoardX 账号"]
    D1Start["Actor：未登录访客、受邀访客"]
    D1Entry["可见入口/区域：注册页面。；邀请链接引导到注册页面。"]
    D1Start --> D1Entry
    D1S1["1. 用户访问当前语言下的 sign-up 页面。"]
    D1Entry --> D1S1
    D1S2["2. 系统展示 BoardX 标识、注册标题、隐私政策/服务条款链接、First nam<br/>e、Last name、Email、Password、同意条款勾选框和注册按钮。"]
    D1S1 --> D1S2
    D1S3["3. 如果 Google 或 Facebook 登录能力开启，系统在分隔文案下展示对应第<br/>三方入口；注册页不展示微信入口。"]
    D1S2 --> D1S3
    D1S4["4. 系统展示“已有账户？登录”入口，并保留当前查询参数跳转到登录页。"]
    D1S3 --> D1S4
    D1S5["5. 用户填写名、姓、邮箱、密码，并勾选同意服务条款和隐私政策。"]
    D1S4 --> D1S5
    D1S6["6. 用户点击注册按钮。"]
    D1S5 --> D1S6
    D1S7["7. 系统在当前页面校验名、姓、邮箱、密码最小长度以及同意条款勾选状态；不通过时在对应字<br/>段附近展示错误。"]
    D1S6 --> D1S7
    D1S8["8. 校验通过后，注册按钮进入提交状态，系统提交注册信息。"]
    D1S7 --> D1S8
    D1S9["9. 如果邮箱已存在或服务端返回字段错误，系统在对应字段展示错误，用户停留在注册页。"]
    D1S8 --> D1S9
    D1S10["10. 注册成功后，系统立即用该邮箱和密码登录，保存登录状态，并显示注册成功提示。"]
    D1S9 --> D1S10
    D1S11["11. 如果 URL 中存在 callback 或 returnTo，系统按当前语言补全<br/>回跳地址并进入该目标。"]
    D1S10 --> D1S11
    D1S12["12. 如果没有 callback 或 returnTo，系统进入应用默认入口；当前根入<br/>口在非邀请回调情况下进入 AVA 默认工作区。"]
    D1S11 --> D1S12
    D1S13["13. 应用壳加载用户和 Team 数据；如果该用户没有任何 Team，系统自动打开创建<br/> Team 弹窗，用户需要按“创建团队”用例完成 Team 创建后继续使用默认工作区。"]
    D1S12 --> D1S13
    D1S14["14. 如果该用户已有 Team，系统直接进入默认工作区并使用当前 Team 上下文。"]
    D1S13 --> D1S14
    D1Alt{"备选：A1：用户点击“已有账号”入口，系统跳转到 signin 页面，不创建账号。；A2：用户<br/>通过带 invite、callback 或 returnTo 参数的链接进入注册页，系统<br/>在注册和登录后继续保留可确认的回跳上下文。；A3：用户选择 Google 或 Faceb<br/>ook 第三方入口，系统进入第三方账号认证流程。；A4：用户已处于登录状态时访问 sig<br/>n-up，系统不应继续展示注册表单，而应进入已登录用户可访问的默认页面。；A5：用户来自<br/>邀请链接时，注册登录后优先回到邀请处理流程；如果邀请已让用户加入 Team 或 Room<br/>，系统不应再强制打开创建 Team 弹窗。"}
    D1S14 --> D1Alt
    D1Err{"异常：E1：First name 为空，系统在 First name 输入框附近展示错误提示，<br/>用户补全后错误消失。；E2：Last name 为空，系统在 Last name 输入框<br/>附近展示错误提示，用户补全后错误消失。；E3：Email 为空或格式无效，系统在 Ema<br/>il 输入框附近展示错误提示，用户修正后错误消失。；E4：Password 为空或少于最<br/>小长度，系统在 Password 输入框附近展示错误提示，用户修正后错误消失。；E5：邮<br/>箱已存在，系统在 Email 相关位置提示该邮箱已注册，用户可改用登录。；E6：网络或服<br/>务异常，系统提示注册失败，用户停留在注册页并可重试。"}
    D1S14 --> D1Err
    D1Perm["权限/可见性：1. 未登录访客可以看到注册表单、登录入口和已开启的第三方入口。；2. 受邀访客可以看到<br/>注册表单，并保留邀请上下文。；3. 已登录用户不应重复注册。"]
    D1S14 --> D1Perm
  end
  subgraph D2G["邮箱密码登录"]
    D2Start["Actor：已注册用户、从受保护页面跳转来的访客"]
    D2Entry["可见入口/区域：登录页面。；从受保护页面被引导到登录页面。；邀请链接引导到登录页面。"]
    D2Start --> D2Entry
    D2S1["1. 用户访问当前语言下的 signin 页面。"]
    D2Entry --> D2S1
    D2S2["2. 系统展示 BoardX 标识、登录标题、Email 输入框、Password 输入<br/>框、忘记密码入口和登录按钮。"]
    D2S1 --> D2S2
    D2S3["3. 如果 Google、Facebook 或 Wechat 登录能力开启，系统在分隔文<br/>案下展示对应第三方入口；微信入口会打开二维码登录面板。"]
    D2S2 --> D2S3
    D2S4["4. 如果注册能力开启，系统展示创建账号入口，并保留当前查询参数跳转到 sign-up <br/>页面。"]
    D2S3 --> D2S4
    D2S5["5. 用户输入邮箱和密码后点击登录按钮。"]
    D2S4 --> D2S5
    D2S6["6. 系统在当前页面校验邮箱格式、密码必填和密码最小长度；校验失败时在字段附近展示错误。"]
    D2S5 --> D2S6
    D2S7["7. 校验通过后，登录按钮进入提交状态，系统提交小写邮箱和密码。"]
    D2S6 --> D2S7
    D2S8["8. 登录成功后，系统保存 token、刷新 token 和当前用户信息，并记录登录状态<br/>。"]
    D2S7 --> D2S8
    D2S9["9. 如果 URL 中存在 callback 或 returnTo，系统按当前语言补全回<br/>跳地址并进入该目标。"]
    D2S8 --> D2S9
    D2S10["10. 登录失败时，系统把服务端返回的字段错误展示在对应输入框附近；网络或未知错误时展示<br/>登录失败提示，用户停留在登录页。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：用户点击“忘记密码”，系统跳转到 forgot-password 页面。；A2：用<br/>户点击注册入口，系统跳转到 sign-up 页面。；A3：用户账号为 Google、Fa<br/>cebook、Wechat 等第三方提供商，系统提示用户使用对应方式登录。；A4：用户从<br/>邀请链接跳转到登录页，登录成功后继续返回邀请接受流程。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：Email 为空或格式无效，系统在 Email 输入框附近展示错误提示。；E2：P<br/>assword 为空，系统在 Password 输入框附近展示错误提示。；E3：邮箱不存<br/>在，系统提示邮箱或密码无效。；E4：密码错误，系统提示邮箱或密码无效。；E5：账号没有密<br/>码，系统提示用户使用正确登录方式。；E6：登录系统服务异常，系统提示登录失败，用户停留在<br/>登录页并可重试。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：1. 未登录用户可以看到登录表单、注册入口、忘记密码入口和已开启的第三方登录入口。；2.<br/> 已登录用户不应继续停留在登录页重复登录。；3. 从受保护页面跳转来的用户登录成功后，只<br/>能回到自己有权限访问的目标页面。"]
    D2S10 --> D2Perm
  end
  subgraph D3G["第三方账号登录"]
    D3Start["Actor：使用 Google、Facebook 或 Wechat 的访客或已注<br/>册用户"]
    D3Entry["可见入口/区域：登录页面。；注册页面。；Wechat 登录回调页面。"]
    D3Start --> D3Entry
    D3S1["1. 用户访问 signin 或 sign-up 页面。"]
    D3Entry --> D3S1
    D3S2["2. 系统展示邮箱登录或邮箱注册表单，并在能力开启时展示第三方入口。"]
    D3S1 --> D3S2
    D3S3["3. 登录页可展示 Google、Facebook、Wechat；注册页可展示 Goog<br/>le、Facebook，且隐藏微信入口。"]
    D3S2 --> D3S3
    D3S4["4. 用户点击 Google 或 Facebook 入口，系统进入对应第三方认证流程，并<br/>保留 callback 或 returnTo 上下文。"]
    D3S3 --> D3S4
    D3S5["5. 用户点击微信入口时，系统在登录页切换为微信二维码登录面板，用户可返回邮箱登录。"]
    D3S4 --> D3S5
    D3S6["6. 第三方认证完成后，系统处理返回结果并建立登录状态；微信回调由 signin/wec<br/>hat-callback 页面处理。"]
    D3S5 --> D3S6
    D3S7["7. 登录成功后，系统进入回跳目标或登录后默认页面。"]
    D3S6 --> D3S7
    D3S8["8. 登录失败、二维码加载失败或第三方能力未配置时，系统展示错误或未配置提示，用户可返回<br/>并选择其它登录方式。"]
    D3S7 --> D3S8
    D3Alt{"备选：A1：第三方返回邮箱与系统已有邮箱匹配，系统复用或关联已有用户记录。；A2：第三方用户原<br/>记录缺少邮箱，本次登录返回邮箱时，系统补充邮箱信息。；A3：用户从 sign-up 页面<br/>点击第三方入口，系统仍进入第三方认证处理。；A4：用户取消第三方授权，系统返回原登录或注<br/>册页面。"}
    D3S8 --> D3Alt
    D3Err{"异常：E1：第三方凭证无效或过期，系统提示登录失败。；E2：第三方未返回足够身份信息，系统提示<br/>无法完成登录。；E3：第三方账号与现有账号冲突，系统提示用户使用原登录方式或联系支持。；<br/>E4：系统无法创建或读取用户，系统提示稍后重试。；E5：Wechat callback <br/>缺少必要 code 或 state，系统提示登录失败并引导返回 signin。"}
    D3S8 --> D3Err
    D3Perm["权限/可见性：1. 访客可以在 signin 或 sign-up 页面看到已启用的第三方入口。；2. <br/>未启用的第三方能力不应显示为可点击入口。；3. 已登录用户不应重复执行第三方登录。"]
    D3S8 --> D3Perm
  end
  subgraph D4G["通过邮箱重置密码"]
    D4Start["Actor：忘记密码的邮箱注册用户"]
    D4Entry["可见入口/区域：登录页中的忘记密码入口。；忘记密码页面。；用户邮箱中的密码重置邮件。；设置新密码页面。"]
    D4Start --> D4Entry
    D4S1["1. 用户在 signin 页面点击“忘记密码?”入口。"]
    D4Entry --> D4S1
    D4S2["2. 系统打开 forgot-password 页面，展示 BoardX 标识、页面标题<br/>、Email 输入框和发送按钮。"]
    D4S1 --> D4S2
    D4S3["3. 用户输入邮箱并点击发送按钮。"]
    D4S2 --> D4S3
    D4S4["4. 系统在当前页面校验邮箱必填和邮箱格式；校验失败时在输入框附近展示错误。"]
    D4S3 --> D4S4
    D4S5["5. 校验通过后，发送按钮进入提交状态，系统提交找回密码请求。"]
    D4S4 --> D4S5
    D4S6["6. 系统确认该邮箱对应可重置密码的邮箱账号后，生成带有效期的一次性密码重置链接。"]
    D4S5 --> D4S6
    D4S7["7. 系统通过邮件投递服务向用户提交的邮箱发送密码重置邮件；邮件正文包含重置链接、有效期说明和非本人操作提示。"]
    D4S6 --> D4S7
    D4S8["8. 发送成功后，系统在 forgot-password 页面展示“重置链接已发送到该邮箱，请前往邮箱查看”的成功提示。"]
    D4S7 --> D4S8
    D4S9["9. 用户打开自己的邮箱，看到来自 BoardX 的密码重置邮件。"]
    D4S8 --> D4S9
    D4S10["10. 用户点击邮件中的重置链接，系统打开 reset-password / password-change 页面。"]
    D4S9 --> D4S10
    D4S11["11. 系统展示 BoardX 标识、页面标题、New password、Password confirmation 和设置密码按钮；如果链接已过期，页面展示过期提示。"]
    D4S10 --> D4S11
    D4S12["12. 用户输入新密码和确认密码并提交。"]
    D4S11 --> D4S12
    D4S13["13. 系统校验新密码最小长度和两次密码一致性；校验失败时在字段附近展示错误。"]
    D4S12 --> D4S13
    D4S14["14. 提交成功后，系统展示重置成功提示，并跳转到 signin 页面。"]
    D4S13 --> D4S14
    D4S15["15. 如果重置链接缺失、服务端校验失败或网络异常，系统保留页面并展示错误提示，用户可重新尝试。"]
    D4S14 --> D4S15
    D4Alt{"备选：A1：用户在 forgot-password 页面决定返回 signin，系统不发送重置邮件。；A2：用户多次请求重置邮件，以最新可用邮件中的链接完成重置。；A3：用户在 password-change 页面发现密码不一致，修改确认密码后重新提交。；A4：用户没有收到邮件，可以在等待合理时间后重新提交邮箱请求新的重置邮件。"}
    D4S15 --> D4Alt
    D4Err{"异常：E1：forgot-password 页面 Email 为空，系统在 Email 输入框附近展示错误提示。；E2：Email 格式无效，系统在 Email 输入框附近展示错误提示。；E3：邮箱不存在，系统提示该邮箱未注册或无法发送重置邮件。；E4：邮件投递服务连接失败、认证失败、发件人被拒绝、收件人投递失败或发送超时时，系统应在可接受等待时间内提示“重置邮件发送失败，请稍后重试或联系管理员”，保留邮箱并允许重试；系统不应只展示 500、Request failed 或让前端代理超时。；E5：重置链接无效或过期，password-change 页面提示链接无效。；E6：新密码为空或少于最小长度，系统在 New password 输入框附近展示错误提示。；E7：确认密码与新密码不一致，系统在 Password confirmation 输入框附近展示错误提示。；E8：服务异常，系统提示重置失败，用户可稍后重试。"}
    D4S15 --> D4Err
    D4Perm["权限/可见性：1. 未登录用户可以从 signin 进入 forgot-password。；2. 只有<br/>拥有邮箱账号且能访问邮箱的用户可以完成重置。；3. 重置链接不能让用户访问其它账号。"]
    D4S15 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["确认邮箱"]
    D5Start["Actor：访客、注册用户"]
    D5Entry["可见入口/区域：邮件中的确认链接。；邮箱确认页面。；新邮箱确认页面。"]
    D5Start --> D5Entry
    D5S1["1. 用户点击邮箱中的确认链接。"]
    D5Entry --> D5S1
    D5S2["2. 系统打开 confirm-email 或 confirm-new-email 页面<br/>，并读取链接中的 hash 参数。"]
    D5S1 --> D5S2
    D5S3["3. confirm-email 页面展示 BoardX 标识、加载动画和 verify<br/>ing 文案；confirm-new-email 页面展示加载动画。"]
    D5S2 --> D5S3
    D5S4["4. 系统提交 hash 进行确认，用户在处理期间只看到加载状态。"]
    D5S3 --> D5S4
    D5S5["5. 注册邮箱确认成功后，系统展示邮箱确认成功提示，并跳转到 profile 页面。"]
    D5S4 --> D5S5
    D5S6["6. 新邮箱确认成功后，系统展示邮箱确认成功提示；如果当前用户已登录，系统刷新当前用户资<br/>料并跳转到 profile 页面，否则跳转到公开入口。"]
    D5S5 --> D5S6
    D5S7["7. 确认失败时，系统展示确认失败提示，并跳转到公开入口。"]
    D5S6 --> D5S7
    D5Alt{"备选：A1：用户已登录并确认新邮箱，系统更新账号邮箱后返回个人资料页。；A2：用户未登录并确认<br/>注册邮箱，系统展示成功状态后引导登录。；A3：用户重复打开已使用过的确认链接，系统展示已<br/>确认或链接不可重复使用的状态。"}
    D5S7 --> D5Alt
    D5Err{"异常：E1：确认链接缺少必要信息，系统展示链接无效。；E2：确认信息过期，系统提示重新发起确认<br/>。；E3：确认信息与当前用户或目标邮箱不匹配，系统提示确认失败。；E4：服务异常，系统展<br/>示确认失败并允许用户稍后重试。"}
    D5S7 --> D5Err
    D5Perm["权限/可见性：1. 访客可以打开确认邮箱页面，但只能完成链接中指定账号的确认动作。；2. 已登录用户确<br/>认新邮箱时，系统必须确保该链接属于当前用户或允许的邮箱变更流程。；3. 确认页面不应展示<br/>其它账号的敏感信息。"]
    D5S7 --> D5Perm
  end
  subgraph D6G["修改密码"]
    D6Start["Actor：邮箱密码注册用户"]
    D6Entry["可见入口/区域：用户菜单中的 Profile / 个人资料入口；账号中心的 Security 分区。"]
    D6Start --> D6Entry
    D6S1["1. 用户从用户菜单进入账号中心。"]
    D6Entry --> D6S1
    D6S2["2. 系统展示账号中心标题、返回工作区入口和 Personal info、Security、Settings 分区导航。"]
    D6S1 --> D6S2
    D6S3["3. 用户点击 Security 分区。"]
    D6S2 --> D6S3
    D6S4["4. 系统展示修改密码区域，包含当前密码、新密码、确认新密码输入框和 Update password 按钮，并说明修改密码会使现有会话失效。"]
    D6S3 --> D6S4
    D6S5["5. 用户输入旧密码、新密码和密码确认。"]
    D6S4 --> D6S5
    D6S6["6. 用户点击 Update password。"]
    D6S5 --> D6S6
    D6S7["7. 系统在当前页面校验三个密码字段是否已填写、新密码是否满足最小长度、确认密码是否与新密码一致。"]
    D6S6 --> D6S7
    D6S8["8. 校验失败时，系统在 Security 分区展示错误，用户停留在当前页面。"]
    D6S7 --> D6S8
    D6S9["9. 校验通过后，Update password 按钮进入提交状态，系统提交当前密码和新密码。"]
    D6S8 --> D6S9
    D6S10["10. 修改成功后，系统清空密码输入框，展示密码已更新提示，并要求用户重新登录或进入登录页。"]
    D6S9 --> D6S10
    D6S11["11. 如果旧密码不正确或服务端保存失败，系统在 Security 分区展示错误，用户可修改后重试。"]
    D6S10 --> D6S11
    D6S12["12. 用户切换到 Personal info 或 Settings 时，系统展示对应分区，不提交密码修改。"]
    D6S11 --> D6S12
    D6Alt{"备选：A1：用户取消修改或离开页面，系统不保存任何密码变更。；A2：用户输入确认密码不一致，系<br/>统提示后用户修改确认密码并重新提交。；A3：系统策略要求重新登录时，用户被引导到 sig<br/>nin 页面使用新密码登录。"}
    D6S12 --> D6Alt
    D6Err{"异常：E1：用户未登录访问账号中心，系统引导到 signin 页面。；E2：当前密码为空，系统在当前密码输入框附近展示错误提示。；E3：当前密码错误，系统提示旧密码不正确。；E4：新密码为空或少于最小长度，系统在 New password 输入框附近展示错误提示。；E5：确认密码为空或与新密码不一致，系统在 Password confirmation 输入框附近展示错误提示。；E6：用户账号不是邮箱密码登录账号，系统提示使用对应登录方式管理账号。；E7：服务异常，系统提示修改失败，用户可重试。"}
    D6S12 --> D6Err
    D6Perm["权限/可见性：1. 只有已登录用户可以进入修改密码流程。；2. 第三方登录且未设置密码的用户不应看到不<br/>可执行的邮箱密码修改流程，或应看到明确说明。；3. 修改密码表单中的密码内容必须以密码输<br/>入形式展示。"]
    D6S12 --> D6Perm
  end
```
