# 原始需求 — Profile（账号中心）

本阶段需求采用全量 Use Case 库的阶段快照。真实用例来源：`phases/requirements/profile/`（uc-profile-001..005）。本阶段（P1 补全）取核心 3 项，并复制到 `profile/` 子目录：

- `profile/uc-profile-001-view-profile.md`：查看账号中心（Personal info / Security / Settings 三分区 + 用户菜单入口）。
- `profile/uc-profile-002-edit-profile.md`：编辑个人信息（display name + 头像选择 / AI 生成预览）。
- `profile/uc-profile-005-manage-account-settings.md`：管理账号设置（aiModel / 默认隐私偏好）。

复用：Security 分区 = phase-04 已有的修改密码（/account）。
DEFERRED：uc-profile-003 用户菜单细化、uc-profile-004 个人 Memory（归后续 Memory 能力）、真实 AI 头像生成。

oldcode 参考：`phases/requirements/oldcode/boardx-web-develop`（displayName/avatar/aiModel/privacy 字段）。

每个 feature 必须在 `../feature_list.json` 的 `source_use_cases` 中指向上述阶段快照，避免只靠短 ID 追溯。
