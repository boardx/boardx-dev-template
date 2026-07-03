# Sprint p6/08 — Wave0 地基：对齐参考线 + 渲染引擎切 Fabric.js + 数据模型字段级 patch

- **所属阶段**: Phase p6 (canvas)
- **创建于**: 2026-07-03 10:54:24

## 本 sprint 目标
Wave0 地基：对齐参考线 + 渲染引擎切 Fabric.js + 数据模型字段级 patch

## 领取的 feature(引用自阶段权威清单,按 id)
- F07 (P7, canvas) — 拖动时的对齐参考线
- F13 (P13, canvas) — 画布渲染引擎切换为 Fabric.js（既有行为不回归）
- F14 (P14, canvas) — packages/canvas 数据模型改造为字段级 patch（CRDT-ready）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p6/08` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
