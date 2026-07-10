# Sprint p23/02 — Portal wave 1：五板块并行接入真数据（F03-F08）

- **所属阶段**: Phase p23 (developer-portal)
- **创建于**: 2026-07-09 15:26:57

## 本 sprint 目标
Portal wave 1：五板块并行接入真数据（F03-F08）

## 领取的 feature(引用自阶段权威清单,按 id)
- F03 (P1, portal) — 脉搏与进度板块：整体进度+周变化、flow-time 趋势、phase 下钻
- F04 (P1, portal) — 谁在干活 + PR 队列（堵点高亮与行动按钮）
- F06 (P1, portal) — 讨论流：人类/AI 分流 + 分级降噪 + 待拍板卡强化
- F05 (P2, portal) — 实时协调板块迁入门户（状态点语义化）
- F07 (P2, portal) — 加入开发：onboarding 向导（现实版）+ 学习页
- F08 (P2, portal) — 性能板块：按 开发者→agents 配对分组 + C-cycle 周期报告

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p23/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
