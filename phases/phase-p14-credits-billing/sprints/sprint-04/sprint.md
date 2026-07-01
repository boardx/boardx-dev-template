# Sprint p14/04 — 积分流水查看 + 购买积分 + 升级计划

- **所属阶段**: Phase p14 (credits-billing)
- **创建于**: 2026-07-01 19:03:15

## 本 sprint 目标
积分流水查看 + 购买积分 + 升级计划

## 领取的 feature(引用自阶段权威清单,按 id)
- F02 (P2, credits) — 购买积分（Buy Credits 弹窗 + 套餐 + 扫码下单）
- F03 (P2, credits) — 积分流水查看（个人 Credit Records 弹窗 + 团队记录）
- F04 (P2, billing) — 升级/管理个人计划（订阅弹窗 + credits 模式路由 + 额度不足触发）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p14/04` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
