# Phase p30 — Harness V2

- **slug**: harness-v2
- **状态**: not_started
- **创建于**: 2026-07-18 07:09:03

## 目标
建立供应商中立、可持久恢复、可评估且可渐进迁移的长期 Agent Harness 产品

## 范围与边界
- 本阶段交付:核心协议、durable runtime、workspace/sandbox 适配、provider adapters、
  Evaluation/Artifact、coord-platform 集成和 V1 渐进迁移。
- 明确不做:重写 p29 coord-platform、把 GitHub 变成 Run 权威、绑定单一模型供应商、
  用一个巨型 PR 完成全部迁移。

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
