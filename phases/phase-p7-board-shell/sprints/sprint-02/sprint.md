# Sprint p7/02 — Board Header 框架收尾：标题编辑 + 分享 + 统计 + 备份恢复

- **所属阶段**: Phase p7 (board-shell)
- **创建于**: 2026-07-03 10:54:46

## 本 sprint 目标
Board Header 框架收尾：标题编辑 + 分享 + 统计 + 备份恢复

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, board-header) — Board Header 框架（状态/授权入口/返回/同步指示/撤销重做）
- F02 (P2, board-header) — Header 标题查看与编辑
- F03 (P3, board-header) — 分享 Board（链接 / 二维码 / 访问范围）
- F06 (P6, board-header) — Board 统计信息
- F08 (P8, board-header) — Board 备份与恢复

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p7/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
