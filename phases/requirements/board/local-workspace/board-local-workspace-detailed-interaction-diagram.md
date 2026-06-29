# Board Local Workspace 详细交互图

本图按 Board Local Workspace 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Board["打开 Board"] --> Entry{"是否展示本地工作区入口"}
  Entry -->|否| Hidden["不作为当前可操作能力"]
  Entry -->|是| Workspace["打开聊天、记忆或本地工具面板"]
  Workspace --> Chat["使用 Board Chat"]
  Chat --> Send["发送消息"]
  Send --> Reply["显示回复、失败或限制提示"]
  Workspace --> Memory["查看 Board Memory"]
  Memory --> Add["添加记忆"]
  Add --> MemoryList["列表刷新"]
  Memory --> Delete["删除记忆"]
  Delete --> MemoryList
  Workspace --> Tool["使用本地模型或简单工具"]
  Tool --> ToolResult["结果展示；如无插入入口则不写入 Board"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["使用 Local Workspace"]
    D1Start["Actor：Board Owner、Board Admin、Board Memb<br/>er"]
    D1Entry["可见入口/区域：用户在 Board 内看到聊天或记忆相关入口时，才能进入该场景。；当前 Board <br/>内可确认的相关能力包括 Board Chat 和 Board Memory。；当前 <br/>Board 中不把本地工作区、本地模型或本地工具展示为已确认的用户入口。"]
    D1Start --> D1Entry
    D1S1["1. 用户打开 Board 中可见的聊天或记忆入口。"]
    D1Entry --> D1S1
    D1S2["2. 系统展示该入口对应内容，例如聊天输入框、聊天消息区、记忆列表、搜索框、添加记忆输入<br/>框或添加按钮。"]
    D1S1 --> D1S2
    D1S3["3. 用户输入问题、继续追问、添加记忆或搜索记忆。"]
    D1S2 --> D1S3
    D1S4["4. 系统显示生成中、保存中、搜索结果、空状态、成功或失败反馈。"]
    D1S3 --> D1S4
    D1S5["5. 用户复制聊天结果、继续追问，或在 Board Memory 中添加、搜索、删除记忆<br/>。"]
    D1S4 --> D1S5
    D1S6["6. 系统在对应面板中显示结果，并让用户知道结果是否已保存为 Board Memory，<br/>还是仅显示在当前聊天会话中。"]
    D1S5 --> D1S6
    D1S7["7. 用户关闭聊天或记忆面板后，系统返回 Board 画布，保留已保存的记忆和当前聊天状<br/>态。"]
    D1S6 --> D1S7
    D1Alt{"备选：1. 能力未开启时，系统不展示入口或提示当前不可用。；2. 用户没有足够权限读取 Boa<br/>rd 内容时，系统限制引用范围。；3. 本地模型或本地工具入口未显示时，系统不提供模型选<br/>择或本地工具调用。"}
    D1S7 --> D1Alt
    D1Err{"异常：1. 读取、生成、保存或插入失败时，系统保留用户输入并提示失败原因。；2. 敏感内容或无<br/>权限内容不能被加入记忆或发送给工具。"}
    D1S7 --> D1Err
    D1Perm["权限/可见性：1. Board Owner：可以进入 Board、编辑内容、管理标题和内容生命周期，并<br/>可在当前 Board、Room、Team 权限允许范围内管理分享范围、删除、移动、复制等<br/>高风险操作。；2. Board Admin：可以编辑内容并使用多数协作入口；涉及可见范围<br/>、删除、移动、备份恢复等管理动作时，需要具备对应 Room/Team/Board 管理权<br/>限。；3. Board Member：可以在有编辑权限的 Board 中创建、修改、移动<br/>、复制和删除自己可操作的内容；不默认拥有权限策略和 Board 生命周期管理能力。；4.<br/> Board Visitor：可以查看允许访问的内容，使用平移、缩放、查看同步状态和在线<br/>状态等查看能力；不能创建、编辑、删除或改变分享范围。；5. Public visitor<br/>：通过公开链接进入时只能获得公开策略允许的查看能力；如需要保存、编辑、加入协作或访问非公<br/>开 Board，系统应引导登录、加入空间或提示无权限。"]
    D1S7 --> D1Perm
  end
  subgraph D2G["使用 Board Chat"]
    D2Start["Actor：Board Owner、Board Admin、Board Memb<br/>er"]
    D2Entry["可见入口/区域：用户在 Board 内看到 Board Chat 入口时，才能进入该场景。；当前 B<br/>oard 可确认入口包括 Board Chat。；本地模型选择和本地工具调用不作为当<br/>前 Board 的已确认可见入口。"]
    D2Start --> D2Entry
    D2S1["1. 用户打开 Board Chat。"]
    D2Entry --> D2S1
    D2S2["2. 系统显示聊天区域、消息输入区和可见的聊天线程操作。"]
    D2S1 --> D2S2
    D2S3["3. 用户输入问题或指令。"]
    D2S2 --> D2S3
    D2S4["4. 系统显示发送后处理状态，例如生成中或失败提示。"]
    D2S3 --> D2S4
    D2S5["5. 系统返回回答，用户可以继续追问、复制结果，或使用当前界面实际展示的后续动作。"]
    D2S4 --> D2S5
    D2S6["6. 如果界面未展示“插入 Board”或本地工具入口，不能把结果写入 Board、选择<br/>本地模型或调用本地工具写成主流程事实。"]
    D2S5 --> D2S6
    D2S7["7. 用户关闭 Board Chat 后，系统回到 Board 画布，并保留当前聊天线程<br/>状态。"]
    D2S6 --> D2S7
    D2Alt{"备选：1. 能力未开启时，系统不展示入口或提示当前不可用。；2. 用户没有足够权限读取 Boa<br/>rd 内容时，系统限制引用范围。；3. 本地模型或本地工具入口未显示时，系统不提供模型选<br/>择或本地工具调用。"}
    D2S7 --> D2Alt
    D2Err{"异常：1. 读取、生成、保存或插入失败时，系统保留用户输入并提示失败原因。；2. 敏感内容或无<br/>权限内容不能被加入记忆或发送给工具。"}
    D2S7 --> D2Err
    D2Perm["权限/可见性：1. Board Owner：可以进入 Board、编辑内容、管理标题和内容生命周期，并<br/>可在当前 Board、Room、Team 权限允许范围内管理分享范围、删除、移动、复制等<br/>高风险操作。；2. Board Admin：可以编辑内容并使用多数协作入口；涉及可见范围<br/>、删除、移动、备份恢复等管理动作时，需要具备对应 Room/Team/Board 管理权<br/>限。；3. Board Member：可以在有编辑权限的 Board 中创建、修改、移动<br/>、复制和删除自己可操作的内容；不默认拥有权限策略和 Board 生命周期管理能力。；4.<br/> Board Visitor：可以查看允许访问的内容，使用平移、缩放、查看同步状态和在线<br/>状态等查看能力；不能创建、编辑、删除或改变分享范围。；5. Public visitor<br/>：通过公开链接进入时只能获得公开策略允许的查看能力；如需要保存、编辑、加入协作或访问非公<br/>开 Board，系统应引导登录、加入空间或提示无权限。"]
    D2S7 --> D2Perm
  end
  subgraph D3G["使用 Board Memory"]
    D3Start["Actor：Board Owner、Board Admin、Board Memb<br/>er"]
    D3Entry["可见入口/区域：用户在 Board 内打开 Board Memory 或包含 Board Memor<br/>y 的记忆面板。；系统显示 Board Memory 标题、说明、记忆数量、搜索框、<br/>记忆列表、添加记忆输入框和添加按钮。；每条记忆以可阅读的条目展示，鼠标悬停或聚焦时可<br/>看到删除入口。"]
    D3Start --> D3Entry
    D3S1["1. 用户打开 Board Memory，系统显示已有记忆列表；没有记忆时显示空状态。"]
    D3Entry --> D3S1
    D3S2["2. 用户在搜索框输入关键词，系统过滤记忆列表；没有匹配结果时显示无结果提示。"]
    D3S1 --> D3S2
    D3S3["3. 用户在输入框填写新的白板相关记忆，系统允许使用 Shift + Enter 换行。"]
    D3S2 --> D3S3
    D3S4["4. 用户点击“添加记忆”或在输入框按 Enter，系统显示保存中状态，并在保存成功后把<br/>新记忆加入列表和数量统计；Shift + Enter 只在输入框中换行。"]
    D3S3 --> D3S4
    D3S5["5. 用户在记忆条目上点击删除入口，系统打开删除确认。"]
    D3S4 --> D3S5
    D3S6["6. 用户确认删除，系统显示保存中状态，并在成功后从列表移除该记忆。"]
    D3S5 --> D3S6
    D3S7["7. 保存或删除失败时，系统保留原内容并提示失败，用户可以重试。"]
    D3S6 --> D3S7
    D3Alt{"备选：1. 搜索框为空时，系统展示全部记忆。；2. 用户输入为空或只包含空白时，添加按钮保持不<br/>可用。；3. 用户取消删除确认时，系统保留原记忆。；4. 能力未开启时，系统不展示 Bo<br/>ard Memory 入口或提示当前不可用。"}
    D3S7 --> D3Alt
    D3Err{"异常：1. 读取、保存或删除失败时，系统保留用户输入或原记忆列表，并提示失败原因。；2. 敏感<br/>内容或无权限内容不能被加入记忆。"}
    D3S7 --> D3Err
    D3Perm["权限/可见性：1. Board Owner：可以进入 Board、编辑内容、管理标题和内容生命周期，并<br/>可在当前 Board、Room、Team 权限允许范围内管理分享范围、删除、移动、复制等<br/>高风险操作。；2. Board Admin：可以编辑内容并使用多数协作入口；涉及可见范围<br/>、删除、移动、备份恢复等管理动作时，需要具备对应 Room/Team/Board 管理权<br/>限。；3. Board Member：可以在有编辑权限的 Board 中创建、修改、移动<br/>、复制和删除自己可操作的内容；不默认拥有权限策略和 Board 生命周期管理能力。；4.<br/> Board Visitor：可以查看允许访问的内容，使用平移、缩放、查看同步状态和在线<br/>状态等查看能力；不能创建、编辑、删除或改变分享范围。；5. Public visitor<br/>：通过公开链接进入时只能获得公开策略允许的查看能力；如需要保存、编辑、加入协作或访问非公<br/>开 Board，系统应引导登录、加入空间或提示无权限。"]
    D3S7 --> D3Perm
  end
```

