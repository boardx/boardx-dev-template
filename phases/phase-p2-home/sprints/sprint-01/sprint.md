# Sprint p2/01 — Home 工作台壳 + Agent 分组空状态 + 最近白板 + Onboarding（Agent 卡片数据待 p11、AVA 动作待 p9）

- **所属阶段**: Phase p2 (home)
- **创建于**: 2026-06-29 19:40:23

## 本 sprint 目标
Home 工作台壳 + Agent 分组空状态 + 最近白板 + Onboarding（Agent 卡片数据待 p11、AVA 动作待 p9）

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, home-page) — Home 工作台壳与欢迎区
- F02 (P2, home-page) — Agent 分组与卡片渲染（含空状态）
- F03 (P3, home-page) — Home 内 Agent 搜索过滤
- F04 (P4, home-page) — Recent 页占位（忠于真实「开发中」状态）
- F05 (P5, home-page) — 最近白板入口（跳转 Board）
- F07 (P7, home-page) — 新用户 Onboarding 空状态引导

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p2/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
