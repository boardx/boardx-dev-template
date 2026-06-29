# Sprint p4/01 — 房间聊天线程 CRUD（列表/创建/打开三栏壳/删除）；发消息 blocked-on p9

- **所属阶段**: Phase p4 (room-chat)
- **创建于**: 2026-06-29 19:55:47

## 本 sprint 目标
房间聊天线程 CRUD（列表/创建/打开三栏壳/删除）；发消息 blocked-on p9

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, room-chat) — 房间 Chat 页签与线程列表
- F02 (P2, room-chat) — 新建房间聊天线程并进入三栏工作区
- F03 (P3, room-chat) — 打开线程详情（含他人线程只读态）
- F04 (P4, room-chat) — 删除房间聊天线程

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p4/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
