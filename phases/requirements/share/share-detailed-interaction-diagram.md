# Share 详细交互图

本图按 Share 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Link["用户打开公开分享链接"] --> Validate["系统校验分享状态"]
  Validate --> Invalid["显示链接无效、过期或无权限"]
  Validate --> Readonly["展示只读内容"]
  Readonly --> Scroll["滚动查看消息或内容"]
  Readonly --> Preview["预览附件或报告"]
  Readonly --> Copy["复制允许复制的内容"]
  Readonly --> NoEdit["不展示输入、编辑或删除入口"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["查看公开分享对话"]
    D1Start["Actor：访客、注册用户"]
    D1Entry["可见入口/区域：公开分享对话链接。；公开分享对话页面 > Loading chat session <br/>状态。；公开分享对话页面 > 消息列表。；公开分享对话页面 > Deep Resea<br/>rch 报告详情面板。"]
    D1Start --> D1Entry
    D1S1["1. 用户在浏览器中打开 /chatShare/（threadId） 分享链接，链接中可<br/>以带 shareToken。"]
    D1Entry --> D1S1
    D1S2["2. 系统识别 threadId 和 shareToken，并加载公开分享数据。"]
    D1S1 --> D1S2
    D1S3["3. 系统加载期间展示 Loading chat session 或加载中状态；如果 t<br/>hreadId 缺失，展示 Invalid chat session 和 chat ID<br/> 缺失提示。"]
    D1S2 --> D1S3
    D1S4["4. 系统展示分享页头部，标题使用原聊天标题或默认分享标题；如果存在 AI Agent <br/>描述，页头显示 AI 头像和描述。"]
    D1S3 --> D1S4
    D1S5["5. 系统按时间顺序展示只读消息列表，消息使用聊天消息组件渲染，可包含用户消息、AI 回<br/>复、Markdown、代码块、图片、音频、PPTX 预览或公开附件。"]
    D1S4 --> D1S5
    D1S6["6. 分享页底部展示 Shared chat session / Read only 提<br/>示。"]
    D1S5 --> D1S6
    D1S7["7. 用户可以滚动查看消息；对于可渲染内容，用户可以使用消息组件本身提供的只读查看能力，<br/>例如代码块复制、PPTX 翻页预览、下载公开附件或打开公开报告。"]
    D1S6 --> D1S7
    D1S8["8. 如果用户打开 Deep Research 报告，系统在右侧展示报告详情面板，并提供<br/>关闭按钮。"]
    D1S7 --> D1S8
    D1S9["9. 分享页不展示聊天输入框，不允许发送新消息、上传附件、编辑或删除原聊天内容。"]
    D1S8 --> D1S9
    D1Alt{"备选：A1：分享内容为空，系统展示聊天标题和 No messages in this chat<br/> session。；A2：Deep Research 报告未打开时，消息列表占满页面宽度<br/>；报告打开后，消息列表和报告面板分栏显示。"}
    D1S9 --> D1Alt
    D1Err{"异常：E1：分享不存在、threadId 缺失或 token 无效，系统展示无效会话或加载错误<br/>页面。；E2：分享内容加载失败，系统展示 Error loading chat sess<br/>ion 或错误边界提示。；E3：PPTX 预览链接不可用，系统提示预览链接暂时不可用，并<br/>保留下载或重新生成分享链接的建议。"}
    D1S9 --> D1Err
    D1Perm["权限/可见性：1. 拥有有效分享入口的访客、注册用户、Team Owner/Admin/Member <br/>都只能按分享权限查看公开内容。；2. 分享页是只读访问，不允许任何角色在该页面修改原线程<br/>。；3. 登录后的 Team 角色不会因为打开分享链接获得原线程管理权。；4. 系统管理<br/>员也不能通过普通公开分享链接绕过原线程的分享范围。；5. 私有内容、团队私有上下文和未公<br/>开附件不能通过公开分享入口访问。"]
    D1S9 --> D1Perm
  end
```

