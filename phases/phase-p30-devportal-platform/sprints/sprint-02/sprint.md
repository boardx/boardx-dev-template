# Sprint p30/02 — W2: onboard接真/join审批/enroll真实现/me真数据/三层意图协议/R1 CoordBrain影子模式

- **所属阶段**: Phase p30 (devportal-platform)
- **创建于**: 2026-07-19 06:37:08

## 本 sprint 目标
W2: onboard接真/join审批/enroll真实现/me真数据/三层意图协议/R1 CoordBrain影子模式

## 领取的 feature(引用自阶段权威清单,按 id)
- F05 (P2, platform) — GitHub App 多仓安装流：/onboard 接真（UC-01 接入体检真实现）
- F06 (P2, platform) — 加入审批流 + SLA：P2 join 向导与 W6 审批队列接真（UC-04）
- F07 (P2, auth) — enroll 真实现：命名空间 / 一次性 token / 首心跳点亮（UC-06）
- F08 (P2, devportal) — /me 三栏真数据 + D4 登录落点（UC-09）
- F09 (P2, coord) — 三层意图消息协议 v1（UC-11：assign…decide，CHANGELOG 演进）
- F10 (P2, coord) — R1：CoordBrain 影子模式（只读观察 + 零误判周期）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p30/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
