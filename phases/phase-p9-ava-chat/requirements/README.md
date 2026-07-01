# 原始需求 — AVA / Chat (P9)（Phase p9）

> 这个**文件夹**是本阶段原始需求的家。按领域放多份 `*.md`（如 `auth.md`、`teams.md`、`rooms.md`），
> 每份用大白话/用户故事写即可。`00-overview.md` 是起始模板，可改名/拆分。

## 流水线
1. 往本文件夹写一份或多份原始需求 `*.md`。
2. 调 **requirement-author** 智能体：读取本文件夹**全部** `*.md` → 生成/更新 `../feature_list.json`。
3. 本文件夹是**输入/上下文，不是权威**；权威永远是 `../feature_list.json`（带可执行 `verification`）。
