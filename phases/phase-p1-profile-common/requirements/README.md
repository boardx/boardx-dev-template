# 原始需求 — Profile（账号中心）

真实用例来源：`phases/requirements/profile/`（uc-profile-001..005）。本阶段（P1 补全）取核心 3 项：
- uc-profile-001 查看账号中心（Personal info / Security / Settings 三分区 + 用户菜单入口）
- uc-profile-002 编辑个人信息（display name + 头像选择 / AI 生成预览）
- uc-profile-005 管理账号设置（aiModel / 默认隐私 偏好）

复用：Security 分区 = phase-04 已有的修改密码（/account）。
DEFERRED：uc-profile-003 用户菜单细化、uc-profile-004 个人 Memory（归后续 Memory 能力）、真实 AI 头像生成。

oldcode 参考：`phases/requirements/oldcode/boardx-web-develop`（displayName/avatar/aiModel/privacy 字段）。
