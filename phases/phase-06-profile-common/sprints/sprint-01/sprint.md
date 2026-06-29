# Sprint 06/01 — 账号中心：分区+编辑资料+设置

- **所属阶段**: Phase 06 (profile-common)
- **创建于**: 2026-06-29 14:01:09

## 本 sprint 目标
账号中心：分区+编辑资料+设置

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, profile) — 账号中心三分区 + 用户菜单入口
- F02 (P2, profile) — 编辑个人信息（显示名 + 头像）
- F03 (P3, profile) — 账号设置偏好（AI 模型 / 默认隐私）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint 06/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
