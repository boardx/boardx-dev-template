# Sprint p20/01 — wave0 骨架：详情壳/可见性/收藏/权限矩阵/邀请流/下线legacy画布

- **所属阶段**: Phase p20 (room-realignment)
- **创建于**: 2026-07-03 11:40:28

## 本 sprint 目标
wave0 骨架：详情壳/可见性/收藏/权限矩阵/邀请流/下线legacy画布

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, room) — 房间详情壳与 Tab 导航（Boards/Members/Files/Chat/Survey）
- F02 (P1, room) — 创建房间时选择可见性（Private/Team 二选一卡片）
- F07 (P1, room) — 房间权限矩阵统一（API 断言 + 文档对齐）
- F05 (P2, room) — 收藏房间与 Favorites 筛选
- F09 (P2, room) — 邀请未注册用户加入房间（完整流）
- F10 (P2, room) — 下线 legacy 单画布模型（迁移 + 路由收敛）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p20/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
