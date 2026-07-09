# Sprint p23/01 — Portal wave 0 地基：门户骨架+全局待拍板通知（F01）与数据接入层+三态降级（F02）

- **所属阶段**: Phase p23 (developer-portal)
- **创建于**: 2026-07-09 11:32:17

## 本 sprint 目标
Portal wave 0 地基：门户骨架+全局待拍板通知（F01）与数据接入层+三态降级（F02）

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, portal) — 门户骨架：五 tab 导航 + 待人类拍板全局通知 + 访客分流带
- F02 (P1, portal) — 数据接入层：门户聚合 API + 全卡片三态与互不拖垮降级

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p23/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
