# Sprint p29/03 — Wave3 验证收口：F06 反向投影 + F07 MCP/CLI 的活体 e2e 与门控

- **所属阶段**: Phase p29 (coord-platform)
- **创建于**: 2026-07-18 05:56:28

## 本 sprint 目标
Wave3 验证收口：F06 反向投影 + F07 MCP/CLI 的活体 e2e 与门控

## 领取的 feature(引用自阶段权威清单,按 id)
- F06 (P3, coord) — 反向投影：租约→GitHub check/status，andon→阻断 commit status
- F07 (P3, coord) — MCP server + CLI：agent 接入面

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p29/03` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
