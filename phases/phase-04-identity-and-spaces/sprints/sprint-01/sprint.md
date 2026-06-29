# Sprint 04/01 — Auth 域：注册/登录会话登出/改密/找回密码/社交骨架

- **所属阶段**: Phase 04 (identity-and-spaces)
- **创建于**: 2026-06-29 07:28:29

## 本 sprint 目标
Auth 域：注册/登录会话登出/改密/找回密码/社交骨架

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, auth) — 邮箱注册账号
- F02 (P2, auth) — 邮箱登录、会话与登出
- F03 (P3, auth) — 修改密码（账号中心 Security）
- F04 (P4, auth) — 忘记/重置密码（DB 令牌 + dev 邮件）
- F05 (P5, auth) — 社交登录骨架（占位，不接真 OAuth）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint 04/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
