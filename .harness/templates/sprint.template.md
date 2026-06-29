# Sprint {{PHASE_ID}}/{{SPRINT_ID}} — {{SPRINT_GOAL}}

- **所属阶段**: Phase {{PHASE_ID}} ({{PHASE_SLUG}})
- **创建于**: {{CREATED_AT}}

## 本 sprint 目标
{{SPRINT_GOAL}}

## 领取的 feature(引用自阶段权威清单,按 id)
{{FEATURE_REFS}}

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint {{PHASE_ID}}/{{SPRINT_ID}}` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
