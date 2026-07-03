# Sprint p16/01 — 全局导航接线 + UI差距审计 + design lint覆盖

- **所属阶段**: Phase p16 (ui-nav-alignment)
- **创建于**: 2026-07-03 00:46:39

## 本 sprint 目标
全局导航接线 + UI差距审计 + design lint覆盖

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, app-shell) — 全局导航接线：Ava / Surveys / Admin 入口
- F02 (P1, design) — UI 差距审计：Ava / Store / Surveys / Admin vs prototype
- F03 (P2, design) — Design lint 覆盖扩大到新增页面

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p16/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
