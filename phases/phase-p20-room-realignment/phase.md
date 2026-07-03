# Phase p20 — Room Realignment

- **slug**: room-realignment
- **状态**: not_started
- **创建于**: 2026-07-03 10:50:50

## 目标
Room 对齐重构：修复 Room 相对原型与旧代码设计意图的结构性 gap——房间详情壳+tab 导航、创建时可见性、房间级文件库、收藏、删除契约、权限口径统一、Room Survey 入口、完整邀请流、下线 legacy 单画布、Room AI 上下文字段

## 范围与边界
- 本阶段交付:<在此列出本阶段必须达成的能力>
- 明确不做:<列出本阶段刻意排除、留到后续阶段的事项>

## 需求 → 功能清单 流水线
1. **原始需求**写进同目录的 `requirements/` 文件夹（可按领域放多份 `*.md`，人类语言、可模糊）。
2. 调 **requirement-author** 智能体：读 `requirements/` 全部 `*.md` → 生成/更新 `feature_list.json`
   （每个 feature 带可执行 `verification`）。
3. `requirements/` 是输入/上下文,**不是权威**;权威永远是 `feature_list.json`。

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
