# Sprint p5/01 — Board 生命周期容器 CRUD（创建/打开/列表/收藏/元信息/复制/移动/删除/可见性/公开访问）

- **所属阶段**: Phase p5 (board)
- **创建于**: 2026-06-29 18:46:11

## 本 sprint 目标
Board 生命周期容器 CRUD（创建/打开/列表/收藏/元信息/复制/移动/删除/可见性/公开访问）

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, board) — 创建 Board
- F02 (P2, board) — 打开 Board（容器壳）
- F03 (P3, board) — 列表 / 搜索 / 最近访问
- F04 (P4, board) — 收藏 / 取消收藏 Board
- F05 (P5, board) — 更新 Board 元信息
- F06 (P6, board) — 复制 Board
- F07 (P7, board) — 移动 Board 到其他房间
- F08 (P8, board) — 删除 Board
- F09 (P9, board) — Board 可见范围（访问级别数据 + API）
- F10 (P10, board) — 通过公开链接查看/加入 Board

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p5/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
