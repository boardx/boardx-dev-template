# Feature → UI Gap 矩阵（169 UC 全量）

> 由 `feature-breakdown.json` + e2e/路由佐证 + 设计界面清单核对得出（**首轮，按证据推导，待人工确认**）。
> 状态：✅ 已实现（有 e2e/路由佐证）｜🟡 部分（外壳或部分能力）｜🔴 设计有·实现无（壳在，能力缺）｜⬜ 整模块未建。

## 总览

**169** features ｜ ✅ 50 ｜ 🟡 10 ｜ 🔴 68 ｜ ⬜ 41

| 分组 | 总 | ✅ | 🟡 | 🔴 | ⬜ |
| --- | ---: | ---: | ---: | ---: | ---: |
| admin | 5 | 0 | 0 | 0 | 5 |
| ai-store | 6 | 0 | 0 | 0 | 6 |
| auth | 6 | 4 | 1 | 1 | 0 |
| ava | 10 | 0 | 0 | 0 | 10 |
| billing | 2 | 0 | 0 | 0 | 2 |
| board/00-core | 8 | 8 | 0 | 0 | 0 |
| board/access | 2 | 2 | 0 | 0 | 0 |
| board/board-menu | 12 | 1 | 1 | 10 | 0 |
| board/canvas | 4 | 3 | 0 | 1 | 0 |
| board/collaboration | 3 | 0 | 0 | 3 | 0 |
| board/context-menu | 6 | 1 | 0 | 5 | 0 |
| board/header | 15 | 5 | 1 | 9 | 0 |
| board/local-workspace | 3 | 0 | 0 | 3 | 0 |
| board/widget-menu | 14 | 2 | 1 | 11 | 0 |
| board/widgets | 10 | 1 | 0 | 9 | 0 |
| canvas | 5 | 4 | 0 | 1 | 0 |
| common | 4 | 1 | 0 | 3 | 0 |
| credits | 3 | 0 | 0 | 0 | 3 |
| feedback | 1 | 0 | 0 | 0 | 1 |
| home-page | 8 | 4 | 1 | 3 | 0 |
| invite | 2 | 0 | 1 | 1 | 0 |
| knowledge-base | 4 | 0 | 0 | 0 | 4 |
| presentations | 2 | 0 | 0 | 0 | 2 |
| profile | 5 | 3 | 1 | 1 | 0 |
| room | 7 | 3 | 1 | 3 | 0 |
| room-chat | 4 | 3 | 1 | 0 | 0 |
| share | 1 | 0 | 0 | 0 | 1 |
| studio | 1 | 0 | 0 | 0 | 1 |
| survey | 6 | 0 | 0 | 0 | 6 |
| team | 10 | 5 | 1 | 4 | 0 |

## admin

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-admin-001-manage-users` | 管理员创建、查询、编辑或删除用户账号，维护平台用户数据。 | ? | ⬜ 整模块未建 |
| `uc-admin-002-manage-teams` | 管理员查询、筛选团队，查看团队基础信息，并在后台支持的范围内更新团队类型或为团队手动增加 Credit。 | ? | ⬜ 整模块未建 |
| `uc-admin-003-ai-store-approval` | 管理员查看提交到 BoardX 平台审核的 AI Store 项目，并将项目批准或撤回到待审核状态。 | ? | ⬜ 整模块未建 |
| `uc-admin-004-featured-ai-store` | 管理员查看已通过平台审核的 AI Store 项目，并切换其官方精选状态。 | ? | ⬜ 整模块未建 |
| `uc-admin-005-view-admin-home` | 管理员进入后台首页，快速访问用户、团队、AI Store 等管理模块。 | ? | ⬜ 整模块未建 |

## ai-store

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-ai-store-001-browse-items` | 用户浏览可用的 Agent、工具或模板，找到适合当前工作的 AI 能力。 | ? | ⬜ 整模块未建 |
| `uc-ai-store-002-create-update-item` | 用户创建或维护 Agent、工具、模板或图片工具，使其可以被自己、团队或平台用户使用。 | ? | ⬜ 整模块未建 |
| `uc-ai-store-003-subscribe-use-item` | 用户订阅可用的 AI Store 项目，并在 AVA、Board 或团队场景中使用该能力。 | ? | ⬜ 整模块未建 |
| `uc-ai-store-004-favorite-item` | 用户在 AI Store 浏览项目时识别项目的喜欢数量和收藏状态，辅助判断是否查看详情或订阅使用。 | ? | ⬜ 整模块未建 |
| `uc-ai-store-005-share-management` | 项目拥有者生成或关闭 AI Store 管理授权链接，让协作者进入授权管理视图；被授权协作者查看和管理自己被授权的项目。 | ? | ⬜ 整模块未建 |
| `uc-ai-store-006-approval-featured` | 管理员审核团队或平台 AI Store 项目，并设置是否精选、发布或拒绝。 | ? | ⬜ 整模块未建 |

## auth

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-auth-001-email-register` | 用户使用邮箱、姓名和密码创建 BoardX 账号，以便进入产品并使用团队协作能力。 | /(auth)/* | ✅ 已实现 |
| `uc-auth-002-email-login` | 用户使用邮箱和密码登录 BoardX，获得访问个人与团队资源的登录状态。 | /(auth)/* | ✅ 已实现 |
| `uc-auth-003-social-login` | 用户通过第三方身份快速进入 BoardX，减少邮箱密码注册和记忆成本。 | /(auth)/* | 🟡 部分 |
| `uc-auth-004-forgot-reset-password` | 用户通过邮箱接收重置链接，设置新密码并恢复账号访问。 | /(auth)/* | ✅ 已实现 |
| `uc-auth-005-confirm-email` | 用户通过邮箱确认入口完成账号邮箱验证或新邮箱确认。 | /(auth)/* | 🔴 设计有·实现无 |
| `uc-auth-006-change-password` | 用户在账号中心的 Security 分区修改账号密码，保证账号安全。 | /(auth)/* | ✅ 已实现 |

## ava

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-ava-001-start-chat` | 用户在 AVA 中创建或进入一个聊天会话，输入问题、选择上下文或工具，并获得可继续追问的 AI 回复。 | ? | ⬜ 整模块未建 |
| `uc-ava-002-manage-chat-threads` | 用户在 AVA 中查看、切换、搜索或管理自己的聊天线程，快速回到历史对话。 | ? | ⬜ 整模块未建 |
| `uc-ava-003-edit-delete-message` | 用户修改已发送的问题，或删除自己可管理的消息，使对话内容保持准确。 | ? | ⬜ 整模块未建 |
| `uc-ava-004-share-chat` | 用户将一个 AVA 聊天线程生成可访问的分享链接，让他人只读查看对话内容。 | ? | ⬜ 整模块未建 |
| `uc-ava-005-deep-research` | 用户通过 Deep Research 让 AVA 针对复杂问题收集需求、制定研究计划、执行研究并输出报告。 | ? | ⬜ 整模块未建 |
| `uc-ava-006-configure-chat-ai-settings` | 用户在发送消息前选择模型、Agent、工具或 AI 参数，使回复符合当前任务需要。 | ? | ⬜ 整模块未建 |
| `uc-ava-007-attach-files-to-chat` | 用户在 AVA 消息中上传或附加文件、图片、音频等材料，让 AI 基于附件上下文回复。 | ? | ⬜ 整模块未建 |
| `uc-ava-008-use-voice-input` | 用户通过语音录入或实时转写向 AVA 提问，减少手动输入。 | ? | ⬜ 整模块未建 |
| `uc-ava-009-use-suggested-actions` | 用户通过系统推荐的问题、快捷动作或下一步建议，快速继续 AVA 对话。 | ? | ⬜ 整模块未建 |
| `uc-ava-010-react-copy-and-use-message` | 用户对 AVA 回复执行复制、反馈、重新生成、发送到 Board、发送邮件或使用结果等操作。 | ? | ⬜ 整模块未建 |

## billing

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-billing-001-upgrade-plan` | 用户在个人菜单或 AI 额度不足提示中打开计划弹窗，升级免费账号或管理已有订阅；在 Credit 计费模式下进入购买 Credit 流程。 | ? | ⬜ 整模块未建 |
| `uc-billing-002-scan-payment` | 用户在个人 Pro 开通或 Credit 购买流程中生成二维码，并通过外部支付工具扫码付款。 | ? | ⬜ 整模块未建 |

## board/00-core

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-board-001-create-board` | 让用户在有权限的空间内创建一个新白板。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-002-open-collaborate-board` | 让用户打开可访问白板并进入协作画布。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-003-list-search-recent-board` | 让用户在列表中查找最近使用或目标白板。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-004-favorite-board` | 让用户把常用白板加入或移出收藏。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-005-update-board-metadata` | 让有权限用户修改白板名称、封面、类别或描述等可见元信息。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-006-move-board` | 让有管理权限用户把白板移动到其他房间。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-007-duplicate-board` | 让用户基于已有白板创建副本。 | /boards/[id] · core | ✅ 已实现 |
| `uc-board-008-delete-board` | 让有权限用户删除不再需要的白板。 | /boards/[id] · core | ✅ 已实现 |

## board/access

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-board-access-001-manage-board-visibility` | 让具备管理权限的用户设置谁可以访问 Board。 | /boards/[id] · access | ✅ 已实现 |
| `uc-board-access-002-join-public-board` | 让用户通过公开链接进入允许访问的 Board，并在需要时加入协作身份。 | /boards/[id] · access | ✅ 已实现 |

## board/board-menu

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-board-menu-001-use-board-menu` | 通过 Board Menu 选择工具并在画布创建或放置内容。 | /boards/[id] · board-menu | 🟡 部分 |
| `uc-board-menu-002-create-sticky-note` | 让用户从工具栏创建矩形、方形或圆形便利贴。 | /boards/[id] · board-menu | ✅ 已实现 |
| `uc-board-menu-003-create-text` | 让用户在画布上创建文本框或标题文本。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-004-create-shape` | 让用户创建矩形、圆形、三角形、菱形、圆角矩形、六边形等图形。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-005-create-connector` | 让用户创建直线、箭头或连接对象的线。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-006-draw-on-canvas` | 让用户用画笔在画布上绘制自由路径。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-007-create-chart` | 让用户在当前 Board 支持图表模式时，通过已注册的快捷键进入图表创建流程，并避免把未显示的 Board Menu 图表按钮当作当前入口。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-008-upload-file` | 让用户把本地文件上传并放到画布。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-009-use-resources-template` | 让用户从资源、模板、图片、图标或贴画面板放置内容。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-010-use-board-ai-assist` | 让用户从 Board 画布中的 AI 浮动入口打开白板级 AI 对话能力。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-011-create-link-widget` | 让用户把 URL 放到画布成为链接组件。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |
| `uc-board-menu-012-erase-drawing-content` | 让用户用橡皮擦删除可擦除的手绘笔迹。 | /boards/[id] · board-menu | 🔴 设计有·实现无 |

## board/canvas

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-canvas-006-zoom-and-minimap` | 在 Board 画布中通过右下角缩放控制条缩放画布和适应内容。 | /boards/[id] · canvas | ✅ 已实现 |
| `uc-canvas-007-use-alignment-guidelines` | 在 Board 画布中完成使用对齐参考线。 | /boards/[id] · canvas | 🔴 设计有·实现无 |
| `uc-canvas-008-keyboard-operate-widget` | 在 Board 画布中完成用键盘操作组件。 | /boards/[id] · canvas | ✅ 已实现 |
| `uc-canvas-009-select-and-multi-select-widget` | 在 Board 画布中完成选择和多选组件。 | /boards/[id] · canvas | ✅ 已实现 |

## board/collaboration

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-collab-001-yjs-realtime-sync` | 在多人场景中实时同步协作内容。 | /boards/[id] · collaboration | 🔴 设计有·实现无 |
| `uc-collab-002-show-online-users-cursors` | 在多人场景中查看在线成员和光标。 | /boards/[id] · collaboration | 🔴 设计有·实现无 |
| `uc-collab-003-follow-collaborator` | 在多人场景中跟随协作者视角。 | /boards/[id] · collaboration | 🔴 设计有·实现无 |

## board/context-menu

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-context-menu-001-use-context-menu` | 让用户通过右键菜单执行当前目标允许的快捷操作。 | /boards/[id] · context-menu | 🔴 设计有·实现无 |
| `uc-context-menu-002-copy-cut-paste` | 让用户通过右键菜单复制、剪切或粘贴画布内容。 | /boards/[id] · context-menu | ✅ 已实现 |
| `uc-context-menu-003-arrange-layer` | 让用户把对象移至上层、最前、下层或最后。 | /boards/[id] · context-menu | 🔴 设计有·实现无 |
| `uc-context-menu-004-group-lock` | 让用户管理多个对象的组合和锁定状态。 | /boards/[id] · context-menu | 🔴 设计有·实现无 |
| `uc-context-menu-005-export-selected-content` | 让用户把选区或白板导出为图片/文件。 | /boards/[id] · context-menu | 🔴 设计有·实现无 |
| `uc-context-menu-006-save-as-template` | 让用户把选中对象保存为可复用模板。 | /boards/[id] · context-menu | 🔴 设计有·实现无 |

## board/header

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-board-header-001-use-board-header` | 让用户理解 Header 上可见状态并进入被授权的操作。 | /boards/[id] · header | 🟡 部分 |
| `uc-board-header-002-manage-board-title` | 让有权限用户查看并修改白板标题。 | /boards/[id] · header | ✅ 已实现 |
| `uc-board-header-003-share-board` | 让用户复制分享链接、查看二维码，并按权限调整访问范围。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-004-use-timer` | 让协作者启动、暂停、继续、停止或调整协作计时。 | /boards/[id] · header | ✅ 已实现 |
| `uc-board-header-005-manage-slides` | 让用户打开幻灯片侧栏，创建、排序、展示或导出幻灯片。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-006-use-voice-transcription` | 让用户把语音录制转为白板文本。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-007-manage-board-backup` | 让有权限用户创建备份并从备份恢复白板。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-008-go-back-from-board` | 让用户安全离开当前白板并回到房间或列表。 | /boards/[id] · header | ✅ 已实现 |
| `uc-board-header-009-view-sync-status` | 让用户知道白板当前是否仍在同步。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-010-undo-redo-board-operation` | 让用户撤销或重做最近的白板编辑。 | /boards/[id] · header | ✅ 已实现 |
| `uc-board-header-011-open-shortcuts-help` | 让用户查看当前可用快捷键。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-012-manage-board-settings` | 让用户调整白板设置和交互偏好。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-013-view-welcome-guide` | 让新用户或访客查看白板引导信息。 | /boards/[id] · header | ✅ 已实现 |
| `uc-board-header-014-view-board-statistics` | 让用户查看与白板相关的状态或统计摘要。 | /boards/[id] · header | 🔴 设计有·实现无 |
| `uc-board-header-015-export-board-pdf` | 让用户从幻灯片或导出入口获得 PDF 文件。 | /boards/[id] · header | 🔴 设计有·实现无 |

## board/local-workspace

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-local-001-use-local-workspace` | 在本地工作区中使用 Local Workspace。 | /boards/[id] · local-workspace | 🔴 设计有·实现无 |
| `uc-local-002-use-local-model-chat-tools` | 在 Board 中使用当前可见的 Board Chat；本地模型和本地工具只有入口明确展示时才纳入流程。 | /boards/[id] · local-workspace | 🔴 设计有·实现无 |
| `uc-local-003-use-board-memory` | 在本地工作区中使用 Board Memory。 | /boards/[id] · local-workspace | 🔴 设计有·实现无 |

## board/widget-menu

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-widget-menu-001-use-widget-menu` | 让用户在选中组件后使用适用的悬浮操作。 | /boards/[id] · widget-menu | ✅ 已实现 |
| `uc-widget-menu-002-style-widget` | 让用户修改组件颜色、边框、背景、线宽或透明度等样式。 | /boards/[id] · widget-menu | 🟡 部分 |
| `uc-widget-menu-003-lock-unlock-widget` | 让用户防止组件被误移动、缩放、旋转或编辑。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-004-crop-image` | 让用户裁剪图片组件。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-005-download-file-widget` | 让用户下载画布上的文件类组件。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-006-audio-to-text` | 让用户把音频文件组件转换为文本。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-007-use-widget-ai-assist` | 让用户基于选中组件使用 AI 能力。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-008-delete-widget` | 让用户删除选中的一个或多个组件。 | /boards/[id] · widget-menu | ✅ 已实现 |
| `uc-widget-menu-009-refresh-widget` | 让用户刷新支持重新加载的组件内容。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-010-apply-format` | 让用户把当前格式应用到其他文本或便利贴。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-011-align-selected-widgets` | 让用户整理多选组件的位置。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-012-edit-connector-style` | 让用户调整连接线颜色、粗细、端点、路径和流程标识，让对象之间的关系表达更清楚。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-013-edit-text-style` | 让用户调整文本、标题或便利贴中的文字表现。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |
| `uc-widget-menu-014-convert-text-to-sticky-notes` | 让用户把文本内容拆分成多个便利贴。 | /boards/[id] · widget-menu | 🔴 设计有·实现无 |

## board/widgets

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-widgets-001-use-canvasx-widgets` | 用户在 Board 画布中创建、选择和管理 CanvasX 组件，并理解不同组件类型对应的可操作能力边界。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-002-use-file-widgets` | 用户在 Board 中添加文件，查看文件卡片信息，并对文件组件进行移动、下载、转写或删除等操作。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-003-use-sticky-note-widget` | 用户在 Board 中创建便利贴，用便利贴记录想法，并对便利贴的内容、外观、位置和状态进行编辑。 | /boards/[id] · widgets | ✅ 已实现 |
| `uc-widgets-004-use-shape-widget` | 用户在 Board 中创建形状，用形状承载结构化内容，并调整形状的文本、外观、大小和层级。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-005-use-connector-widget` | 用户在 Board 中用连接线表达对象之间的关系，并通过当前可见的线型、端点和路径样式让关系含义更清楚。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-006-use-draw-widget` | 用户在 Board 中通过手绘笔迹表达草图、标注或自由线条，并可调整笔迹样式和管理绘制内容。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-007-use-text-widget` | 用户在 Board 中创建独立文本，用文本表达说明、标题或内容，并调整文本样式和位置。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-008-use-chart-widget` | 用户在 Board 中查看或使用图表组件，并对图表组件进行选择、移动、锁定、删除和 AI 辅助等可用操作。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-009-use-image-widget` | 用户在 Board 中添加图片，并对图片的位置、尺寸、裁剪和状态进行管理。 | /boards/[id] · widgets | 🔴 设计有·实现无 |
| `uc-widgets-010-use-active-selection-widget` | 用户在 Board 中同时选择多个组件，对它们执行批量移动、对齐、编组、锁定、删除等操作。 | /boards/[id] · widgets | 🔴 设计有·实现无 |

## canvas

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-canvas-001-pan-zoom-navigate` | 在 Board 画布中完成平移、缩放和导航画布。 | Board 画布 | ✅ 已实现 |
| `uc-canvas-002-create-edit-widgets` | 在 Board 画布中完成在画布创建和编辑组件。 | Board 画布 | ✅ 已实现 |
| `uc-canvas-003-copy-paste` | 在 Board 画布中完成复制和粘贴画布内容。 | Board 画布 | ✅ 已实现 |
| `uc-canvas-004-undo-redo` | 在 Board 画布中完成撤销和重做画布操作。 | Board 画布 | ✅ 已实现 |
| `uc-canvas-005-realtime-collaboration` | 在 Board 画布中完成画布实时协作。 | Board 画布 | 🔴 设计有·实现无 |

## common

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-common-001-global-search` | 用户通过全局搜索快速找到自己有权限访问的 Boards、Rooms、Templates、Agents、Tools 和 Threads。 | 全局(搜索/语言/主题/反馈) | 🔴 设计有·实现无 |
| `uc-common-002-switch-language` | 用户切换 BoardX 界面语言，以使用自己熟悉的语言浏览和操作系统。 | 全局(搜索/语言/主题/反馈) | 🔴 设计有·实现无 |
| `uc-common-003-switch-theme` | 用户在浅色、深色或系统主题之间切换，以获得合适的视觉体验。 | 全局(搜索/语言/主题/反馈) | ✅ 已实现 |
| `uc-common-004-submit-feedback-with-attachment` | 用户提交产品反馈，并可附带截图或图片帮助说明问题。 | 全局(搜索/语言/主题/反馈) | 🔴 设计有·实现无 |

## credits

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-credits-001-view-wallet` | Team 管理角色查看团队 Credit 余额、购买记录和消耗记录；普通用户在用户菜单查看个人 Credit 余额入口。 | ? | ⬜ 整模块未建 |
| `uc-credits-002-purchase-credits` | 用户购买个人或团队 Credit，以继续使用 AI 或其他消耗型能力。 | ? | ⬜ 整模块未建 |
| `uc-credits-003-view-credit-records` | 用户查看自己或团队被允许范围内的 Credit 余额和交易记录。 | ? | ⬜ 整模块未建 |

## feedback

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-feedback-001-submit-feedback` | 用户向 BoardX 提交问题或建议，并可附带图片帮助说明。 | ? | ⬜ 整模块未建 |

## home-page

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-home-001-view-dashboard` | 用户进入 Home Page 后，查看当前团队上下文下的 Agent 工作入口，并快速开始 AVA 相关工作。 | / , /home, /recent | ✅ 已实现 |
| `uc-home-002-open-recent-board` | 用户从首页快速回到最近编辑或查看的白板。 | / , /home, /recent | ✅ 已实现 |
| `uc-home-003-onboarding` | 系统帮助用户理解 Home Page 当前可见入口，并引导其进入 Agent、AI Store 或 AVA 推荐功能。 | / , /home, /recent | ✅ 已实现 |
| `uc-home-004-view-recent-page` | 用户查看最近访问或最近编辑的资源，并快速回到工作内容。 | / , /home, /recent | 🟡 部分 |
| `uc-home-005-search-agents` | 用户在 Home Page 中快速找到自己想使用的 Agent。 | / , /home, /recent | ✅ 已实现 |
| `uc-home-006-start-agent-quick-chat` | 用户从 Home Page 选择一个可用 Agent，并立即进入带有该 Agent 上下文的 AVA 对话。 | / , /home, /recent | 🔴 设计有·实现无 |
| `uc-home-007-start-recommended-feature` | 用户从 Home Page 直接启动 BoardX 推荐的高频 AI 工作流。 | / , /home, /recent | 🔴 设计有·实现无 |
| `uc-home-008-continue-last-chat` | 用户从 Home Page 快速回到上一次正在使用的 AVA 对话。 | / , /home, /recent | 🔴 设计有·实现无 |

## invite

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-invite-001-accept-invite-link` | 用户打开团队或房间邀请链接，完成登录/注册后加入对应团队或房间。 | team 邀请 / 邀请链接 | 🟡 部分 |
| `uc-invite-002-invite-friend` | 管理者通过复制邀请链接或输入邮箱，把他人邀请到团队或房间协作。 | team 邀请 / 邀请链接 | 🔴 设计有·实现无 |

## knowledge-base

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-kb-001-upload-file` | 用户上传文件到个人、团队、Agent 或 AI Tool 知识库，使后续 AI 能在对应上下文中使用。 | ? | ⬜ 整模块未建 |
| `uc-kb-002-list-download-file` | 用户查看已上传知识库文件，并下载或打开有权访问的文件。 | ? | ⬜ 整模块未建 |
| `uc-kb-003-delete-file` | 用户删除不再需要或错误上传的知识库文件，使其不再出现在当前知识库列表中。 | ? | ⬜ 整模块未建 |
| `uc-kb-004-use-file-in-ai-context` | 用户让 AVA、Agent 或 AI Tool 在回答时使用当前上下文中已完成处理的知识库文件。 | ? | ⬜ 整模块未建 |

## presentations

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-presentations-001-generate-presentation` | 用户基于当前聊天、文件或输入说明生成演示文稿，并查看生成结果或生成进度。 | ? | ⬜ 整模块未建 |
| `uc-presentations-002-revise-presentation` | 用户对已生成演示文稿的方案或单页预览提出修改要求，得到更新后的方案或页面。 | ? | ⬜ 整模块未建 |

## profile

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-profile-001-view-profile` | 用户从用户菜单进入账号中心，查看自己的个人信息、安全设置和偏好设置入口。 | /account | ✅ 已实现 |
| `uc-profile-002-edit-profile` | 用户在账号中心维护显示名和头像，并能从候选头像或 AI 生成头像中选择一个作为个人头像。 | /account | ✅ 已实现 |
| `uc-profile-003-manage-user-menu` | 用户通过个人菜单进入账号中心的个人资料或设置分区，并继续访问个人知识库、邀请好友、升级或 Credit、语言、主题、退出登录等账号相关能力。 | /account | 🟡 部分 |
| `uc-profile-004-manage-user-memory` | 用户维护个人 Memory，使 AI 在个人上下文中使用用户偏好、事实和长期信息。 | /account | 🔴 设计有·实现无 |
| `uc-profile-005-manage-account-settings` | 用户在账号中心维护自己的默认偏好，使后续使用 AVA、知识库、Room、Board 或其它工作区能力时采用合适的个人默认设置。 | /account | ✅ 已实现 |

## room

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-room-001-create-room` | 用户在当前团队下创建一个房间，用于集中管理白板、房间聊天、问卷、文件和 Studio 协作内容。 | /rooms, /rooms/[id]/* | ✅ 已实现 |
| `uc-room-002-view-search-room` | 用户在当前团队下查看自己可访问的房间，搜索房间名称，打开房间或收藏房间。 | /rooms, /rooms/[id]/* | ✅ 已实现 |
| `uc-room-003-invite-manage-room-members` | 房间管理者邀请团队成员或外部邮箱进入房间，并维护房间成员角色。 | /rooms, /rooms/[id]/* | 🟡 部分 |
| `uc-room-004-update-delete-room` | 房间管理者修改房间名称，或删除不再需要的房间。 | /rooms, /rooms/[id]/* | ✅ 已实现 |
| `uc-room-005-manage-room-files` | 用户在房间聊天工作区上传、查看、搜索、预览或删除与当前聊天线程关联的文件，辅助 AI 对话和协作。 | /rooms, /rooms/[id]/* | 🔴 设计有·实现无 |
| `uc-room-006-use-room-studio` | 用户在房间聊天工作区打开右侧 Studio 面板，从房间文件生成音频概览、思维导图、报告、闪卡或数据表等 AI 产物。 | /rooms, /rooms/[id]/* | 🔴 设计有·实现无 |
| `uc-room-007-view-room-surveys` | 用户在房间内进入 Survey 页签，查看团队问卷列表，必要时创建、编辑、分享、启停或查看结果。 | /rooms, /rooms/[id]/* | 🔴 设计有·实现无 |

## room-chat

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-room-chat-001-create-chat` | 用户在房间 Chat 页签中新建一个与当前房间关联的 AVA 聊天线程。 | /rooms/[id]/chats/* | ✅ 已实现 |
| `uc-room-chat-002-list-open-chat` | 用户查看当前房间的聊天线程列表，并打开某个聊天继续协作。 | /rooms/[id]/chats/* | ✅ 已实现 |
| `uc-room-chat-003-send-message` | 用户在房间聊天线程中向 AVA 发送消息，并在当前房间上下文中继续协作。 | /rooms/[id]/chats/* | 🟡 部分 |
| `uc-room-chat-004-delete-chat` | 用户从房间聊天列表删除自己可删除的聊天线程。 | /rooms/[id]/chats/* | ✅ 已实现 |

## share

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-share-001-view-shared-chat` | 用户通过分享链接只读查看 AVA 或 Chat 对话内容。 | ? | ⬜ 整模块未建 |

## studio

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-studio-001-generate-artifact` | 用户通过 Studio 生成音频概览、演示文稿或信息图，并在聊天中查看、播放、下载或预览生成结果。 | ? | ⬜ 整模块未建 |

## survey

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-survey-001-create-survey` | 用户在当前团队中创建一份可分享给答题人的问卷。 | ? | ⬜ 整模块未建 |
| `uc-survey-002-list-manage-surveys` | 用户查看当前团队中的问卷，打开结果、编辑、分享、预览答题页或删除问卷。 | ? | ⬜ 整模块未建 |
| `uc-survey-003-answer-survey` | 答题人打开公开答题链接，填写并提交问卷。 | ? | ⬜ 整模块未建 |
| `uc-survey-004-view-answers-report` | 用户查看问卷回收结果，生成分析报告，并导出报告。 | ? | ⬜ 整模块未建 |
| `uc-survey-005-manage-templates` | 用户使用内置模板或团队保存模板快速创建问卷，并把当前问卷保存为模板。 | ? | ⬜ 整模块未建 |
| `uc-survey-006-publish-unpublish-survey` | 用户控制问卷是否接受公开答题。 | ? | ⬜ 整模块未建 |

## team

| Feature (UC) | 用户可见行为 | 目标界面 | 状态 |
| --- | --- | --- | --- |
| `uc-team-001-create-team` | 用户在 BoardX 中创建一个新的协作团队，后续可以在该团队下进入房间、成员管理、知识库、AI Store 和问卷等工作区。 | /teams | ✅ 已实现 |
| `uc-team-002-view-switch-team` | 用户查看自己所在团队列表，并切换当前工作团队。 | /teams | ✅ 已实现 |
| `uc-team-003-invite-members` | 团队管理者通过邮箱邀请新成员，或复制团队邀请链接给外部用户加入团队。 | /teams | 🟡 部分 |
| `uc-team-004-join-by-invite` | 用户打开团队邀请链接，登录或注册后加入团队，并进入团队相关工作区。 | /teams | ✅ 已实现 |
| `uc-team-005-manage-members` | 团队管理者查看成员、调整成员角色、移除成员、管理成员 token 使用权限，并查看成员 token 用量。 | /teams | ✅ 已实现 |
| `uc-team-006-update-delete-team` | 团队管理者维护团队名称、团队头像，或删除不再需要的团队。 | /teams | ✅ 已实现 |
| `uc-team-007-manage-team-general-settings` | 团队管理者从 Team 管理页集中查看和进入团队的基础管理入口。 | /teams | 🔴 设计有·实现无 |
| `uc-team-008-view-team-home` | 团队管理者进入 Team Home，了解当前团队管理入口与团队工作概况。 | /teams | 🔴 设计有·实现无 |
| `uc-team-009-manage-team-memory` | 团队管理者进入团队 Memory 页面，维护团队在 AI 协作中可复用的上下文信息。 | /teams | 🔴 设计有·实现无 |
| `uc-team-010-view-team-ai-store` | 用户在当前团队上下文中查看可探索、已订阅或待审批的 AI Store 内容。 | /teams | 🔴 设计有·实现无 |

