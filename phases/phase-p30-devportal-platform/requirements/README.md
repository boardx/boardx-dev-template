# 原始需求 — devportal-platform（Phase p30）

> 这个**文件夹**是本阶段原始需求的家。按领域放多份 `*.md`（如 `auth.md`、`teams.md`、`rooms.md`），
> 每份用大白话/用户故事写即可。`00-overview.md` 是起始模板，可改名/拆分。

## 流水线
1. 往本文件夹写一份或多份原始需求 `*.md`。
2. 调 **requirement-author** 智能体：读取本文件夹**全部** `*.md` → 生成/更新 `../feature_list.json`。
3. 本文件夹是**输入/上下文，不是权威**；权威永远是 `../feature_list.json`（带可执行 `verification`）。

## p30 状态（2026-07-19）
- requirement-author 已产出提案：[feature-list-draft.md](feature-list-draft.md)（24 features / 5 waves）。
- 依 ADR-003，`../ui-signoff.md` 仍 `pending`，故只出提案不出权威 JSON；
  签核后按提案文末「转正步骤」由 coordinator 生成 `../feature_list.json`。
