# Sprint p30/01 — W1 平台底座：F01 目录 DO + F02 OAuth 灰度 + F03 路由鉴权 + F04 数据分片

- **所属阶段**: Phase p30 (devportal-platform)
- **创建于**: 2026-07-18 21:53:47

## 本 sprint 目标
W1 平台底座：F01 目录 DO + F02 OAuth 灰度 + F03 路由鉴权 + F04 数据分片

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, coord) — 平台目录 DO：Project/Membership/Enrollment 领域模型
- F02 (P1, auth) — GitHub OAuth 登录（D3 阶段 2：公开层免登录 + 工作区 OAuth，原子灰度）
- F03 (P1, devportal) — /p/:slug 路由化 + 成员鉴权（服务端角色裁剪 + 无权限态）
- F04 (P1, coord) — 工作区数据按项目分片（需求/sprint/对话流入项目 DO）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p30/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
