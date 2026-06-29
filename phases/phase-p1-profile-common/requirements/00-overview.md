# 需求概览 — Profile & Common (P1 补全)

> 本文件只保留阶段范围说明，不再作为占位模板。可执行的阶段 Use Case 已落在
> `profile/uc-profile-001-view-profile.md`、`profile/uc-profile-002-edit-profile.md`、
> `profile/uc-profile-005-manage-account-settings.md`。

## 背景 / 为什么做
Phase 04 已具备认证、会话和改密能力，但用户仍缺少统一账号中心来查看资料、编辑个人信息和维护个人默认偏好。本阶段补齐账号中心的核心 Profile 与 Settings 能力。

## 原始需求（用户故事 / 大白话都行）
- 作为注册用户，我想从用户菜单进入账号中心，并在 Personal info、Security、Settings 三个分区之间切换。
- 作为注册用户，我想编辑显示名和头像，使用户菜单和账号资料展示最新个人信息。
- 作为注册用户，我想设置 AI 模型偏好和默认隐私级别，使后续工作区能力使用我的默认设置。

## 验收线索（可观察的成功是什么样）
- `/account` 默认展示 Personal info，并可切换 Security / Settings。
- 用户菜单显示当前头像、显示名，并提供 Profile / Settings / 登出入口。
- 保存个人信息后，用户菜单和账号中心展示最新显示名与头像。
- 保存账号设置后，重新读取 Settings 能看到最新 AI 模型偏好与默认隐私级别。

## 范围与边界
- 本阶段要做：账号中心三分区、个人信息编辑、账号设置偏好。
- 明确不做（留到后续）：用户菜单高级细化、个人 Memory、真实 AI 头像生成、Team/Room/Board 设置。

## 已知约束 / 依赖
- 依赖 CAP-AUTH：登录态、当前用户、改密能力。
- Security 分区复用 Phase 04 已实现的修改密码路径。
- 账号设置只影响当前用户默认偏好，不修改已有 Team、Room 或 Board 的策略。

## 切分提示（给 requirement-author 的建议，可留空）
- F01：账号中心三分区 + 用户菜单入口。
- F02：编辑个人信息（显示名 + 头像）。
- F03：账号设置偏好（AI 模型 / 默认隐私）。
