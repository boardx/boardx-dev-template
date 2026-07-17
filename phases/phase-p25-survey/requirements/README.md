# 原始需求 — Survey System（Phase p25）

> 这个**文件夹**是本阶段原始需求的家。按领域放多份 `*.md`（如 `auth.md`、`teams.md`、`rooms.md`），
> 每份用大白话/用户故事写即可。`00-overview.md` 是起始模板，可改名/拆分。

## 流水线
1. 往本文件夹写一份或多份原始需求 `*.md`。
2. 调 **requirement-author** 智能体：读取本文件夹**全部** `*.md` → 生成/更新 `../feature_list.json`。
3. 本文件夹是**输入/上下文，不是权威**；权威永远是 `../feature_list.json`（带可执行 `verification`）。

## p25 源基线

- `00-survey-system-requirements-baseline.md`：2026-07-14 系统现状与目标基线。
- `01-source-stash-ui-fidelity.md`：首次发现未提交首页漏同步的纠偏要求。
- `02` 至 `10`：从 `boardx-survey` 的 `codex-survey-home-nav-redesign` stash 同步的商业、专业、AI、发布、动态报告、分类报告和模板编辑需求/设计输入。
- `11-source-capability-matrix.md`：不可变源快照、主仓差距、同步原则和 F09-F14 归属。

权威源由分支 HEAD 与 stash tree 共同组成，具体 SHA 见 `11-source-capability-matrix.md`。
