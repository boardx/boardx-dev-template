# BoardX 界面-操作-结果清单

本文档用于回答三个问题：

1. BoardX 当前有哪些用户可见界面。
2. 每个界面能看到哪些主要内容和操作。
3. 操作后系统应给出什么可见结果。

本文档不描述视觉设计、布局细节、样式、组件实现、接口实现或测试选择器。它作为 Use Cases 的界面索引，帮助从用户视角完整推导交互范围。

## 覆盖口径

- 产品路由界面：`53` 个。来源为 `boardx-web/src/app/[language]/**/page.tsx`，不包含开发演示页 `components-demo`。
- Board 内部子界面：Board 是单一路由，但包含 Header、Board Menu、Widget Menu、Context Menu、Canvas、协作状态、Board Chat、Board Memory 等多个用户可见操作区，因此单独列出。
- 当前不可见或未接入的能力不能写成可操作入口；只在界面实际展示入口时才可作为当前用户操作。

## Auth / Invite

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| 注册页 | `/sign-up` | 邮箱、密码、确认密码、姓名、邮箱注册按钮、Google/Facebook 第三方入口、跳转登录入口 | 输入注册信息、提交、切换到登录、使用第三方注册 | 成功后进入登录后流程或展示成功反馈；失败时显示字段错误或注册失败 | `auth/uc-auth-001-email-register.md` |
| 登录页 | `/signin` | 邮箱、密码、登录按钮、忘记密码、注册入口、Google/Facebook/Wechat 登录入口 | 输入账号密码、登录、跳转忘记密码、第三方登录 | 成功后进入应用；失败时显示账号、密码或第三方登录失败反馈 | `auth/uc-auth-002-email-login.md`, `auth/uc-auth-003-social-login.md` |
| 微信登录回调页 | `/signin/wechat-callback` | 登录处理中状态 | 等待回调处理 | 成功后进入应用；失败时回到登录或展示错误 | `auth/uc-auth-003-social-login.md` |
| 忘记密码页 | `/forgot-password` | 邮箱输入框、发送重置入口 | 输入邮箱并提交 | 成功后提示重置邮件已发送；失败时提示邮箱或发送错误 | `auth/uc-auth-004-forgot-reset-password.md` |
| 修改密码页 | `/password-change` | 新密码、确认密码、提交按钮 | 输入并提交新密码 | 成功后提示密码已更新；失败时展示链接无效、过期或密码错误 | `auth/uc-auth-004-forgot-reset-password.md`, `auth/uc-auth-006-change-password.md` |
| 邮箱确认页 | `/confirm-email` | 邮箱确认加载、成功或失败状态 | 打开确认链接 | 成功后确认账号邮箱；失败时提示确认失败并引导返回 | `auth/uc-auth-005-confirm-email.md` |
| 新邮箱确认页 | `/confirm-new-email` | 新邮箱确认加载状态 | 打开新邮箱确认链接 | 成功后更新邮箱并返回个人资料或首页；失败时提示确认失败 | `auth/uc-auth-005-confirm-email.md`, `profile/uc-profile-002-edit-profile.md` |
| 邀请接受页 | `/invite/[hash]` | 邀请处理加载、登录/注册跳转、失败状态 | 打开邀请链接、登录/注册后继续处理 | Team 邀请进入团队房间列表；Room 邀请进入房间；失败时不加入并显示失败出口 | `invite/uc-invite-001-accept-invite-link.md`, `team/uc-team-004-join-by-invite.md` |

## Home / Recent / Common

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| 入口页 | `/` | 语言环境下的应用入口或跳转状态 | 访问根路径 | 进入当前语言应用入口或登录后默认页面 | `home-page/uc-home-001-view-dashboard.md` |
| Home Agent 工作台 | `/home` | Agent 分组、我的订阅、团队推荐、BoardX 推荐功能、快捷对话、更多入口、继续上次对话入口 | 搜索 Agent、点击快捷对话、打开更多、启动推荐功能、继续上次对话 | 进入 AVA 对话、AI Store、推荐功能或展示空状态 | `home-page/uc-home-001-view-dashboard.md`, `uc-home-005-search-agents.md`, `uc-home-006-start-agent-quick-chat.md`, `uc-home-007-start-recommended-feature.md`, `uc-home-008-continue-last-chat.md` |
| Recent 页面 | `/recent` | `Recent Activity` 标题、`This page is under development.` 提示 | 查看当前页面、离开页面 | 当前不展示最近资源列表、筛选、排序或打开操作 | `home-page/uc-home-004-view-recent-page.md` |
| 全局搜索面板 | 全局入口 | 搜索输入框、Rooms / Boards 分类结果 | 输入关键词、切换分类、点击结果 | 打开对应 Room 或 Board；无结果显示空状态 | `common/uc-common-001-global-search.md` |
| 语言切换 | 全局菜单 | 当前语言入口、可选语言 | 选择语言 | 页面切换到对应语言路径或刷新文案 | `common/uc-common-002-switch-language.md` |
| 主题切换 | 全局菜单 | 当前主题入口、主题选项 | 切换主题 | 页面颜色主题更新并保留用户选择 | `common/uc-common-003-switch-theme.md` |
| 反馈弹窗 | 全局反馈入口 | 标题、文本输入、附件入口、提交按钮 | 输入反馈、上传附件、提交 | 成功提示或失败提示；提交中显示加载 | `feedback/uc-feedback-001-submit-feedback.md`, `common/uc-common-004-submit-feedback-with-attachment.md` |

## AVA / Chat

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| AVA 默认页 | `/ava` | 新建聊天、线程列表、Agent 选择、消息区、输入框、附件、语音/工具入口 | 新建线程、选择 Agent、输入消息、发送、上传附件、语音输入 | 消息进入加载状态并展示 AI 回复；失败时保留输入或显示错误 | `ava/uc-ava-001-start-chat.md`, `uc-ava-007-attach-files-to-chat.md`, `uc-ava-008-use-voice-input.md` |
| AVA Home | `/ava/home` | AVA 工作入口、推荐或历史入口 | 选择入口、打开线程 | 进入对应聊天页或展示空状态 | `ava/uc-ava-001-start-chat.md`, `uc-ava-002-manage-chat-threads.md` |
| AVA 新聊天 | `/ava/chat` | 空线程、Agent 选择、输入框 | 选择 Agent、输入并发送 | 创建线程并展示消息流 | `ava/uc-ava-001-start-chat.md` |
| AVA 线程页 | `/ava/[chatId]` | 线程标题、消息列表、消息操作、输入区、分享入口 | 继续发送、复制消息、编辑/删除允许的消息、分享聊天、打开 Deep Research | 消息更新、线程分享链接生成、报告面板打开或错误提示 | `ava/uc-ava-002-manage-chat-threads.md` 到 `uc-ava-010-react-copy-and-use-message.md` |
| 公开分享对话页 | `/chatShare/[threadId]` | 只读消息列表、分享标题、附件预览、Deep Research 报告面板 | 滚动查看、复制代码、预览附件、打开/关闭报告 | 只读查看内容；不展示输入框，不修改原线程 | `share/uc-share-001-view-shared-chat.md` |

## AI Store

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| AI Store 默认页 | `/aistore` | AI Store 导航或默认跳转 | 进入默认 Store 页面 | 跳转或展示探索内容 | `ai-store/uc-ai-store-001-browse-items.md` |
| AI Store 探索页 | `/aistore/explore` | 搜索框、数量、类型 Tab、标签、项目卡片、详情弹窗 | 搜索、筛选、切换类型、打开详情、订阅/使用项目 | 列表刷新、详情打开、订阅状态更新或失败提示 | `ai-store/uc-ai-store-001-browse-items.md`, `uc-ai-store-003-subscribe-use-item.md` |
| AI Store 创建页 | `/aistore/create` | 创建/编辑表单、项目类型、名称、描述、配置、保存入口 | 填写、保存、更新、取消 | 成功创建/更新；失败显示校验或保存错误 | `ai-store/uc-ai-store-002-create-update-item.md` |
| AI Store 订阅页 | `/aistore/subscribe` | 已订阅项目列表、空状态、项目操作 | 查看订阅、打开详情、使用或取消订阅 | 订阅列表或状态更新 | `ai-store/uc-ai-store-003-subscribe-use-item.md` |
| AI Store 分享页 | `/aistore/share/[token]` | 分享项目详情、可访问状态 | 打开分享链接、查看/订阅/使用允许的项目 | 展示项目或无效分享状态 | `ai-store/uc-ai-store-005-share-management.md` |

## Team

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| Team 默认页 | `/team` | Team 模块入口或重定向 | 进入 Team | 跳转到 Team Home 或当前团队页面 | `team/uc-team-002-view-switch-team.md` |
| Team Home | `/team/home` | 团队统计、成员/AI 工具/待处理/Token 数据、快捷管理入口 | 查看统计、进入 General/Credits/Member/Memory/Knowledge Base/Store | 进入对应团队管理页 | `team/uc-team-008-view-team-home.md` |
| Team General | `/team/general` | 团队名称、基础设置、删除/更新入口 | 修改团队信息、保存、删除团队 | 成功后刷新团队信息；失败显示错误 | `team/uc-team-006-update-delete-team.md`, `uc-team-007-manage-team-general-settings.md` |
| Team Member | `/team/member` | 成员列表、邀请入口、角色、Token 权限 | 邀请成员、修改角色、移除成员、调整 Token 权限 | 成员列表和权限状态更新；owner 受保护 | `team/uc-team-003-invite-members.md`, `uc-team-005-manage-members.md` |
| Team Credits | `/team/credits` | 团队钱包、购买入口、记录入口 | 查看余额、购买 Credit、查看记录 | 打开支付/记录弹窗，余额或记录刷新 | `credits/uc-credits-001-view-wallet.md`, `uc-credits-002-purchase-credits.md`, `uc-credits-003-view-credit-records.md`, `billing/uc-billing-001-upgrade-plan.md` |
| Team Memory | `/team/memory` | 团队 Memory 列表、搜索、添加、删除 | 搜索、添加、删除 Memory | 列表和数量更新，失败显示错误 | `team/uc-team-009-manage-team-memory.md` |
| Team Knowledge Base | `/team/knowledge-base` | 文件列表、上传、搜索、刷新、下载、删除、加载更多 | 上传文件、搜索、刷新、下载、删除 | 队列状态、文件状态、列表更新或失败反馈 | `knowledge-base/uc-kb-001-upload-file.md` 到 `uc-kb-004-use-file-in-ai-context.md` |
| Team AI Store Explore | `/team/aistore-explore` | 团队上下文 AI Store 探索内容 | 搜索、筛选、查看、订阅/使用 | 展示团队范围内容和操作结果 | `team/uc-team-010-view-team-ai-store.md`, `ai-store/uc-ai-store-001-browse-items.md` |
| Team AI Store Subscribe | `/team/aistore-subscribe` | 团队已订阅项目 | 查看、打开、使用订阅项目 | 订阅内容展示或空状态 | `team/uc-team-010-view-team-ai-store.md` |
| Team AI Store Approval | `/team/aistore-approval` | 团队审核项目 | 查看、批准/拒绝或处理团队审核项 | 审核状态更新或失败反馈 | `team/uc-team-010-view-team-ai-store.md`, `ai-store/uc-ai-store-006-approval-featured.md` |
| 创建问卷 | `/team/create-survey` | 问卷编辑器、题目、选项、高级设置、预览、保存 | 创建题目、编辑选项、预览、保存 | 生成问卷或显示校验/保存失败 | `survey/uc-survey-001-create-survey.md` |
| 我的问卷 | `/team/my-surveys` | 当前用户问卷列表 | 查看、编辑、分享、启停、查看报告 | 问卷状态或报告面板更新 | `survey/uc-survey-002-list-manage-surveys.md` 到 `uc-survey-006-publish-unpublish-survey.md` |
| 团队问卷 | `/team/team-surveys` | 团队范围问卷列表 | 查看、编辑、分享、启停、查看报告 | 团队问卷状态或报告更新 | `survey/uc-survey-002-list-manage-surveys.md` 到 `uc-survey-006-publish-unpublish-survey.md` |

## Room / Room Chat / Survey

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| Room 默认页 | `/room` | Room 入口或重定向 | 进入 Room 模块 | 跳转最近或默认房间视图 | `room/uc-room-002-view-search-room.md` |
| 最近 Room | `/room/recent` | Room 列表、搜索、最近 Board、刷新、网格/列表切换 | 搜索 Room、打开 Room、打开 Board、切换视图、刷新 | 列表刷新、进入房间或 Board | `room/uc-room-002-view-search-room.md`, `board/uc-board-003-list-search-recent-board.md` |
| 收藏 Room | `/room/favorite` | 收藏房间列表、空状态 | 查看、打开收藏房间 | 进入房间或显示空状态 | `room/uc-room-002-view-search-room.md` |
| Room 详情 | `/room/[roomId]` | 房间标题、房间内容、Board 列表、成员/文件/聊天/Studio/Survey 入口 | 创建/打开 Board、管理成员、查看文件、进入 Chat/Studio/Survey | 房间内容、Board 或子功能界面更新 | `room/uc-room-001-create-room.md` 到 `uc-room-007-view-room-surveys.md` |
| Room Chat | `/room/[roomId]/chat/[chatId]` | 房间聊天消息、输入区、文件入口、只读状态 | 发送消息、上传/删除文件、打开已有聊天 | 消息追加、文件状态更新；他人线程只读时禁用发送 | `room-chat/uc-room-chat-001-create-chat.md` 到 `uc-room-chat-004-delete-chat.md` |
| 问卷答题页 | `/survey/answer/[surveyId]` | 问卷标题、问题、选项/输入、提交入口 | 填写答案、提交 | 成功提交或展示必填/格式错误 | `survey/uc-survey-003-answer-survey.md` |

## Board 路由界面

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| Board 页面 | `/board/[boardId]` | Canvas、Header、Board Menu、Widget Menu、Context Menu、协作者、Board Chat、计时器 | 查看/编辑画布、创建组件、协作、分享、导出、聊天、撤销重做 | 画布、菜单状态、协作状态、分享状态、导出/聊天结果更新 | `board/`, `board/header/`, `board/board-menu/`, `board/widget-menu/`, `board/context-menu/`, `board/canvas/`, `board/widgets/` |
| Board Header | `/board/[boardId]` 内部 | 返回、标题、撤销/重做、语音、同步状态、在线用户、分享、跟随、计时器、Slides、更多菜单 | 改标题、分享、计时、Slides、备份、快捷键、设置、语言、登出 | Header 状态、弹窗、面板或画布状态更新 | `board/header/uc-board-header-001-use-board-header.md` 到 `uc-board-header-015-export-board-pdf.md` |
| Board Menu | `/board/[boardId]` 内部 | 选择、平移、便利贴、手绘、文本、连接线、形状、资源、模板 | 切换工具、创建便利贴/文本/形状/连接线/手绘、打开资源/模板 | 工具高亮、光标变化、组件创建或面板打开 | `board/board-menu/uc-board-menu-001-use-board-menu.md` 到 `uc-board-menu-012-erase-drawing-content.md` |
| Canvas | `/board/[boardId]` 内部 | 无限画布、组件、选中框、缩放控件、协作光标 | 平移、缩放、选择、多选、键盘操作、复制粘贴、撤销重做 | 视角、选中状态、组件状态或同步状态更新 | `canvas/`, `board/canvas/` |
| Widget Menu | `/board/[boardId]` 内部 | 选中组件附近的悬浮菜单 | 改样式、锁定/解锁、删除、裁剪、下载、AI、对齐、整理、连接线样式 | 组件属性、锁定状态、文件处理或布局更新 | `board/widget-menu/uc-widget-menu-001-use-widget-menu.md` 到 `uc-widget-menu-014-convert-text-to-sticky-notes.md` |
| Context Menu | `/board/[boardId]` 内部 | 右键菜单项 | 复制/剪切/粘贴、层级、编组、锁定、导出、保存模板 | 剪贴板、对象层级、对象状态、导出或模板创建结果更新 | `board/context-menu/uc-context-menu-001-use-context-menu.md` 到 `uc-context-menu-006-save-as-template.md` |
| Board Chat | `/board/[boardId]` 内部 | Chat AI 浮动按钮、聊天侧栏、线程、输入区 | 打开侧栏、发送消息、切换/新建聊天、调整侧栏宽度 | AI 回复、线程状态或侧栏状态更新 | `board/board-menu/uc-board-menu-010-use-board-ai-assist.md`, `board/local-workspace/uc-local-002-use-local-model-chat-tools.md` |
| Board Memory | `/board/[boardId]` 内部 | Memory 列表、搜索、添加、删除 | 搜索、添加、删除记忆 | Memory 列表和数量更新 | `board/local-workspace/uc-local-003-use-board-memory.md` |

## Admin

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| Admin 默认页 | `/admin-panel` | Admin 导航或默认内容 | 进入后台 | 跳转或展示后台首页 | `admin/uc-admin-005-view-admin-home.md` |
| Admin Home | `/admin-panel/home` | 管理模块卡片、统计、导航 | 查看统计、进入 Users/Teams/Store | 打开对应后台页面 | `admin/uc-admin-005-view-admin-home.md` |
| Admin Users | `/admin-panel/users` | 用户表格、筛选、搜索、创建入口 | 搜索/筛选用户、打开用户、创建用户 | 表格刷新、进入创建/详情 | `admin/uc-admin-001-manage-users.md` |
| Admin Create User | `/admin-panel/users/create` | 创建用户表单 | 输入用户信息、保存 | 用户创建成功或失败提示 | `admin/uc-admin-001-manage-users.md` |
| Admin Edit User | `/admin-panel/users/edit/[id]` | 用户详情/编辑表单 | 查看/编辑用户信息 | 用户信息更新或失败提示 | `admin/uc-admin-001-manage-users.md` |
| Admin Teams | `/admin-panel/teams` | Team 表格、筛选、团队类型、Credit 操作 | 搜索/筛选团队、编辑类型、手动增加 Credit | 团队类型或 Credit 状态更新 | `admin/uc-admin-002-manage-teams.md` |
| Admin Store Explore | `/admin-panel/aistore-explore` | 平台 AI Store 浏览 | 搜索、筛选、查看项目 | 列表或详情展示 | `ai-store/uc-ai-store-001-browse-items.md` |
| Admin Store Approval | `/admin-panel/aistore-approval` | 待审核 AI Store 项目 | 搜索、查看、批准、撤销批准 | 审核状态更新 | `admin/uc-admin-003-ai-store-approval.md` |
| Admin Store Featured | `/admin-panel/aistore-featured` | 已审核项目、精选状态 | 搜索、切换精选星标 | 精选状态更新 | `admin/uc-admin-004-featured-ai-store.md` |

## Profile / Knowledge / Credits / Billing / Studio

| 界面 | 路径 | 主要可见内容 | 主要操作 | 操作后可见结果 | 对应 Use Cases |
| --- | --- | --- | --- | --- | --- |
| Profile 查看 | `/profile` | 头像、姓名、邮箱、编辑入口 | 查看资料、进入编辑 | 展示资料或跳转编辑页 | `profile/uc-profile-001-view-profile.md` |
| Profile 编辑 | `/profile/edit` | 个人信息、改密码、改邮箱表单 | 编辑姓名/头像、改密码、改邮箱 | 成功提示、错误提示或新邮箱确认流程 | `profile/uc-profile-002-edit-profile.md` |
| 用户菜单 | 全局菜单 | 个人资料、Memory、邀请、Credit/升级、语言、主题、退出 | 打开对应页面、切换设置、退出登录 | 页面跳转、设置更新或退出登录 | `profile/uc-profile-003-manage-user-menu.md` |
| Personal Knowledge Base | `/personal/knowledge-base` | 个人文件列表、上传、搜索、刷新、下载、删除 | 上传、搜索、刷新、下载、删除 | 文件队列、状态、列表更新或失败提示 | `knowledge-base/uc-kb-001-upload-file.md` 到 `uc-kb-004-use-file-in-ai-context.md` |
| Credit 钱包/记录 | 用户菜单或 Team Credits | 余额、充值入口、记录弹窗 | 查看余额、购买、查看记录 | 支付弹窗、记录列表或余额更新 | `credits/`, `billing/` |
| 扫码支付 | 支付弹窗 | 二维码、订单状态、关闭入口 | 扫码支付、关闭弹窗 | 支付成功后余额/计划更新；未支付保持订单未完成 | `billing/uc-billing-002-scan-payment.md` |
| Room Studio | Room 内部或 Studio 入口 | 音频、演示文稿、信息图工具 | 选择工具、输入内容、生成制品 | 生成 PPTX/预览卡/制品结果或失败提示 | `studio/uc-studio-001-generate-artifact.md`, `presentations/uc-presentations-001-generate-presentation.md`, `uc-presentations-002-revise-presentation.md` |

## 非产品功能界面

| 界面 | 路径 | 处理方式 |
| --- | --- | --- |
| Components Demo | `/components-demo` | 开发演示页，不计入产品 Use Case 覆盖范围，不作为用户业务界面。 |

## Use Case 准确性要求

每个 Use Case 的主流程必须能回答：

1. 用户进入哪个界面或子界面。
2. 用户能看到哪些主要内容、状态、控件或空状态。
3. 用户能执行哪些操作。
4. 操作后系统显示什么结果、状态变化或失败反馈。
5. 当前界面没有展示的入口，不能写成可操作能力。

如果一个 Use Case 不能从主流程推导出以上五点，应补充或改写该 Use Case。
