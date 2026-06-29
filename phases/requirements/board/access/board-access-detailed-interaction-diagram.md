# Board Access 详细交互图

本图按 Board Access 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  User["用户打开 Board"] --> Access{"访问策略"}
  Access -->|私有且无权限| Denied["显示无权限、登录、申请或返回入口"]
  Access -->|公开只读| Visitor["进入 Board Visitor 只读状态"]
  Access -->|有编辑权限| Editor["进入可编辑 Board"]
  Editor --> Share["打开分享入口"]
  Share --> SharePanel["看到可见范围、链接、成员或邀请设置"]
  SharePanel --> ChangeVisibility["切换公开或私有"]
  ChangeVisibility --> VisibilitySaved["范围更新并显示成功或失败"]
  SharePanel --> CopyLink["复制分享链接"]
  CopyLink --> Copied["显示复制成功"]
  SharePanel --> InviteMember["邀请成员"]
  InviteMember --> InviteResult["邀请发送、成员列表刷新或失败"]
  Visitor --> ViewOnly["可平移、缩放、查看内容和协作者状态"]
  ViewOnly --> EditAttempt["尝试编辑"]
  EditAttempt --> ReadonlyFeedback["不执行编辑并提示无权限或入口不可见"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["管理 Board 可见范围"]
    D1Start["Actor：Board Owner、Board Admin、Board Memb<br/>er、Board Visitor、public visitor"]
    D1Entry["可见入口/区域：用户在 Board Header 点击“分享白板”入口。；分享面板展示标题、访问范围<br/>下拉、复制链接按钮和显示/隐藏二维码入口。；访问范围下拉可显示公开、团队成员可访问、<br/>房间成员可访问等与当前 Board 所属空间匹配的选项。；当前用户不是 Room O<br/>wner 或 Room Admin 时，访问范围下拉保持禁用，但复制链接和二维码入口<br/>仍显示。"]
    D1Start --> D1Entry
    D1S1["1. 用户点击“分享白板”，系统打开分享面板。"]
    D1Entry --> D1S1
    D1S2["2. 系统显示当前访问范围下拉，并按 Board 所属 Team 或 Room 展示可选<br/>范围。"]
    D1S1 --> D1S2
    D1S3["3. 当前用户是 Room Owner 或 Room Admin 时，可以选择新的访问范<br/>围，系统立即更新面板中的当前选择。"]
    D1S2 --> D1S3
    D1S4["4. 系统保存访问范围，并把变更同步给当前 Board。"]
    D1S3 --> D1S4
    D1S5["5. 用户点击复制链接，系统复制包含当前 Board 地址和视角参数的链接，并提示复制成<br/>功或失败。"]
    D1S4 --> D1S5
    D1S6["6. 用户点击显示二维码，系统在面板中生成二维码；再次点击后隐藏二维码。"]
    D1S5 --> D1S6
    D1S7["7. 用户关闭分享面板后，Board 继续按最新访问范围控制后续访问。"]
    D1S6 --> D1S7
    D1Alt{"备选：1. 非 Room Owner 或 Room Admin 用户仍可复制链接或显示二维码，<br/>但访问范围选择保持禁用。；2. 目标 Board 不属于 Team 或 Room 时，系<br/>统不展示对应范围。；3. 用户只需要二维码时，可以不改变访问范围，直接显示二维码。"}
    D1S7 --> D1Alt
    D1Err{"异常：1. 保存失败时，系统恢复或保留原访问范围并提示失败。；2. 权限不足时，系统提示无权限<br/>。"}
    D1S7 --> D1Err
    D1Perm["权限/可见性：1. Board Owner：可以进入 Board、编辑内容、管理标题和内容生命周期，并<br/>可在当前 Board、Room、Team 权限允许范围内管理分享范围、删除、移动、复制等<br/>高风险操作。；2. Board Admin：可以编辑内容并使用多数协作入口；涉及可见范围<br/>、删除、移动、备份恢复等管理动作时，需要具备对应 Room/Team/Board 管理权<br/>限。；3. Board Member：可以在有编辑权限的 Board 中创建、修改、移动<br/>、复制和删除自己可操作的内容；不默认拥有权限策略和 Board 生命周期管理能力。；4.<br/> Board Visitor：可以查看允许访问的内容，使用平移、缩放、查看同步状态和在线<br/>状态等查看能力；不能创建、编辑、删除或改变分享范围。；5. Public visitor<br/>：通过公开链接进入时只能获得公开策略允许的查看能力；如需要保存、编辑、加入协作或访问非公<br/>开 Board，系统应引导登录、加入空间或提示无权限。"]
    D1S7 --> D1Perm
  end
  subgraph D2G["通过公开链接加入或查看 Board"]
    D2Start["Actor：Board Owner、Board Admin、Board Memb<br/>er、Board Visitor、public visitor"]
    D2Entry["可见入口/区域：用户收到从分享面板复制的公开链接或二维码。；链接可包含 Board 地址和当前画布视<br/>角参数。；用户打开后看到 Board 加载状态、可查看内容、在线状态和必要的登录/加<br/>入提示。"]
    D2Start --> D2Entry
    D2S1["1. 用户在浏览器打开公开链接。"]
    D2Entry --> D2S1
    D2S2["2. 系统显示 Board 加载状态，并校验公开访问策略。"]
    D2S1 --> D2S2
    D2S3["3. 系统加载成功后展示 Board 标题、画布内容、同步状态和允许查看的 Header<br/> 入口。"]
    D2S2 --> D2S3
    D2S4["4. 链接带有视角参数时，系统打开到对应画布视角。"]
    D2S3 --> D2S4
    D2S5["5. public visitor 可以平移、缩放、查看组件内容、同步状态和在线状态。"]
    D2S4 --> D2S5
    D2S6["6. public visitor 尝试创建、编辑、删除、改变分享范围或执行成员级操作时<br/>，系统阻止并提示登录、加入空间或无权限。"]
    D2S5 --> D2S6
    D2S7["7. 用户登录后，系统按其 Team、Room 或 Board 身份重新判断 Membe<br/>r/Visitor 权限，并刷新可见入口。"]
    D2S6 --> D2S7
    D2Alt{"备选：1. Board 已改为非公开时，系统展示无权限或登录/申请访问入口。；2. 链接带有视<br/>角参数时，系统打开到对应画布视角。"}
    D2S7 --> D2Alt
    D2Err{"异常：1. Board 不存在、已删除或无权访问时，系统提示并提供返回入口。"}
    D2S7 --> D2Err
    D2Perm["权限/可见性：1. Board Owner：可以进入 Board、编辑内容、管理标题和内容生命周期，并<br/>可在当前 Board、Room、Team 权限允许范围内管理分享范围、删除、移动、复制等<br/>高风险操作。；2. Board Admin：可以编辑内容并使用多数协作入口；涉及可见范围<br/>、删除、移动、备份恢复等管理动作时，需要具备对应 Room/Team/Board 管理权<br/>限。；3. Board Member：可以在有编辑权限的 Board 中创建、修改、移动<br/>、复制和删除自己可操作的内容；不默认拥有权限策略和 Board 生命周期管理能力。；4.<br/> Board Visitor：可以查看允许访问的内容，使用平移、缩放、查看同步状态和在线<br/>状态等查看能力；不能创建、编辑、删除或改变分享范围。；5. Public visitor<br/>：通过公开链接进入时只能获得公开策略允许的查看能力；如需要保存、编辑、加入协作或访问非公<br/>开 Board，系统应引导登录、加入空间或提示无权限。"]
    D2S7 --> D2Perm
  end
```

