# Knowledge Base 详细交互图

本图按 Knowledge Base 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  KB["进入个人、Team 或 Room Knowledge Base"] --> List["看到文件列表、搜索、刷新、上传、下载、删除"]
  List --> Search["搜索文件"]
  Search --> Filtered["列表过滤或空状态"]
  List --> Upload["上传文件"]
  Upload --> Queue["显示上传队列和处理中状态"]
  Queue --> Ready["文件可用"]
  Queue --> Failed["文件失败并显示错误"]
  List --> Download["下载文件"]
  Download --> DownloadResult["浏览器下载或失败提示"]
  List --> Delete["删除文件"]
  Delete --> Confirm["确认删除"]
  Confirm --> Removed["列表移除文件"]
  Ready --> UseInAI["在 AVA、Agent 或工具上下文中引用"]
  UseInAI --> AIContext["对话或工具显示已引用文件"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["上传知识库文件"]
    D1Start["Actor：普通用户、Team 成员、Agent/AI Tool 创建者、AI <br/>服务"]
    D1Entry["可见入口/区域：Personal Knowledge Base 页面。；Team Knowledge<br/> Base 页面。；Agent 或 AI Tool 创建器中的 Knowledge <br/>区域。；知识库页面 > Upload File 按钮。；上传弹窗 > 拖拽上传区域和<br/> Select Files 按钮。"]
    D1Start --> D1Entry
    D1S1["1. 用户进入个人或团队知识库页面，或在 Agent/AI Tool 创建器中打开知识库<br/>区域；系统根据当前上下文展示标题、说明、搜索框、Refresh 按钮、Upload Fi<br/>le 按钮和文件列表区域。"]
    D1Entry --> D1S1
    D1S2["2. 用户点击 Upload File，系统打开上传弹窗，展示弹窗标题、当前上下文说明、<br/>拖拽上传区域、支持格式说明、Select Files 按钮和关闭按钮。"]
    D1S1 --> D1S2
    D1S3["3. 用户拖入文件或点击 Select Files 选择文件；系统支持多选，并在 Fil<br/>e List 中显示已选数量和最大数量。"]
    D1S2 --> D1S3
    D1S4["4. 系统校验文件扩展名是否属于 pdf、txt、md、doc、docx、json、cs<br/>v、xlsx、xls 等允许类型，并校验单文件大小不超过 50MB。"]
    D1S3 --> D1S4
    D1S5["5. 校验失败时，系统通过提示说明文件类型不支持、文件过大或超过最大文件数限制。"]
    D1S4 --> D1S5
    D1S6["6. 校验通过后，系统自动开始上传，不要求用户再点击提交。"]
    D1S5 --> D1S6
    D1S7["7. 上传列表展示文件名、大小、状态图标、进度条和状态文案；上传中显示 uploadin<br/>g，处理检查阶段显示 checking processing status，完成显示 c<br/>ompleted，失败显示错误说明。"]
    D1S6 --> D1S7
    D1S8["8. 系统按上下文把文件绑定到个人、团队、Agent 或 AI Tool 范围，并交给 <br/>AI 服务进行知识处理。"]
    D1S7 --> D1S8
    D1S9["9. 文件处理完成或失败后，系统展示成功或失败提示；成功上传后关闭弹窗并刷新当前知识库文<br/>件列表。"]
    D1S8 --> D1S9
    D1S10["10. 用户尝试在上传中关闭弹窗时，系统提示 upload in progress，并阻<br/>止关闭；上传结束后可关闭弹窗。"]
    D1S9 --> D1S10
    D1Alt{"备选：A1：用户移除尚未开始上传或失败状态的文件。；A2：用户选择多个文件，系统按批次并发上传<br/>。"}
    D1S10 --> D1Alt
    D1Err{"异常：E1：文件上传失败，系统在该文件行展示 error 状态，并提示上传失败数量。；E2：知<br/>识处理失败，系统展示 error 状态和错误说明。；E3：自动上传过程异常，系统展示 a<br/>uto upload failed 提示。"}
    D1S10 --> D1Err
    D1Perm["权限/可见性：1. 普通用户可以上传到自己的个人知识库。；2. Team 成员只能在自己有权访问的 T<br/>eam 上下文上传文件，不能跨 Team 上传。；3. Agent/AI Tool 创建<br/>者可以在对应创建器知识库区域上传专用知识文件。；4. 系统管理员的 Admin Pane<br/>l 权限不自动扩大知识库文件的 Team 业务可见范围。；5. AI 服务只处理系统传入<br/>的当前上下文文件，不改变用户的管理权限。"]
    D1S10 --> D1Perm
  end
  subgraph D2G["查看知识库文件列表"]
    D2Start["Actor：普通用户、Team 成员、Agent/AI Tool 创建者"]
    D2Entry["可见入口/区域：Personal Knowledge Base 页面 > 文件列表。；Team Kn<br/>owledge Base 页面 > 文件列表。；Agent 或 AI Tool 创建<br/>器 > Knowledge 文件列表。；知识库页面 > 搜索框。；知识库文件行 > <br/>下载按钮。"]
    D2Start --> D2Entry
    D2S1["1. 用户进入个人、Team、Agent 或 AI Tool 知识库页面；系统展示对应标<br/>题、上下文说明、Refresh 按钮、Upload File 按钮、搜索框和文件列表。"]
    D2Entry --> D2S1
    D2S2["2. 系统加载文件时展示骨架屏；没有文件时展示空状态，并在无搜索条件时提供上传第一个文件<br/>的入口。"]
    D2S1 --> D2S2
    D2S3["3. 文件列表展示文件名称、处理状态、上传人、更新时间、向量数量（如果有）、文件大小，以<br/>及下载和删除操作。"]
    D2S2 --> D2S3
    D2S4["4. 文件状态以标签展示 processing、completed、error 或 un<br/>known。"]
    D2S3 --> D2S4
    D2S5["5. 用户在搜索框输入关键词，系统按文件名或原始文件名过滤当前列表；没有匹配时展示无匹配<br/>文件提示。"]
    D2S4 --> D2S5
    D2S6["6. 用户点击 Refresh，系统重新请求当前上下文的文件列表并刷新状态。"]
    D2S5 --> D2S6
    D2S7["7. 如果文件超过当前页容量，用户点击 Load More，系统加载下一页并追加到列表下<br/>方。"]
    D2S6 --> D2S7
    D2S8["8. 用户点击下载按钮，系统提示正在下载。"]
    D2S7 --> D2S8
    D2S9["9. 系统先尝试通过受保护下载入口获取文件内容；成功时浏览器下载文件并提示下载完成。"]
    D2S8 --> D2S9
    D2S10["10. 如果受保护下载失败，系统尝试直接访问文件 URL；仍失败时在新标签页打开可访问的<br/>文件 URL，并提示已打开。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：用户只查看文件状态，不下载文件。；A2：用户通过搜索框筛选文件后再点击下载。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：文件没有可用 URL，系统提示文件地址不可用。；E2：下载失败，系统提示下载失败。<br/>；E3：文件列表加载失败，系统展示空列表或允许用户刷新重试。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：1. 普通用户只能查看自己的个人知识库文件。；2. Team 成员只能查看授权范围内的 <br/>Team 知识文件。；3. Agent/AI Tool 创建者只能查看对应创建器上下文中<br/>有权访问的知识文件。；4. 系统管理员后台权限不等于业务上下文文件访问权；知识文件仍按 <br/>personal、team、agent、tool 范围隔离。"]
    D2S10 --> D2Perm
  end
  subgraph D3G["删除知识库文件"]
    D3Start["Actor：文件上传者、Team 管理角色、Agent/AI Tool 创建者"]
    D3Entry["可见入口/区域：Personal Knowledge Base 页面 > 文件列表。；Team Kn<br/>owledge Base 页面 > 文件列表。；Agent 或 AI Tool 创建<br/>器 > Knowledge 文件列表。；知识库文件行 > 删除按钮。"]
    D3Start --> D3Entry
    D3S1["1. 用户进入知识库文件列表，系统展示每个文件的名称、状态、上传人、更新时间、大小和操作<br/>按钮。"]
    D3Entry --> D3S1
    D3S2["2. 用户可通过搜索框过滤文件名来定位文件。"]
    D3S1 --> D3S2
    D3S3["3. 用户点击文件行上的删除按钮。"]
    D3S2 --> D3S3
    D3S4["4. 系统提交删除请求；删除过程中当前列表保持可见。"]
    D3S3 --> D3S4
    D3S5["5. 删除成功后，系统从当前列表移除该文件，并展示 deleteFileSuccess <br/>提示。"]
    D3S4 --> D3S5
    D3S6["6. 删除失败时，系统保留文件行，并展示 deleteFileError 提示。"]
    D3S5 --> D3S6
    D3S7["7. 删除后用户可以点击 Refresh 重新加载列表，确认文件不再出现。"]
    D3S6 --> D3S7
    D3Alt{"备选：A1：用户未点击删除，系统不做变更。"}
    D3S7 --> D3Alt
    D3Err{"异常：E1：文件不存在，系统提示删除失败。；E2：用户无权限删除，系统拒绝或返回删除失败。；E<br/>3：删除服务异常，系统提示稍后重试。"}
    D3S7 --> D3Err
    D3Perm["权限/可见性：1. 普通用户可以删除自己有权管理的个人知识库文件。；2. Team 成员只能删除自己在<br/>当前 Team 上下文中有管理权限的文件。；3. Team Owner/Admin 可以<br/>删除 Team 范围内可管理的知识库文件。；4. Agent/AI Tool 创建者可以<br/>删除对应创建器上下文中有管理权限的知识文件。；5. 系统管理员后台权限不自动允许绕过 T<br/>eam、Agent 或 Tool 的文件隔离。"]
    D3S7 --> D3Perm
  end
  subgraph D4G["AI 引用知识库上下文"]
    D4Start["Actor：普通用户、Team 成员、Agent/AI Tool 创建者、AI <br/>服务"]
    D4Entry["可见入口/区域：Personal Knowledge Base 页面 > completed 文件。<br/>；Team Knowledge Base 页面 > completed 文件。；Ag<br/>ent 创建器 > Knowledge 区域。；AI Tool 创建器 > Know<br/>ledge 区域。；相关聊天或工具执行入口。"]
    D4Start --> D4Entry
    D4S1["1. 用户在个人、团队、Agent 或 AI Tool 场景中打开知识库区域，系统只加载<br/>当前上下文的文件，并展示文件状态。"]
    D4Entry --> D4S1
    D4S2["2. 系统展示每个文件的处理状态；completed 文件表示已完成处理，可作为 AI <br/>上下文候选。"]
    D4S1 --> D4S2
    D4S3["3. 用户上传新文件后，系统自动处理并刷新文件列表；processing 文件会保留在列<br/>表中并定时刷新状态。"]
    D4S2 --> D4S3
    D4S4["4. 用户进入 AVA、Agent 或 AI Tool 提问或执行场景，系统依据当前个人<br/>、Team、Agent 或 AI Tool 上下文关联可用知识文件。"]
    D4S3 --> D4S4
    D4S5["5. 用户发送问题或执行请求时，系统只把当前上下文中已完成处理且用户有权访问的知识文件纳<br/>入 AI 服务可用范围。"]
    D4S4 --> D4S5
    D4S6["6. 如果命中相关内容，AI 服务可结合知识库内容生成回答；如果没有命中，AI 仍按普通<br/>聊天或工具上下文回答。"]
    D4S5 --> D4S6
    D4S7["7. 如果某个文件仍在 processing 或 error 状态，系统不应把该文件描述<br/>为已可用知识上下文。"]
    D4S6 --> D4S7
    D4S8["8. 用户删除文件后，后续 AI 请求不再使用该文件内容。"]
    D4S7 --> D4S8
    D4Alt{"备选：A1：用户只使用个人知识库。；A2：用户使用团队级知识库。；A3：Agent 或 AI <br/>Tool 创建者使用专用知识文件。"}
    D4S8 --> D4Alt
    D4Err{"异常：E1：文件尚未处理完成，系统跳过该文件或继续展示 processing 状态。；E2：检<br/>索不到相关内容，AI 按普通上下文回答。；E3：跨团队或跨资源上下文不匹配，系统禁止引用<br/>。"}
    D4S8 --> D4Err
    D4Perm["权限/可见性：1. 普通用户只能让 AI 使用自己的个人知识库。；2. Team 成员只能让 AI 使<br/>用当前 Team 上下文中自己有权访问的知识文件。；3. Agent/AI Tool 创<br/>建者只能让对应资源使用其有权管理的知识文件。；4. 系统管理员不能通过普通聊天自动引用任<br/>意 Team 的私有知识文件。；5. AI 服务不能跨 Team、跨 Agent 或跨 <br/>AI Tool 主动读取未传入的知识文件。"]
    D4S8 --> D4Perm
  end
```

