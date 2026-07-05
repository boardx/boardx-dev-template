# Sprint p21/01 — 安全加固+证据补齐:auth社交登录后门gate、team owner越权修复优先,其余证据/文档同步类feature并行

- **所属阶段**: Phase p21 (platform-accounts-hardening)
- **创建于**: 2026-07-04 19:59:51

## 本 sprint 目标
安全加固+证据补齐:auth社交登录后门gate、team owner越权修复优先,其余证据/文档同步类feature并行

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, auth) — 社交登录后门修正（生产环境 gate + F05 如实改写）
- F02 (P1, team) — 团队成员角色接口越权修复（owner 保护）
- F03 (P2, auth) — Auth F01-F04 证据补齐 + confirm-email 真实实现
- F04 (P2, team) — Team F06-F09 证据补齐 + F13 状态拆分回填
- F05 (P3, billing) — Billing F04「额度不足触发」如实改写
- F06 (P4, profile) — Profile/Home 文档与追踪字段同步

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p21/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
