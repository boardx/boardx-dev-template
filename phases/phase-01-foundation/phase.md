# Phase 01 — Foundation

- **slug**: foundation
- **状态**: in_progress
- **创建于**: 2026-06-29 00:11:38

## 目标
搭好 monorepo 骨架、harness 控制平面与基础验证回路

## 范围与边界
- 本阶段交付:<在此列出本阶段必须达成的能力>
- 明确不做:<列出本阶段刻意排除、留到后续阶段的事项>

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
