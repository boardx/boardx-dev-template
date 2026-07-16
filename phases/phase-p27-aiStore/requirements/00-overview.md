# Phase p27 AI Store 需求总览

## 背景

`boardx-web` 与 `boardx-backend` 已有 AI Store 的浏览、创作、发布审核、订阅使用、收藏、管理分享、精选、Agent Builder 和推荐闭环；模板仓库 P11 也已有主要 E2E 基线。P27 的目标不是重写商店，而是把这些能力整理成 Team-aware、可迁移、可验收的统一产品契约。

本阶段唯一总追踪为 [GitHub Issue #662](https://github.com/boardx/boardx-dev-template/issues/662)，仓库内 `feature_list.json` 仍是执行状态的唯一权威。

## 已确认产品规则

- Agent、Skill、Template 都有不可为空、普通编辑不可改变的 `originTeamId`。
- AI Tool 与 AI Image Tool 合并为用户可见类型 Skills；规范类型为 `type=skill`，执行差异为 `skillKind=text|image`。
- Team A 的资源首次发布到 BoardX 必须由 BoardX 系统管理员审核。
- BoardX approved 资源对所有已登录 BoardX 用户可见，不要求用户属于来源 Team。
- 普通 Team 成员只能在当前 Team 创建或取消自己的 USER 订阅。
- 当前 Team 的 owner/admin 可创建或取消 TEAM 订阅，也可只为自己创建 USER 订阅。
- Team B 对 Team A 的 approved 资源存在 USER 或 TEAM 订阅后，才可按订阅范围在 Team B 使用。
- approved 资源后续编辑不重新审核；保存后立即成为最新版，所有订阅者下次读取或执行时自动生效。
- 编辑分享授权接收者跨 Team 编辑原资源，不转移所有权或来源 Team。
- `allowCopy=true` 时，查看者可在当前 Team 创建独立新资源；副本不再跟随原资源。

## 目标用户与故事

- 访客在 Explore 中搜索、筛选和查看全部 approved BoardX 资源及当前 Team 自有资源。
- 创作者在当前 Team 创建 Agent、Skill、Template，预览、保存草稿、编辑、归档和提交审核。
- Team owner/admin 审核 Team 发布、设置 Team Featured，并可为团队订阅资源。
- BoardX Admin 审核 BoardX 发布、撤回 approved 状态和设置 BoardX Featured。
- 普通成员为自己订阅；团队管理员可为整个 Team 订阅。
- 所有者可分享编辑链接、查看授权列表、关闭链接或撤销单个用户。
- 被授权者在 Authorized 中编辑原资源，但不能改变所有权、生命周期、复制开关或分享权限。
- 查看者在允许复制时把资源复制到当前 Team，得到私有独立草稿。
- AVA、Template 使用入口和 Agent Builder 继续消费 AI Store 能力。

## 成功标准

1. Explore、Detail、Create、Edit、Preview、Archive、发布审核、订阅使用、收藏统计、分享授权、复制、Agent Builder 和推荐均有端到端契约。
2. BoardX approved 资源对所有认证用户可见，但跨 Team 使用必须有当前 Team 下的 USER 或 TEAM 订阅。
3. USER/TEAM 订阅权限由服务端可信 Team 角色判断，普通成员请求 TEAM 订阅返回 403。
4. 所有订阅始终解析源资源最新版；approved 内容编辑不改变 approved 状态，也不进入 pending。
5. 编辑授权不会改写 `createdBy` 或 `originTeamId`；撤销后立即失效。
6. 复制创建新 `itemId` 和当前 Team 归属，且不继承关系、审核、精选、统计或分享。
7. 旧工具类型原位迁移，不改变 item id，已有订阅、收藏、分享、审核、精选和统计关系可继续使用。
8. Agent 与 Template 既有使用方式不回归。

## 范围外

- 不重新设计 AI Store 视觉系统。
- 不把 Agent 或 Template 合并进 Skills。
- 不引入仅有枚举而无完整商店闭环的 Model、Dataset 分类。
- 不重写文本或图片执行引擎；只统一商店模型和分派契约。
- 不提供 RevisionAudit 回滚 UI。
- 不提供归档恢复功能。
