# Sprint p11/02 — AI Store 创建/更新项目

- **所属阶段**: Phase p11 (ai-store)
- **目标 feature**: F02 — 创建/更新 AI Store 项目（各类型创建器 + 草稿/发布/提交审核）
- **工作树**: `/private/tmp/boardx-worktrees/issue-116-ai-store-f02-v2`

## 范围

- Create 视图：类型选择、创建器表单、必填校验、草稿/发布/提交审核动作。
- API：`POST /api/ai-store/items`、`PATCH /api/ai-store/items/:id`。
- 数据层：`ai_store_items.config` 迁移、创建/更新/owner 列表仓储函数。
- Authorized 视图：属主可看到并编辑自己的项目。

## 非范围

- F03 订阅/使用。
- F04 喜欢/收藏。
- F05 分享/协作授权。
- F06 审核批准/精选。
