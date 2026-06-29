# boardx-web 功能覆盖说明

本文档说明当前 Use Cases 主要依据 `boardx-web` 进行分析。后端只用于辅助确认角色、权限和数据边界，不能替代前端可见功能入口。

## 前端路由覆盖

`boardx-web/src/app/[language]` 中识别到的用户可见路由包括：

- 账号与身份：`sign-up`、`signin`、`signin/wechat-callback`、`forgot-password`、`password-change`、`confirm-email`、`confirm-new-email`。
- 首页与最近内容：`home`、`recent`。
- 个人中心：`profile`、`profile/edit`。
- 邀请入口：`invite/[hash]`。
- Team：`team/home`、`team/general`、`team/member`、`team/memory`、`team/credits`、`team/knowledge-base`、`team/aistore-explore`、`team/aistore-subscribe`、`team/aistore-approval`、`team/team-surveys`、`team/my-surveys`、`team/create-survey`。
- Room：`room/recent`、`room/favorite`、`room/[roomId]`、`room/[roomId]/chat/[chatId]`。
- Board：`board/[boardId]`。
- AVA：`ava/home`、`ava/chat`、`ava/[chatId]`、`ava/new`。
- AI Store：`aistore/explore`、`aistore/subscribe`、`aistore/create`、`aistore/share/[token]`。
- 知识库：`personal/knowledge-base`、`team/knowledge-base`。
- 问卷：`survey/answer/[surveyId]`、`team/team-surveys`、`team/my-surveys`、`team/create-survey`。
- Admin：`admin-panel/home`、`admin-panel/users`、`admin-panel/users/create`、`admin-panel/users/edit/[id]`、`admin-panel/teams`、`admin-panel/aistore-explore`、`admin-panel/aistore-approval`、`admin-panel/aistore-featured`。
- 公开分享：`chatShare/[threadId]`、`aistore/share/[token]`。

## boardApp 覆盖

`boardx-web/src/boardApp` 是 Board 用例拆分的主要来源：

- `boardHeader/`：返回、标题、同步状态、Undo/Redo、Follow Me、分享、更多菜单、备份、设置、快捷键、Welcome、计时器、Slides、语音录制、实时转写。
- `boardMenu/`：当前确认主菜单入口为选择、平移、便签、文本、形状、箭头/连接线、画笔、资源、图片、图标、模板；图表、文件、链接、AI Assist 有实现线索，但主菜单独立入口仍按条件入口处理。
- `widgetMenu/`：颜色、字体、字号、字重、对齐、线宽、连接线形状/端点、锁定、删除、裁剪、文件名、文件下载、音频转文本、文本转多便利贴、格式应用、刷新组件、AI Assist。
- `contextMenu/`：编辑、复制、剪切、粘贴、重复、全选、层级、分组/取消分组、锁定/解锁、复制为图片、复制为文本、下载图片、导出 Board、导出选区、保存模板、打开图片。
- `canvas/WBCanvas/`：初始化、渲染、视口、位置、组件、分组、锁定、文件、ZIndex、同步、Widget AI、自动对齐辅助线。
- `userList/`：在线用户、光标、鼠标同步、Follow Me 协作感知。
- `widgets/`：CanvasX 对象级能力，包括 `XConnector`、`XTextbox`、`XActiveSelection`、便利贴、形状、画笔、图表、图片和文件类组件。

## 前端状态与服务覆盖

`boardx-web/src/redux/features` 和 `src/redux/services` 中识别到的用户可见状态/服务包括：

- Board：`board.slice`、`widgets.slice`、`widgetMenu.slice`、`contextMenu.slice`、`board.follow.slice`、`slides.slice`、`timer.slice`、`board.api.slice`、`widget.api.slice`、`board-subscription.api.slice`、`board-backup.api.slice`、`slides.api.slice`。
- Team/Room：`team.slice`、`room.slice`、`team.api.slice`、`room.api.slice`、`room-subscription.api.slice`、`room-chat.api.slice`、`room-file.api.slice`。
- AI/AVA/AI Store：`ava.slice`、`ai.store.slice`、`ai.tool.slice`、`deepResearch.slice`、`ai-store.api.slice`、`ai-service.api.slice`、`ai-assist.api.slice`、`deep-research.api.slice`。
- Knowledge/File/Resource：`resource.slice`、`file.api.slice`、`resource.api.slice`。
- Credits/Admin/Statistics：`credit.api.slice`、`statistics.api.ts`、`user.api.slice`；Team Credits 页面当前只对 Team Owner/Admin 展示钱包、流水和购买，Team Member 显示无权限。
- Presentation/Studio：`presentations.api.slice`、`studio.api.slice`。

## 当前文档结构

- 顶层角色功能图：[top-level-role-function-diagram.md](./top-level-role-function-diagram.md)
- 模块访问权限图：[module-access-diagrams.md](./module-access-diagrams.md)
- 多角色交互图：[role-interactions.md](./role-interactions.md)
- 按角色一级模块图：[use-case-diagram.md](./use-case-diagram.md)
- 细化规范：[use-case-specification-standard.md](./use-case-specification-standard.md)
- 覆盖审计：[boardx-web-use-case-coverage-audit.md](./boardx-web-use-case-coverage-audit.md)

## 当前 Use Case 目录

当前目录共 168 个 `uc-*.md`。顶层模块与文件数如下：

| 目录 | 用例数 | 对应前端范围 |
| --- | ---: | --- |
| `auth/` | 6 | 注册、登录、社交登录、找回密码、邮箱确认、修改密码 |
| `home-page/` | 8 | Home Page、Agent 搜索、Agent 快速对话、推荐功能、最近 Board、Onboarding、最近页面 |
| `profile/` | 4 | Profile、编辑资料、用户菜单、个人 Memory |
| `team/` | 10 | Team 首页、设置、成员、Memory、Credits、AI Store |
| `room/` | 7 | Room 首页、成员、设置、文件、Studio、Survey |
| `room-chat/` | 4 | Room Chat |
| `board/` | 77 | Board 核心和 Board 子模块 |
| `canvas/` | 5 | 通用画布能力 |
| `ava/` | 10 | AVA Chat、Deep Research、附件、语音、消息操作 |
| `ai-store/` | 6 | AI Store 浏览、创建、订阅、共享、审核精选 |
| `knowledge-base/` | 4 | 个人/Team 知识库 |
| `survey/` | 6 | 问卷创建、管理、答题、报告、模板、发布 |
| `admin/` | 5 | 后台首页、用户、Team、AI Store 审核与精选 |
| `credits/` | 3 | 钱包、购买、记录 |
| `billing/` | 2 | 升级计划、扫码支付 |
| `common/` | 4 | 全局搜索、语言、主题、反馈入口 |
| `feedback/` | 1 | 反馈提交 |
| `invite/` | 2 | 邀请链接、邀请好友 |
| `presentations/` | 2 | 生成和修订演示文稿 |
| `studio/` | 1 | Artifact 生成 |
| `share/` | 1 | 共享聊天访问 |

Board 子模块目录：

| 目录 | 用例数 |
| --- | ---: |
| `board/` 根目录 | 8 |
| `board/access/` | 2 |
| `board/header/` | 15 |
| `board/board-menu/` | 12 |
| `board/canvas/` | 4 |
| `board/collaboration/` | 3 |
| `board/context-menu/` | 6 |
| `board/widget-menu/` | 14 |
| `board/widgets/` | 10 |
| `board/local-workspace/` | 3 |

Board 子模块入口说明见：[board/README.md](./board/README.md)。
