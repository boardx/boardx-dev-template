# Sprint p29/02 — Wave2 协调内核：F03 gateway ingest + F04 实时镜像 + F05 原子租约（RepoHub DO）

- **所属阶段**: Phase p29 (coord-platform)
- **创建于**: 2026-07-18 03:08:35

## 本 sprint 目标
Wave2 协调内核：F03 gateway ingest + F04 实时镜像 + F05 原子租约（RepoHub DO）

## 领取的 feature(引用自阶段权威清单,按 id)
- F03 (P2, coord) — GitHub App + webhook ingest（coord-gateway + Queues 幂等）
- F04 (P2, coord) — RepoHub DO：issue/PR 实时镜像 + GET /realtime/*
- F05 (P2, coord) — RepoHub DO：原子租约（claim/heartbeat/TTL/alarm 回收）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p29/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
