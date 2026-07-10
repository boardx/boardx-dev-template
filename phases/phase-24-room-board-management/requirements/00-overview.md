# Phase 24 — Room 内 Board 列表管理（原始需求）

> 输入文档,非权威。权威是人类确认 UI 后由 requirement-author 生成的 feature_list.json。

## 来源与背景

差距分析(2026-07-10,coord-room)对比了三方:
- **Prototype**(`phases/requirements/BoardX UI Prototype V1.html`):board 列表是**薄视觉稿**,唯一成熟能力是 **Grid/List 视图切换**;卡片只显示名称+时间+纯色块图标;无 tag、无缩略图上传、无卡片操作菜单、无创建表单(点 New board 直接进编辑页)。tag 系统只存在于 AI Store,不适用于 board。
- **Oldcode**(`phases/requirements/board/uc-board-00{1,3,5,8}.md`):board 列表是**完整产品规格**——新建带**多标签**(chip、Enter 添加、可移除);卡片"更多操作"菜单含 重命名/编辑标签/上传·移除封面/删除/复制/移动;收藏星标;封面为**手动上传**(文件选择器),无画布自动快照;列表支持关键词搜索 + 收藏过滤。**oldcode 也没有"按 tag 过滤"**。
- **现状(2026-07-10 更正,以最新 main 为准)**(`apps/web/app/(app)/rooms/[id]/boards/page.tsx`):main 上 board 列表**已是卡片版**——已有 Grid/List 视图切换(`boards-view-grid`/`boards-view-list`,偏好存 localStorage)、缩略图色块兜底(`thumbTone`)、创建 Dialog(#469 已闭,复用 `ui/dialog`)、收藏星标、复制、room 徽章、更新日期、名称搜索。**卡片化与创建弹窗都已完成**。
  - ⚠️ 先前差距分析曾把现状误报成"纯文本行列表",系读了落后 main 17 个 commit 的 worktree 旧代码所致,已更正。
  - **真实仍缺(经最新 main 与真机截图核对)**:① 卡片"三点更多操作"菜单(`ui/dropdown-menu` main 也没有,需新增);② 删除/重命名/移动(菜单内);③ **多标签**全套(新建打标、卡片显示 chips、编辑标签、按 tag 过滤);④ 上传·移除封面(后端 `PATCH cover` 就绪,无 UI)。

**权威目标 = main 现状(卡片化/视图切换/创建弹窗已就绪) + 补齐上述真实缺口(菜单 + 多标签 + tag 过滤 + 封面上传),扩展 main 的真实 boards 页,不另起炉灶。**

## 后端就绪度(关键:缺口几乎全在前端)

现库 `boards` 表(007_board.sql)已有 `cover`(封面 URL)、`category`(单值类别)、`description` 列。已就绪端点:
- `PATCH /api/boards/:id` — 改 name/category/cover/description(管理员)
- `DELETE /api/boards/:id`、`/boards/:id/move`、`/boards/:id/duplicate`、`/boards/:id/favorite`
- `listBoardsInRoom` 已返回 cover/category
- 文件上传设施 `/api/rooms/:id/files`(presigned + confirm)可复用做封面上传

**未就绪(本阶段要补的后端)**:
1. **多标签 schema**:人类 2026-07-10 拍板用**多标签**(非单值 category)。需 `ALTER TABLE boards ADD COLUMN tags text[] NOT NULL DEFAULT '{}'`;create/update/list 支持 tags 数组;`GET /rooms/:id/boards?tags=` 过滤参数;`PATCH tags[]`。
2. **ui 基座**:`ui/dialog` **main 已有**(#469 已闭),本阶段仅给它**加可选 `description`/`footer`**(已做,向后兼容);**新增** `ui/dropdown-menu`(main 无,已建)。

## 目标能力(更正后:main 已做的不重做,只补真实缺口。build order F02→F04→F03/F05)

- **F02 多标签 schema + 后端底座**:`boards.tags text[]` migration;createBoard/updateBoard/listBoardsInRoom 支持 tags + `?tags=` 过滤;`PATCH tags[]`。展示/过滤/编辑都依赖它。
- ~~F01 列表卡片化 + Grid/List 切换~~ → **main 已完成**(卡片网格 + `boards-view-grid`/`boards-view-list` + 缩略图色块兜底)。本阶段仅**在卡片上加 tag chips**(依赖 F02)。
- **F03 新建 Board 加多标签**:创建 Dialog **main 已有**,仅在其表单里**加多标签输入**(`tag-input.tsx`,chip/Enter/可移除)+ 可选封面上传;POST 带 tags。
- **F04 卡片"更多操作"菜单**:在 main 卡片上加三点菜单(`ui/dropdown-menu`)→ 重命名 / 编辑标签(`edit-tags-dialog.tsx` 多标签)/ 上传·移除封面 / 移动到其他房间 / 删除(二次确认)。全部接已就绪端点(`PATCH`/`DELETE`/`move`)。
- **F05 按 tag 过滤列表**:列表顶部 tag 过滤器(chips 多选)驱动 `?tags=`,与名称搜索并存。

## UI 先行交付形态(本阶段当前步)

真实组件写入 `apps/web`(mock 数据渲染,关键元素带 data-testid),截图存 `ui-preview/`,填 `ui-signoff.md` 等人类确认。确认后:接后端 + 落 F02 schema,UI 复用不重写。

## data-testid 锚点规划(供后续 verification/e2e)

- 视图:`board-grid`、`board-list-view`、`board-view-toggle-grid`、`board-view-toggle-list`
- 卡片:`board-card-<id>`、`board-card-cover-<id>`、`board-card-tag-<id>-<tag>`、`board-card-fav-<id>`、`board-card-menu-<id>`
- 卡片菜单项:`board-menu-rename-<id>`、`board-menu-tags-<id>`、`board-menu-cover-<id>`、`board-menu-move-<id>`、`board-menu-delete-<id>`
- 新建弹窗:`board-create-dialog`、`board-create-name`、`board-create-tag-input`、`board-create-tag-<tag>`、`board-create-cover`、`board-create-submit`
- 编辑标签弹窗:`board-tags-dialog`、`board-tags-input`、`board-tags-save`
- 删除确认:`board-delete-dialog`、`board-delete-confirm`
- tag 过滤:`board-tag-filter`、`board-tag-filter-<tag>`、`board-filter-clear`
