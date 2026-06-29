# Room 详细交互图

本图按 Room 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  RoomList["进入 Room Recent 或 Favorite"] --> Search["搜索 Room"]
  Search --> RoomResult["列表过滤或空状态"]
  RoomList --> OpenRoom["打开 Room 详情"]
  OpenRoom --> RoomDetail["看到标题、Board 列表、成员、文件、聊天、Studio、Survey 入口"]
  RoomDetail --> CreateBoard["创建 Board"]
  CreateBoard --> Board["进入新 Board 或刷新 Board 列表"]
  RoomDetail --> OpenBoard["打开已有 Board"]
  OpenBoard --> Board
  RoomDetail --> ManageMembers["邀请或管理 Room 成员"]
  ManageMembers --> MemberResult["成员列表更新或显示无权限"]
  RoomDetail --> Files["查看或管理 Room 文件"]
  Files --> FileResult["文件列表、上传状态或删除结果更新"]
  RoomDetail --> Chat["进入 Room Chat"]
  Chat --> RoomChat["发送消息、打开线程或删除聊天"]
  RoomDetail --> Studio["进入 Room Studio"]
  Studio --> Artifact["选择工具并生成制品"]
  RoomDetail --> Surveys["查看 Room 问卷"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["创建房间"]
    D1Start["Actor：已加入当前团队的用户"]
    D1Entry["可见入口/区域：Room 列表中的 New Room 加号按钮。"]
    D1Start --> D1Entry
    D1S1["1. 用户进入 Room 列表区域，看到 Recent、房间列表、搜索框以及 New R<br/>oom 入口。"]
    D1Entry --> D1S1
    D1S2["2. 用户点击 New Room 旁的加号按钮。"]
    D1S1 --> D1S2
    D1S3["3. 系统打开 Create Room 弹窗；在移动端以抽屉形式展示。"]
    D1S2 --> D1S3
    D1S4["4. 弹窗展示 Room Name 输入框和 Create Room 按钮；移动端还展示<br/> Cancel。"]
    D1S3 --> D1S4
    D1S5["5. 用户输入房间名称；系统保留输入内容。"]
    D1S4 --> D1S5
    D1S6["6. 当名称少于 3 个字符时，系统在输入框下提示名称至少需要满足长度要求，并禁用或阻止<br/>创建。"]
    D1S5 --> D1S6
    D1S7["7. 用户点击 Create Room 或按 Enter 提交。"]
    D1S6 --> D1S7
    D1S8["8. 系统创建房间，按钮显示 creating 状态。"]
    D1S7 --> D1S8
    D1S9["9. 创建成功后，系统关闭弹窗并进入新房间页面。"]
    D1S8 --> D1S9
    D1S10["10. 新房间页面展示顶部页签 Board、Chat、Survey，以及成员/设置等房间<br/>操作入口。"]
    D1S9 --> D1S10
    D1Alt{"备选：A1：移动端用户在抽屉中点击 Cancel，系统关闭抽屉，不创建房间。；A2：用户清空输<br/>入后停留在弹窗中，等待重新输入。"}
    D1S10 --> D1Alt
    D1Err{"异常：E1：名称为空或少于 3 个字符，系统不创建房间，并提示长度要求。；E2：创建失败，系统<br/>提示 roomCreateFailed。"}
    D1S10 --> D1Err
    D1Perm["权限/可见性：- 创建者成为新房间的 owner。；- Room owner/admin 在房间内可以<br/>看到设置入口。；- Room member 可以进入自己已加入的房间并使用房间内容入口。<br/>；- visitor/未加入当前团队的用户不能创建房间。"]
    D1S10 --> D1Perm
  end
  subgraph D2G["查看、搜索并打开房间"]
    D2Start["Actor：团队成员、房间成员"]
    D2Entry["可见入口/区域：Room 页面左侧房间列表。"]
    D2Start --> D2Entry
    D2S1["1. 用户进入 Room 页面，左侧区域展示 Recent、New Room、搜索框、房<br/>间列表。"]
    D2Entry --> D2S1
    D2S2["2. 如果房间列表加载中，系统展示骨架占位。"]
    D2S1 --> D2S2
    D2S3["3. 如果有收藏房间，系统在 Favorites 分组中展示；其余房间显示在 All R<br/>ooms。"]
    D2S2 --> D2S3
    D2S4["4. 房间项展示房间名称；私有房间显示 Private 标识；成员数量大于 1 时显示人<br/>数。"]
    D2S3 --> D2S4
    D2S5["5. 用户输入搜索关键字，系统按房间名称过滤列表。"]
    D2S4 --> D2S5
    D2S6["6. 用户点击清除按钮，系统清空搜索并恢复完整列表。"]
    D2S5 --> D2S6
    D2S7["7. 用户点击某个房间，系统进入该房间页面。"]
    D2S6 --> D2S7
    D2S8["8. 用户悬停房间项并点击星标，系统把该房间加入或移出收藏。"]
    D2S7 --> D2S8
    D2S9["9. 页面底部显示当前过滤结果的房间总数。"]
    D2S8 --> D2S9
    D2Alt{"备选：A1：用户点击 Recent，系统进入最近白板视图。；A2：用户在移动端打开房间抽屉后选<br/>择房间，系统进入房间并关闭抽屉。"}
    D2S9 --> D2Alt
    D2Err{"异常：E1：房间加载失败，系统显示 loadRoomsFailed。；E2：搜索无结果，系统显<br/>示 noSearchResults，并提供清除搜索操作。；E3：没有任何房间，系统展示空<br/>状态，引导创建房间。"}
    D2S9 --> D2Err
    D2Perm["权限/可见性：- 用户只在列表中看到自己当前团队上下文下可访问的房间。；- 非房间成员直接访问房间详情<br/>时，系统提示不是该房间成员，并在短暂等待后返回房间列表。；- visitor/未加入团队<br/>或房间的用户看不到该团队房间列表。"]
    D2S9 --> D2Perm
  end
  subgraph D3G["邀请并管理房间成员"]
    D3Start["Actor：Room owner、Room admin"]
    D3Entry["可见入口/区域：房间顶部设置按钮打开的 Room Settings 弹窗。"]
    D3Start --> D3Entry
    D3S1["1. 用户在房间顶部点击设置按钮。"]
    D3Entry --> D3S1
    D3S2["2. 系统打开 Room Settings 弹窗，展示 Room Name、Invite<br/> New Members、Current Members 和 Danger Zone。"]
    D3S1 --> D3S2
    D3S3["3. 用户在 Invite New Members 输入框中输入至少 2 个字符。"]
    D3S2 --> D3S3
    D3S4["4. 系统从当前团队成员中搜索候选人，并排除已经在房间中的用户和已经选中的用户。"]
    D3S3 --> D3S4
    D3S5["5. 用户点击候选人，系统把该成员显示为可移除标签。"]
    D3S4 --> D3S5
    D3S6["6. 用户也可以输入邮箱并按 Enter 或逗号；系统校验邮箱格式，通过后把邮箱显示为标<br/>签。"]
    D3S5 --> D3S6
    D3S7["7. 用户点击 Invite，系统逐个处理标签。"]
    D3S6 --> D3S7
    D3S8["8. 已注册且不在房间中的用户被直接加入房间，角色为 member。"]
    D3S7 --> D3S8
    D3S9["9. 未注册邮箱由系统邀请流程处理发送房间邀请。"]
    D3S8 --> D3S9
    D3S10["10. 用户点击 Copy Link，系统复制房间邀请链接并提示已复制。"]
    D3S9 --> D3S10
    D3S11["11. 用户在 Current Members 中看到成员姓名、头像、角色和操作菜单。"]
    D3S10 --> D3S11
    D3S12["12. 用户可用搜索框按姓名、用户名或邮箱过滤成员。"]
    D3S11 --> D3S12
    D3S13["13. 用户打开成员操作菜单，可以把 member 设为 admin、把 admin 设<br/>为 member，或移除成员。"]
    D3S12 --> D3S13
    D3Alt{"备选：A1：用户只复制房间邀请链接，不输入成员。；A2：用户在发送前移除某个邀请标签。；A3：<br/>用户只搜索成员，不修改成员角色。"}
    D3S13 --> D3Alt
    D3Err{"异常：E1：邮箱为空，系统提示 pleaseEnterEmailAddress。；E2：邮箱格<br/>式无效，系统提示 invalidEmail。；E3：用户已在房间中，系统提示已邀请或已在<br/>房间。；E4：复制链接失败，系统提示 copyFailed。"}
    D3S13 --> D3Err
    D3Perm["权限/可见性：- owner 不显示可操作菜单，不能被移除。；- admin 不能移除另一个 admi<br/>n；系统提示 adminRemoveUser。；- member 可以被提升为 admi<br/>n，也可以被移除。；- Room Settings 入口只对 owner/admin 展<br/>示。；- visitor/未加入房间的用户不能打开 Room Settings，也不能邀<br/>请或管理房间成员。"]
    D3S13 --> D3Perm
  end
  subgraph D4G["更新或删除房间"]
    D4Start["Actor：Room owner、Room admin"]
    D4Entry["可见入口/区域：房间顶部设置按钮打开的 Room Settings 弹窗。"]
    D4Start --> D4Entry
    D4S1["1. 用户在房间顶部点击设置按钮。"]
    D4Entry --> D4S1
    D4S2["2. 系统打开 Room Settings 弹窗。"]
    D4S1 --> D4S2
    D4S3["3. 用户在 Room Name 输入框中看到当前房间名称。"]
    D4S2 --> D4S3
    D4S4["4. 用户输入新名称并点击 Update。"]
    D4S3 --> D4S4
    D4S5["5. 如果新名称为空，系统提示 roomNameEmpty。"]
    D4S4 --> D4S5
    D4S6["6. 如果新名称与当前名称相同，系统不执行更新。"]
    D4S5 --> D4S6
    D4S7["7. 更新成功后，系统把页面中的房间名称同步为新名称。"]
    D4S6 --> D4S7
    D4S8["8. 用户在 Danger Zone 点击 Delete Room。"]
    D4S7 --> D4S8
    D4S9["9. 系统打开删除确认弹窗，提示删除风险。"]
    D4S8 --> D4S9
    D4S10["10. 用户必须输入当前房间名称。"]
    D4S9 --> D4S10
    D4S11["11. 当输入不匹配时，系统显示名称不匹配提示，并禁用删除按钮。"]
    D4S10 --> D4S11
    D4S12["12. 用户输入匹配名称后点击 Delete Room。"]
    D4S11 --> D4S12
    D4S13["13. 系统删除房间，清空当前房间信息。"]
    D4S12 --> D4S13
    D4S14["14. 如果还有其他房间，系统进入下一个房间；否则返回 Room 列表。"]
    D4S13 --> D4S14
    D4Alt{"备选：A1：用户只修改房间名称，不删除房间。；A2：用户打开删除确认后点击取消，房间不被删除。"}
    D4S14 --> D4Alt
    D4Err{"异常：E1：房间名称为空，系统提示 roomNameEmpty。；E2：删除确认名称不匹配，系<br/>统提示 roomNameNotMatch。；E3：更新或删除失败时，系统保持原房间状态，<br/>并在当前页面或全局提示中展示失败反馈。"}
    D4S14 --> D4Err
    D4Perm["权限/可见性：- owner/admin 可以看到房间设置入口。；- member 不显示房间设置入口<br/>，不能从正常页面进入更新/删除流程。；- visitor/未加入房间的用户不能进入该房间<br/>设置流程。"]
    D4S14 --> D4Perm
  end
```

```mermaid
flowchart TD
  subgraph D5G["管理房间文件面板"]
    D5Start["Actor：Room member、Room admin、Room owner"]
    D5Entry["可见入口/区域：房间 Chat 页签中的聊天工作区左侧 Room Files 面板。；文件专用面板或<br/> Files 区域。"]
    D5Start --> D5Entry
    D5S1["1. 用户进入房间页面并点击 Chat 页签。"]
    D5Entry --> D5S1
    D5S2["2. 如果用户尚未打开某个聊天线程，系统展示房间聊天列表。"]
    D5S1 --> D5S2
    D5S3["3. 用户新建或打开一个聊天线程后，系统进入三栏聊天工作区。"]
    D5S2 --> D5S3
    D5S4["4. 左侧展示 Room Files 面板，中间展示 AVA 聊天，右侧展示 Studi<br/>o 面板。"]
    D5S3 --> D5S4
    D5S5["5. 文件面板展示上传入口、允许的文件类型说明、上传进度、搜索框和文件列表。"]
    D5S4 --> D5S5
    D5S6["6. 当前聊天线程不是他人创建的已保存线程时，用户拖拽文件到上传区域，或点击上传区域选择<br/>文件。"]
    D5S5 --> D5S6
    D5S7["7. 系统校验文件类型；支持 PDF、Word、PowerPoint、文本、CSV、图片<br/>，文件专用面板还支持 Excel。"]
    D5S6 --> D5S7
    D5S8["8. 上传过程中，用户看到文件名、进度百分比和进度条。"]
    D5S7 --> D5S8
    D5S9["9. 上传成功后，文件出现在列表中；上传失败或类型不支持时，该文件行显示错误信息。"]
    D5S8 --> D5S9
    D5S10["10. 用户在搜索框输入文件名关键字，系统过滤当前列表；点击清除按钮后恢复列表。"]
    D5S9 --> D5S10
    D5S11["11. 用户点击预览或打开入口，系统获取文件访问链接，并在弹窗、iframe 或新窗口中<br/>展示可预览文件。"]
    D5S10 --> D5S11
    D5S12["12. 用户点击删除入口，系统打开确认弹窗；确认后删除文件并刷新列表。"]
    D5S11 --> D5S12
    D5S13["13. 用户可以收起左侧文件面板、重新展开，或拖动分隔条调整面板宽度。"]
    D5S12 --> D5S13
    D5Alt{"备选：A1：用户保持左侧面板收起，只使用中间聊天区。；A2：用户调整面板宽度后继续对话。；A3<br/>：用户只搜索或预览文件，不上传或删除。"}
    D5S13 --> D5Alt
    D5Err{"异常：E1：如果尚未打开聊天线程，文件列表请求不执行，用户需要先新建或打开聊天。；E2：文件类<br/>型不支持时，系统在上传项中显示 Unsupported file type。；E3：上传<br/>失败时，系统在上传项中显示失败原因。；E4：文件列表加载中时，系统展示加载占位。"}
    D5S13 --> D5Err
    D5Perm["权限/可见性：- owner/admin/member 在进入房间 Chat 后均可看到该工作区结构。<br/>；- 打开他人创建的已保存聊天线程时，文件面板进入仅查看模式，用户可查看文件但不能上传或<br/>删除。；- 非房间成员直接访问房间会被系统拦截并返回房间列表。；- visitor/未登<br/>录用户不能进入房间文件面板。"]
    D5S13 --> D5Perm
  end
  subgraph D6G["使用房间 Studio 面板"]
    D6Start["Actor：Room member、Room admin、Room owner"]
    D6Entry["可见入口/区域：房间 Chat 页签中的聊天工作区右侧 Studio 面板。"]
    D6Start --> D6Entry
    D6S1["1. 用户进入房间 Chat 页签。"]
    D6Entry --> D6S1
    D6S2["2. 用户新建或打开一个聊天线程后，系统展示三栏工作区。"]
    D6S1 --> D6S2
    D6S3["3. 右侧展示 Room Studio 面板，用户看到 Audio Overview、M<br/>ind Map、Report、Flashcards、Data Table 等工具卡片。"]
    D6S2 --> D6S3
    D6S4["4. 用户点击某个工具，系统打开文件选择侧边面板，并展示该工具说明。"]
    D6S3 --> D6S4
    D6S5["5. 如果当前聊天线程没有文件，系统提示先在 Files 上传文件。"]
    D6S4 --> D6S5
    D6S6["6. 如果有文件，用户可勾选一个或多个文件；已选文件以选中样式显示。"]
    D6S5 --> D6S6
    D6S7["7. 用户点击 Generate，系统显示生成中状态，并禁用重复生成。"]
    D6S6 --> D6S7
    D6S8["8. 生成成功后，面板展示结果内容，并显示来源文件数量。"]
    D6S7 --> D6S8
    D6S9["9. 用户可以点击 Edit Selection 返回文件选择，或点击 Close 关闭<br/>面板。"]
    D6S8 --> D6S9
    D6S10["10. 用户可以收起 Studio 面板；收起后页面保留展开按钮。"]
    D6S9 --> D6S10
    D6S11["11. 用户点击展开按钮，系统重新显示 Studio 面板。"]
    D6S10 --> D6S11
    D6S12["12. 用户可以拖动右侧分隔条调整 Studio 面板宽度。"]
    D6S11 --> D6S12
    D6S13["13. 中间聊天区域会根据右侧面板宽度预留空间，避免遮挡聊天内容。"]
    D6S12 --> D6S13
    D6Alt{"备选：A1：用户保持 Studio 收起，只使用聊天区。；A2：用户调整 Studio 宽度后<br/>继续对话。；A3：用户打开工具后未选择文件，Generate 保持不可用。"}
    D6S13 --> D6Alt
    D6Err{"异常：E1：如果聊天线程被删除，系统返回房间 Chat 列表。；E2：生成失败时，文件选择面板<br/>显示 Generation failed 或后端返回的错误信息。"}
    D6S13 --> D6Err
    D6Perm["权限/可见性：- owner/admin/member 在进入房间聊天线程后均可看到该布局。；- 非房<br/>间成员无法进入房间工作区。；- visitor/未登录用户不能进入房间 Studio 面<br/>板。"]
    D6S13 --> D6Perm
  end
  subgraph D7G["查看房间 Survey 页签"]
    D7Start["Actor：Room member、Room admin、Room owner"]
    D7Entry["可见入口/区域：房间顶部的 Survey 页签。"]
    D7Start --> D7Entry
    D7S1["1. 用户进入房间页面。"]
    D7Entry --> D7S1
    D7S2["2. 页面顶部展示 Board、Chat、Survey 三个页签。"]
    D7S1 --> D7S2
    D7S3["3. 用户点击 Survey。"]
    D7S2 --> D7S3
    D7S4["4. 系统切换到 Survey 页签内容区。"]
    D7S3 --> D7S4
    D7S5["5. 系统展示嵌入式问卷工作区，默认进入 Team Surveys 列表视图。"]
    D7S4 --> D7S5
    D7S6["6. 用户看到问卷列表标题、Refresh、Create Survey、问卷卡片、启用/<br/>暂停状态、题目数、答卷数和创建者信息。"]
    D7S5 --> D7S6
    D7S7["7. 用户点击 Create Survey，系统在同一页签切换到创建问卷模式，并保留房间<br/>页签上下文。"]
    D7S6 --> D7S7
    D7S8["8. 用户点击 View 或 Results，系统打开该问卷结果区，可在 Summary<br/>、Individual、Report 之间切换。"]
    D7S7 --> D7S8
    D7S9["9. 用户点击 Edit，系统进入问卷编辑器；如果用户无编辑权限，页面显示 noEdit<br/>Permission。"]
    D7S8 --> D7S9
    D7S10["10. 用户点击 Preview，系统打开公开答题页。"]
    D7S9 --> D7S10
    D7S11["11. 用户点击 Share，系统复制答题链接并显示成功或失败反馈。"]
    D7S10 --> D7S11
    D7S12["12. 用户点击 Pause 或 Activate，系统切换问卷状态，并在卡片上显示 A<br/>ctive 或 Paused。"]
    D7S11 --> D7S12
    D7S13["13. 用户点击 Delete，系统打开确认弹窗；确认后删除问卷并刷新列表。"]
    D7S12 --> D7S13
    D7Alt{"备选：A1：用户从 Survey 切换回 Board 或 Chat。；A2：用户在创建模式中返<br/>回列表，系统回到 Survey 列表视图。；A3：没有问卷时，系统显示还没有问卷的空状态<br/>。"}
    D7S13 --> D7Alt
    D7Err{"异常：E1：Survey 页签加载中时，系统展示页签内容的加载占位。；E2：问卷加载失败、分享<br/>失败、删除失败或状态更新失败时，页面显示错误信息，原状态保持不变。"}
    D7S13 --> D7Err
    D7Perm["权限/可见性：- owner/admin/member 均可看到房间顶部 Survey 页签。；- o<br/>wner/admin 在房间 Survey 中具备可编辑权限，可以编辑和管理团队范围内问<br/>卷。；- member 可以看到 Survey 页签、创建自己的问卷，并管理自己创建的问<br/>卷；对其他人创建且自己无管理权限的问卷，不展示操作按钮或显示 noEditPermiss<br/>ion。；- respondent 只通过公开答题链接进入答题页，不看到房间 Surve<br/>y 页签。；- 非房间成员直接访问房间时无法进入该页签。；- visitor/未登录用户<br/>不能进入房间 Survey 页签。"]
    D7S13 --> D7Perm
  end
```

