# 并行开发计划（wave × lane）

> 由 feature-breakdown.json 派生。lane=模块/board子区（同 lane 串行避冲突），同 wave 跨 lane 并行。
> dev_status：✅已实现(50) ｜ 🟢可开发(40，依赖已满足) ｜ ⛔待依赖(79)。
> 验收(verification)多为草稿，开 issue 前由 verification-writer 细化为可运行命令。

**合计 169**：✅ 50 ｜ 🟢 40 ｜ ⛔ 79

## 立即可并行开发（🟢 ready-for-dev，wave 升序）

| Feature | wave | lane | 目标界面 |
| --- | ---: | --- | --- |
| `uc-admin-001-manage-users` | 2 | admin | ? |
| `uc-ai-store-001-browse-items` | 2 | ai-store | ? |
| `uc-auth-003-social-login` | 2 | auth | /(auth)/* |
| `uc-ava-001-start-chat` | 2 | ava | ? |
| `uc-billing-001-upgrade-plan` | 2 | billing | ? |
| `uc-common-001-global-search` | 2 | common | 全局(搜索/语言/主题/反馈) |
| `uc-credits-001-view-wallet` | 2 | credits | ? |
| `uc-feedback-001-submit-feedback` | 2 | feedback | ? |
| `uc-invite-001-accept-invite-link` | 2 | invite | team 邀请 / 邀请链接 |
| `uc-kb-001-upload-file` | 2 | knowledge-base | ? |
| `uc-presentations-001-generate-presentation` | 2 | presentations | ? |
| `uc-share-001-view-shared-chat` | 2 | share | ? |
| `uc-studio-001-generate-artifact` | 2 | studio | ? |
| `uc-survey-001-create-survey` | 2 | survey | ? |
| `uc-auth-005-confirm-email` | 4 | auth | /(auth)/* |
| `uc-board-header-001-use-board-header` | 4 | board/header | /boards/[id] · header |
| `uc-board-menu-001-use-board-menu` | 4 | board/board-menu | /boards/[id] · board-menu |
| `uc-collab-001-yjs-realtime-sync` | 4 | board/collaboration | /boards/[id] · collaboration |
| `uc-context-menu-001-use-context-menu` | 4 | board/context-menu | /boards/[id] · context-menu |
| `uc-local-001-use-local-workspace` | 4 | board/local-workspace | /boards/[id] · local-workspace |
| `uc-profile-003-manage-user-menu` | 4 | profile | /account |
| `uc-room-003-invite-manage-room-members` | 4 | room | /rooms, /rooms/[id]/* |
| `uc-room-chat-003-send-message` | 4 | room-chat | /rooms/[id]/chats/* |
| `uc-team-003-invite-members` | 4 | team | /teams |
| `uc-widgets-001-use-canvasx-widgets` | 4 | board/widgets | /boards/[id] · widgets |
| `uc-canvas-007-use-alignment-guidelines` | 5 | board/canvas | /boards/[id] · canvas |
| `uc-common-004-submit-feedback-with-attachment` | 5 | common | 全局(搜索/语言/主题/反馈) |
| `uc-home-004-view-recent-page` | 5 | home-page | / , /home, /recent |
| `uc-widget-menu-002-style-widget` | 5 | board/widget-menu | /boards/[id] · widget-menu |
| `uc-board-header-003-share-board` | 6 | board/header | /boards/[id] · header |
| `uc-board-menu-003-create-text` | 6 | board/board-menu | /boards/[id] · board-menu |
| `uc-canvas-005-realtime-collaboration` | 6 | canvas | Board 画布 |
| `uc-context-menu-003-arrange-layer` | 6 | board/context-menu | /boards/[id] · context-menu |
| `uc-widgets-004-use-shape-widget` | 7 | board/widgets | /boards/[id] · widgets |
| `uc-board-header-005-manage-slides` | 8 | board/header | /boards/[id] · header |
| `uc-team-007-manage-team-general-settings` | 8 | team | /teams |
| `uc-board-header-009-view-sync-status` | 12 | board/header | /boards/[id] · header |
| `uc-widget-menu-009-refresh-widget` | 12 | board/widget-menu | /boards/[id] · widget-menu |
| `uc-board-header-011-open-shortcuts-help` | 14 | board/header | /boards/[id] · header |
| `uc-board-header-014-view-board-statistics` | 17 | board/header | /boards/[id] · header |

## 按 wave 全量（含 ⛔ 待依赖）

### wave 2 — 14 个，14 并行 lane

- 🟢可开发 `uc-admin-001-manage-users` (admin) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-ai-store-001-browse-items` (ai-store) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-auth-003-social-login` (auth) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-ava-001-start-chat` (ava) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-billing-001-upgrade-plan` (billing) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-common-001-global-search` (common) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-credits-001-view-wallet` (credits) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-feedback-001-submit-feedback` (feedback) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-invite-001-accept-invite-link` (invite) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-kb-001-upload-file` (knowledge-base) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-presentations-001-generate-presentation` (presentations) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-share-001-view-shared-chat` (share) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-studio-001-generate-artifact` (studio) ← 依赖 uc-auth-002-email-login
- 🟢可开发 `uc-survey-001-create-survey` (survey) ← 依赖 uc-auth-002-email-login

### wave 3 — 10 个，10 并行 lane

- ⛔待依赖 `uc-admin-002-manage-teams` (admin) ← 依赖 uc-admin-001-manage-users
- ⛔待依赖 `uc-ai-store-002-create-update-item` (ai-store) ← 依赖 uc-ai-store-001-browse-items
- ⛔待依赖 `uc-ava-002-manage-chat-threads` (ava) ← 依赖 uc-ava-001-start-chat
- ⛔待依赖 `uc-billing-002-scan-payment` (billing) ← 依赖 uc-billing-001-upgrade-plan
- ⛔待依赖 `uc-common-002-switch-language` (common) ← 依赖 uc-common-001-global-search
- ⛔待依赖 `uc-credits-002-purchase-credits` (credits) ← 依赖 uc-credits-001-view-wallet
- ⛔待依赖 `uc-invite-002-invite-friend` (invite) ← 依赖 uc-invite-001-accept-invite-link
- ⛔待依赖 `uc-kb-002-list-download-file` (knowledge-base) ← 依赖 uc-kb-001-upload-file
- ⛔待依赖 `uc-presentations-002-revise-presentation` (presentations) ← 依赖 uc-presentations-001-generate-presentation
- ⛔待依赖 `uc-survey-002-list-manage-surveys` (survey) ← 依赖 uc-survey-001-create-survey

### wave 4 — 17 个，17 并行 lane

- ⛔待依赖 `uc-admin-003-ai-store-approval` (admin) ← 依赖 uc-admin-002-manage-teams
- ⛔待依赖 `uc-ai-store-003-subscribe-use-item` (ai-store) ← 依赖 uc-ai-store-002-create-update-item
- 🟢可开发 `uc-auth-005-confirm-email` (auth) ← 依赖 uc-auth-004-forgot-reset-password
- ⛔待依赖 `uc-ava-003-edit-delete-message` (ava) ← 依赖 uc-ava-002-manage-chat-threads
- 🟢可开发 `uc-board-header-001-use-board-header` (board/header) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets
- 🟢可开发 `uc-board-menu-001-use-board-menu` (board/board-menu) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets
- 🟢可开发 `uc-collab-001-yjs-realtime-sync` (board/collaboration) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets
- 🟢可开发 `uc-context-menu-001-use-context-menu` (board/context-menu) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets
- ⛔待依赖 `uc-credits-003-view-credit-records` (credits) ← 依赖 uc-credits-002-purchase-credits
- ⛔待依赖 `uc-kb-003-delete-file` (knowledge-base) ← 依赖 uc-kb-002-list-download-file
- 🟢可开发 `uc-local-001-use-local-workspace` (board/local-workspace) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets
- 🟢可开发 `uc-profile-003-manage-user-menu` (profile) ← 依赖 uc-profile-002-edit-profile
- 🟢可开发 `uc-room-003-invite-manage-room-members` (room) ← 依赖 uc-room-002-view-search-room
- 🟢可开发 `uc-room-chat-003-send-message` (room-chat) ← 依赖 uc-room-chat-002-list-open-chat
- ⛔待依赖 `uc-survey-003-answer-survey` (survey) ← 依赖 uc-survey-002-list-manage-surveys
- 🟢可开发 `uc-team-003-invite-members` (team) ← 依赖 uc-team-002-view-switch-team
- 🟢可开发 `uc-widgets-001-use-canvasx-widgets` (board/widgets) ← 依赖 uc-auth-002-email-login, uc-board-001-create-board, uc-canvas-002-create-edit-widgets

### wave 5 — 13 个，13 并行 lane

- ⛔待依赖 `uc-admin-004-featured-ai-store` (admin) ← 依赖 uc-admin-003-ai-store-approval
- ⛔待依赖 `uc-ai-store-004-favorite-item` (ai-store) ← 依赖 uc-ai-store-003-subscribe-use-item
- ⛔待依赖 `uc-ava-004-share-chat` (ava) ← 依赖 uc-ava-003-edit-delete-message
- 🟢可开发 `uc-canvas-007-use-alignment-guidelines` (board/canvas) ← 依赖 uc-canvas-006-zoom-and-minimap
- ⛔待依赖 `uc-collab-002-show-online-users-cursors` (board/collaboration) ← 依赖 uc-collab-001-yjs-realtime-sync
- 🟢可开发 `uc-common-004-submit-feedback-with-attachment` (common) ← 依赖 uc-common-003-switch-theme
- 🟢可开发 `uc-home-004-view-recent-page` (home-page) ← 依赖 uc-home-003-onboarding
- ⛔待依赖 `uc-kb-004-use-file-in-ai-context` (knowledge-base) ← 依赖 uc-kb-003-delete-file
- ⛔待依赖 `uc-local-002-use-local-model-chat-tools` (board/local-workspace) ← 依赖 uc-local-001-use-local-workspace
- ⛔待依赖 `uc-profile-004-manage-user-memory` (profile) ← 依赖 uc-profile-003-manage-user-menu
- ⛔待依赖 `uc-survey-004-view-answers-report` (survey) ← 依赖 uc-survey-003-answer-survey
- 🟢可开发 `uc-widget-menu-002-style-widget` (board/widget-menu) ← 依赖 uc-widget-menu-001-use-widget-menu
- ⛔待依赖 `uc-widgets-002-use-file-widgets` (board/widgets) ← 依赖 uc-widgets-001-use-canvasx-widgets

### wave 6 — 12 个，12 并行 lane

- ⛔待依赖 `uc-admin-005-view-admin-home` (admin) ← 依赖 uc-admin-004-featured-ai-store
- ⛔待依赖 `uc-ai-store-005-share-management` (ai-store) ← 依赖 uc-ai-store-004-favorite-item
- ⛔待依赖 `uc-ava-005-deep-research` (ava) ← 依赖 uc-ava-004-share-chat
- 🟢可开发 `uc-board-header-003-share-board` (board/header) ← 依赖 uc-board-header-002-manage-board-title
- 🟢可开发 `uc-board-menu-003-create-text` (board/board-menu) ← 依赖 uc-board-menu-002-create-sticky-note
- 🟢可开发 `uc-canvas-005-realtime-collaboration` (canvas) ← 依赖 uc-canvas-004-undo-redo
- ⛔待依赖 `uc-collab-003-follow-collaborator` (board/collaboration) ← 依赖 uc-collab-002-show-online-users-cursors
- 🟢可开发 `uc-context-menu-003-arrange-layer` (board/context-menu) ← 依赖 uc-context-menu-002-copy-cut-paste
- ⛔待依赖 `uc-local-003-use-board-memory` (board/local-workspace) ← 依赖 uc-local-002-use-local-model-chat-tools
- ⛔待依赖 `uc-room-005-manage-room-files` (room) ← 依赖 uc-room-004-update-delete-room, uc-kb-001-upload-file
- ⛔待依赖 `uc-survey-005-manage-templates` (survey) ← 依赖 uc-survey-004-view-answers-report
- ⛔待依赖 `uc-widget-menu-003-lock-unlock-widget` (board/widget-menu) ← 依赖 uc-widget-menu-002-style-widget

### wave 7 — 9 个，9 并行 lane

- ⛔待依赖 `uc-ai-store-006-approval-featured` (ai-store) ← 依赖 uc-ai-store-005-share-management
- ⛔待依赖 `uc-ava-006-configure-chat-ai-settings` (ava) ← 依赖 uc-ava-005-deep-research
- ⛔待依赖 `uc-board-menu-004-create-shape` (board/board-menu) ← 依赖 uc-board-menu-003-create-text
- ⛔待依赖 `uc-context-menu-004-group-lock` (board/context-menu) ← 依赖 uc-context-menu-003-arrange-layer
- ⛔待依赖 `uc-home-006-start-agent-quick-chat` (home-page) ← 依赖 uc-home-005-search-agents, uc-ava-001-start-chat
- ⛔待依赖 `uc-room-006-use-room-studio` (room) ← 依赖 uc-room-005-manage-room-files, uc-studio-001-generate-artifact
- ⛔待依赖 `uc-survey-006-publish-unpublish-survey` (survey) ← 依赖 uc-survey-005-manage-templates
- ⛔待依赖 `uc-widget-menu-004-crop-image` (board/widget-menu) ← 依赖 uc-widget-menu-003-lock-unlock-widget
- 🟢可开发 `uc-widgets-004-use-shape-widget` (board/widgets) ← 依赖 uc-widgets-003-use-sticky-note-widget

### wave 8 — 9 个，9 并行 lane

- ⛔待依赖 `uc-ava-007-attach-files-to-chat` (ava) ← 依赖 uc-ava-006-configure-chat-ai-settings
- 🟢可开发 `uc-board-header-005-manage-slides` (board/header) ← 依赖 uc-board-header-004-use-timer
- ⛔待依赖 `uc-board-menu-005-create-connector` (board/board-menu) ← 依赖 uc-board-menu-004-create-shape
- ⛔待依赖 `uc-context-menu-005-export-selected-content` (board/context-menu) ← 依赖 uc-context-menu-004-group-lock
- ⛔待依赖 `uc-home-007-start-recommended-feature` (home-page) ← 依赖 uc-home-006-start-agent-quick-chat, uc-ava-001-start-chat
- ⛔待依赖 `uc-room-007-view-room-surveys` (room) ← 依赖 uc-room-006-use-room-studio, uc-survey-001-create-survey
- 🟢可开发 `uc-team-007-manage-team-general-settings` (team) ← 依赖 uc-team-006-update-delete-team
- ⛔待依赖 `uc-widget-menu-005-download-file-widget` (board/widget-menu) ← 依赖 uc-widget-menu-004-crop-image
- ⛔待依赖 `uc-widgets-005-use-connector-widget` (board/widgets) ← 依赖 uc-widgets-004-use-shape-widget

### wave 9 — 8 个，8 并行 lane

- ⛔待依赖 `uc-ava-008-use-voice-input` (ava) ← 依赖 uc-ava-007-attach-files-to-chat
- ⛔待依赖 `uc-board-header-006-use-voice-transcription` (board/header) ← 依赖 uc-board-header-005-manage-slides
- ⛔待依赖 `uc-board-menu-006-draw-on-canvas` (board/board-menu) ← 依赖 uc-board-menu-005-create-connector
- ⛔待依赖 `uc-context-menu-006-save-as-template` (board/context-menu) ← 依赖 uc-context-menu-005-export-selected-content
- ⛔待依赖 `uc-home-008-continue-last-chat` (home-page) ← 依赖 uc-home-007-start-recommended-feature, uc-ava-001-start-chat
- ⛔待依赖 `uc-team-008-view-team-home` (team) ← 依赖 uc-team-007-manage-team-general-settings
- ⛔待依赖 `uc-widget-menu-006-audio-to-text` (board/widget-menu) ← 依赖 uc-widget-menu-005-download-file-widget
- ⛔待依赖 `uc-widgets-006-use-draw-widget` (board/widgets) ← 依赖 uc-widgets-005-use-connector-widget

### wave 10 — 6 个，6 并行 lane

- ⛔待依赖 `uc-ava-009-use-suggested-actions` (ava) ← 依赖 uc-ava-008-use-voice-input
- ⛔待依赖 `uc-board-header-007-manage-board-backup` (board/header) ← 依赖 uc-board-header-006-use-voice-transcription
- ⛔待依赖 `uc-board-menu-007-create-chart` (board/board-menu) ← 依赖 uc-board-menu-006-draw-on-canvas
- ⛔待依赖 `uc-team-009-manage-team-memory` (team) ← 依赖 uc-team-008-view-team-home
- ⛔待依赖 `uc-widget-menu-007-use-widget-ai-assist` (board/widget-menu) ← 依赖 uc-widget-menu-006-audio-to-text
- ⛔待依赖 `uc-widgets-007-use-text-widget` (board/widgets) ← 依赖 uc-widgets-006-use-draw-widget

### wave 11 — 4 个，4 并行 lane

- ⛔待依赖 `uc-ava-010-react-copy-and-use-message` (ava) ← 依赖 uc-ava-009-use-suggested-actions
- ⛔待依赖 `uc-board-menu-008-upload-file` (board/board-menu) ← 依赖 uc-board-menu-007-create-chart
- ⛔待依赖 `uc-team-010-view-team-ai-store` (team) ← 依赖 uc-team-009-manage-team-memory, uc-ai-store-001-browse-items
- ⛔待依赖 `uc-widgets-008-use-chart-widget` (board/widgets) ← 依赖 uc-widgets-007-use-text-widget

### wave 12 — 4 个，4 并行 lane

- 🟢可开发 `uc-board-header-009-view-sync-status` (board/header) ← 依赖 uc-board-header-008-go-back-from-board
- ⛔待依赖 `uc-board-menu-009-use-resources-template` (board/board-menu) ← 依赖 uc-board-menu-008-upload-file
- 🟢可开发 `uc-widget-menu-009-refresh-widget` (board/widget-menu) ← 依赖 uc-widget-menu-008-delete-widget
- ⛔待依赖 `uc-widgets-009-use-image-widget` (board/widgets) ← 依赖 uc-widgets-008-use-chart-widget

### wave 13 — 3 个，3 并行 lane

- ⛔待依赖 `uc-board-menu-010-use-board-ai-assist` (board/board-menu) ← 依赖 uc-board-menu-009-use-resources-template
- ⛔待依赖 `uc-widget-menu-010-apply-format` (board/widget-menu) ← 依赖 uc-widget-menu-009-refresh-widget
- ⛔待依赖 `uc-widgets-010-use-active-selection-widget` (board/widgets) ← 依赖 uc-widgets-009-use-image-widget

### wave 14 — 3 个，3 并行 lane

- 🟢可开发 `uc-board-header-011-open-shortcuts-help` (board/header) ← 依赖 uc-board-header-010-undo-redo-board-operation
- ⛔待依赖 `uc-board-menu-011-create-link-widget` (board/board-menu) ← 依赖 uc-board-menu-010-use-board-ai-assist
- ⛔待依赖 `uc-widget-menu-011-align-selected-widgets` (board/widget-menu) ← 依赖 uc-widget-menu-010-apply-format

### wave 15 — 3 个，3 并行 lane

- ⛔待依赖 `uc-board-header-012-manage-board-settings` (board/header) ← 依赖 uc-board-header-011-open-shortcuts-help
- ⛔待依赖 `uc-board-menu-012-erase-drawing-content` (board/board-menu) ← 依赖 uc-board-menu-011-create-link-widget
- ⛔待依赖 `uc-widget-menu-012-edit-connector-style` (board/widget-menu) ← 依赖 uc-widget-menu-011-align-selected-widgets

### wave 16 — 1 个，1 并行 lane

- ⛔待依赖 `uc-widget-menu-013-edit-text-style` (board/widget-menu) ← 依赖 uc-widget-menu-012-edit-connector-style

### wave 17 — 2 个，2 并行 lane

- 🟢可开发 `uc-board-header-014-view-board-statistics` (board/header) ← 依赖 uc-board-header-013-view-welcome-guide
- ⛔待依赖 `uc-widget-menu-014-convert-text-to-sticky-notes` (board/widget-menu) ← 依赖 uc-widget-menu-013-edit-text-style

### wave 18 — 1 个，1 并行 lane

- ⛔待依赖 `uc-board-header-015-export-board-pdf` (board/header) ← 依赖 uc-board-header-014-view-board-statistics

