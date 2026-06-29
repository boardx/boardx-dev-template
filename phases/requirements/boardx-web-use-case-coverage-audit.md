# BoardX Web Use Cases 覆盖审计

本文档用于回答：`boardx-web` 中用户可见界面能力是否已经映射到 `docs/cn/use-cases`。

结论：当前已按 `boardx-web` 可确认的产品功能入口完成一轮覆盖补齐，`docs/cn/use-cases` 现有 168 个 `uc-*.md` 已纳入索引与覆盖说明。不能把 demo/test/纯技术 API 路由视为业务 Use Case。后续新增页面、菜单或用户可见组件时，必须同步增加或更新对应 Use Case。

## 确认方式

已确认来源：

- `boardx-web/src/app/[language]/**/page.tsx`：确认用户可访问页面路由，包括 Auth、Home、Recent、Profile、Team、Room、Board、AVA、AI Store、Admin、Survey、Knowledge Base。
- `boardx-web/src/boardApp/boardHeader/`：确认 Board Header 中返回、标题、分享、计时器、Slides、语音录制/转写、同步状态、撤销/重做、更多菜单、备份、设置、快捷键、欢迎引导等入口。
- `boardx-web/src/boardApp/boardMenu/`：确认 Board Menu 当前渲染选择、平移、便签、画笔、文本、连接线、形状、资源、模板入口；`MenuChart.tsx` 存在，但 `MenuBar.tsx` 当前未渲染 `MenuChart`。
- `boardx-web/src/boardApp/widgetMenu/`：确认选中组件后的颜色、字体、字号、字重、对齐、线宽、锁定、裁剪、下载、删除、刷新、格式刷、连接线样式、文本转便签、AI 工具等入口。
- `boardx-web/src/boardApp/contextMenu/`：确认右键菜单、位置计算、菜单配置、模板创建弹窗。
- `boardx-web/src/boardApp/canvas/` 与 `boardx-web/src/boardApp/widgets/`：确认 Canvas 初始化、快捷键、缩放/视口、对齐辅助线、锁定、分组、层级、文件、XConnector、XTextbox、XActiveSelection 等 CanvasX 对象能力。
- `boardx-web/src/components/features/dashboard/rooms/`：确认 Room 列表、创建、Header、成员、邀请、设置，以及 Board、Chat、Files、Studio、Survey Tabs。
- `boardx-web/src/components/ava/`、`boardx-web/src/components/aistore/`、`boardx-web/src/components/features/knowledge-base/`、`boardx-web/src/components/credits/`：确认 AVA、AI Store、知识库、Credits 的页面组件与用户入口。
- `boardx-web/src/redux/services/*.ts`：只用于确认业务对象和状态变化边界，例如 Board、Widget、Slides、Room、Room Chat、Team、AI Store、Credits、Presentations、Studio、Deep Research；Use Case 不直接写接口路径。
- `boardx-web/cypress/e2e/1-auth/*.cy.ts` 与 `signupshadcn.cy.ts`、`siginshadcn.cy.ts`：确认 Auth 与 Profile 的表单、错误状态、跳转和验证路径。

线上验证结果：

- `https://app.boardx.com.cn/cn` 通过 HTTP 访问返回 `200`，线上 HTML 标题为 `BoardX`，并加载 `app/[language]/page-*.js` 构建资源。
- `https://app.boardx.com.cn/cn/admin-panel/home`、`/cn/team/credits`、`/cn/team/knowledge-base`、`/cn/personal/knowledge-base`、`/cn/chatShare/test-thread` 通过 HTTP 访问返回 `200`，可确认线上路由存在。
- `/cn/team/knowledge-base` 的线上 HTML 标题为 `Team Knowledge Base - BoardX`，`/cn/personal/knowledge-base` 的线上 HTML 标题为 `Personal Knowledge Base - BoardX`。
- 浏览器自动化打开线上页面时在导航阶段超时，且没有可用登录态；本轮不能把登录后点击、上传、支付、后台审批或真实分享内容加载作为已验证事实。

未确认或受限来源：

- 线上注册或登录测试账号尚未创建/使用；原因是当前浏览器自动化会话无法稳定完成页面加载和表单交互，且本轮未获得登录凭据。
- 本地 `.env.local` 可确认 `boardx-web` 本地 API 指向 `http://localhost:9900/api`，`boardx-backend` 本地端口为 `9900`；但后端依赖外部数据库/缓存等运行条件，本轮没有把本地全链路启动成功作为 Use Case 事实来源。
- 本文档不记录环境变量中的密钥、数据库地址、第三方凭据等敏感信息。

## 覆盖原则

纳入 Use Case：

- 用户可直接访问的页面路由。
- 用户可点击、输入、选择、拖拽、上传、下载、分享、订阅、审批、管理的界面能力。
- 不同角色下可见性或权限不同的入口。
- 会改变业务状态、协作状态、文件状态、AI 会话状态或支付/订阅状态的操作。

不单独纳入 Use Case：

- `components-demo`、测试页面、debug 组件。
- 纯 API route、proxy、logging route，除非它背后有明确用户目标，例如导出 PDF、下载文件。
- 纯展示性 icon、loading、skeleton、table 基础组件。
- Redux slice、service、Yjs、数据库、存储、HTTP 细节。

## 路由覆盖

| boardx-web 路由/区域 | Use Case 目录 |
| --- | --- |
| `sign-up`、`signin`、`forgot-password`、`confirm-email`、`password-change`、`wechat-callback` | `auth/` |
| `home`、`recent` | `home-page/` |
| `profile`、`profile/edit`、用户菜单、个人 Memory | `profile/` |
| `invite/[hash]`、邀请好友 | `invite/` |
| `team/home`、`team/general`、`team/member` | `team/` |
| `team/credits`、升级计划、扫码支付 | `credits/`、`billing/`；当前 Team Credits 管理页只对 Team Owner/Admin 展示钱包、流水和购买，Team Member 显示无权限 |
| `team/knowledge-base`、`personal/knowledge-base` | `knowledge-base/`；线上路由和页面标题已确认，登录后列表/上传仍未线上交互确认 |
| `team/memory` | `team/uc-team-009-manage-team-memory.md` |
| `team/create-survey`、`team/my-surveys`、`team/team-surveys`、`survey/answer` | `survey/` |
| `team/aistore-*`、`aistore/*` | `ai-store/`、`team/uc-team-010-view-team-ai-store.md` |
| `admin-panel/*` | `admin/`、`ai-store/` |
| `room/recent`、`room/favorite`、`room/[roomId]` | `room/` |
| Room Chat Tab | `room-chat/` |
| Room Files Tab | `room/uc-room-005-manage-room-files.md` |
| Room Studio Tab | `room/uc-room-006-use-room-studio.md`、`presentations/`、`studio/` |
| Room Survey Tab | `room/uc-room-007-view-room-surveys.md`、`survey/` |
| `board/[boardId]` | `board/` 及其子目录 |
| `ava/*`、`chatShare/[threadId]` | `ava/`、`share/`；公开分享路由已确认，真实 thread 内容需有效分享链接确认 |
| 全局搜索、语言、主题、反馈 | `common/`、`feedback/` |

## Use Case 目录覆盖

| 目录 | 当前用例数 | 覆盖状态 |
| --- | ---: | --- |
| `admin/` | 5 | 已覆盖后台首页、用户、Team、AI Store 审核与精选 |
| `ai-store/` | 6 | 已覆盖浏览、创建维护、订阅使用、收藏、共享管理、审核精选 |
| `auth/` | 6 | 已覆盖注册、登录、社交登录、找回密码、邮箱确认、修改密码 |
| `ava/` | 10 | 已覆盖聊天主流程、线程、消息、分享、Deep Research、设置、附件、语音、建议动作 |
| `billing/` | 2 | 已覆盖升级计划、扫码支付 |
| `board/` | 77 | 已覆盖 Board 核心与全部 Board 子模块目录 |
| `canvas/` | 5 | 已覆盖通用画布导航、编辑、复制粘贴、撤销重做、实时协作 |
| `common/` | 4 | 已覆盖全局搜索、语言、主题、带附件反馈入口 |
| `credits/` | 3 | 已覆盖钱包、购买积分、积分记录 |
| `feedback/` | 1 | 已覆盖反馈提交 |
| `home-page/` | 8 | 已覆盖 Home Page、Agent 搜索、Agent 快速对话、推荐功能、最近 Board、Onboarding、最近页面 |
| `invite/` | 2 | 已覆盖接受邀请链接、邀请好友 |
| `knowledge-base/` | 4 | 已覆盖上传、列表下载、删除、AI 上下文引用 |
| `presentations/` | 2 | 已覆盖生成与修订演示文稿 |
| `profile/` | 4 | 已覆盖查看/编辑资料、用户菜单、个人 Memory |
| `room/` | 7 | 已覆盖 Room 创建、查看搜索、成员、更新删除、文件、Studio、问卷 |
| `room-chat/` | 4 | 已覆盖创建、列表打开、发送、删除 |
| `share/` | 1 | 已覆盖共享聊天只读访问 |
| `studio/` | 1 | 已覆盖 Artifact 生成 |
| `survey/` | 6 | 已覆盖创建、列表管理、答题、报告、模板、发布下线 |
| `team/` | 10 | 已覆盖创建、切换、邀请加入、成员、设置、首页、Memory、Team AI Store |

## Board 覆盖

| boardx-web 区域 | Use Case 目录/文件 |
| --- | --- |
| Board 打开、创建、列表、收藏、移动、复制、删除 | `board/uc-board-*.md` |
| Board 公开/私有访问、加入公开 Board | `board/access/` |
| Header 基础入口、标题、分享、计时器、Slides、语音转写、备份 | `board/header/uc-board-header-001` 到 `007` |
| Header 返回、同步状态、撤销重做、快捷键、设置、欢迎引导、统计、PDF 导出 | `board/header/uc-board-header-008` 到 `015` |
| Board Menu：选择、便签、文本、形状、连接线、画笔、资源、模板；图表/File/Link/AI Assist 实现文件存在但当前主菜单未渲染 | `board/board-menu/uc-board-menu-001` 到 `010` |
| Board Menu：链接、橡皮擦；链接入口当前主菜单未渲染，橡皮擦由画笔/擦除模式相关逻辑确认 | `board/board-menu/uc-board-menu-011`、`012` |
| Canvas：缩放、迷你地图、对齐线、键盘、多选 | `board/canvas/` |
| Collaboration：Yjs 同步、在线用户、跟随协作者 | `board/collaboration/` |
| Context Menu：复制粘贴、层级、组合锁定、导出选区、保存模板 | `board/context-menu/` |
| Widget Menu：样式、锁定、裁剪、下载、语音转文字、AI | `board/widget-menu/uc-widget-menu-001` 到 `007` |
| Widget Menu：删除、刷新、格式刷、对齐、连接线样式、文本样式、文本转便签 | `board/widget-menu/uc-widget-menu-008` 到 `014` |
| CanvasX Widgets：总括、文件、便利贴、形状、连接线、画笔、文本、图片、多选/组合对象；图表实现文件存在但当前主菜单入口未确认显示 | `board/widgets/uc-widgets-001` 到 `010` |
| Board Memory、本地 Workspace、本地模型/Chat/工具 | `board/local-workspace/` |

## AVA 覆盖

| boardx-web 区域 | Use Case 目录/文件 |
| --- | --- |
| 开始聊天、线程管理、编辑删除消息、分享聊天、Deep Research | `ava/uc-ava-001` 到 `005` |
| 模型/AI 设置、附件、语音输入、建议动作、消息操作 | `ava/uc-ava-006` 到 `010` |
| 分享聊天只读访问 | `share/` |

## 仍需人工复核的边界

以下区域已纳入大类或已补 Use Case，但建议后续结合实际产品决策再细分：

1. AI Store DevTool 内 Agent、Tool、Template、Image Tool 的创建/预览/更新流程目前由 `ai-store/uc-ai-store-002-create-update-item.md` 覆盖；如果这些在产品上是独立创建器，应拆成子目录。
2. Board Slides 目前作为 Header 子用例覆盖；如果 Slides 具有完整演示编辑器，应继续拆分 Capture、Download、Presentation Control。
3. Deep Research 已有主用例，但专家选择、澄清问题、报告查看、时间线等可以继续按用户目标拆细。
4. 纯 API route 如 `proxy-image`、`datadog/log` 不作为独立 Use Case；`export-pdf` 已因用户目标“导出 PDF”纳入。
5. `components-demo`、debug/test 页面不作为产品 Use Case。
6. Admin Panel、Team Credits、Knowledge Base 上传/删除/下载、扫码支付、演示文稿生成和真实 ChatShare 内容均已由 `boardx-web` 代码入口确认，但因本轮无线上登录态，未完成线上登录后交互验证。

## 防遗漏规则

新增或修改 `boardx-web` 以下任一内容时，必须检查是否需要同步 Use Case：

- 新增 `src/app/[language]/**/page.tsx`。
- 新增 Board Header、Board Menu、Widget Menu、Context Menu 的用户入口。
- 新增 Team、Room、Survey、AI Store、AVA、Knowledge Base、Billing 的页面或弹窗。
- 新增角色权限差异。
- 新增会改变业务状态的用户操作。
