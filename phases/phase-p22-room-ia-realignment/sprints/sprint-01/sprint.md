# Sprint p22/01 — 双栏壳+Files职责边界+Studio独立tab+Board面包屑

- **所属阶段**: Phase p22 (room-ia-realignment)
- **创建于**: 2026-07-08 00:29:05

## 本 sprint 目标
双栏壳+Files职责边界+Studio独立tab+Board面包屑

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, room) — Room 主从（master-detail）双栏布局壳
- F02 (P2, room-files) — Room Files 双入口职责边界（Files tab 权威 + Chat 面板轻量引用）
- F03 (P2, room) — Studio 独立顶级 tab（房间详情六 tab 结构）
- F04 (P3, room) — Board 详情页面包屑回退至所属房间

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p22/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
