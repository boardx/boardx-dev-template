# 进度日志 - Phase p27 AI Store

## 当前状态

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 当前最高优先级: F03 Complete Explore, navigation, and detail
- 计划规模: 12 Features / 6 Sprints / F01-F02 `passing`，其余 `not_started`
- Runtime 实现: Sprint 01 数据基础已完成；F03-F12 尚未开始。
- 基线门禁: 控制平面会话的 `./init.sh` 与 `pnpm -w run verify:base` 已通过；领取 F01 前仍须在实际实现 worktree 重新运行 `./init.sh`。

## 已完成

- 对照 `boardx-web`、`boardx-backend` 和模板仓库整理完整 AI Store 功能基线。
- 固定 Agent/Skill/Template Team 归属、BoardX 全员可见、USER/TEAM 订阅、实时版本、编辑分享和独立复制契约。
- 将 AI Tool 与 AI Image Tool 合并为 Skills，保留 `skillKind=text|image`。
- Harness 支持 `tracking_issue: 662`，Feature Issue body 自动回链 Parent Issue。
- 12 个 Feature 已按依赖分入 6 个 Sprint，派生视图一致。
- F01 已建立 `origin_team_id` / `consumer_team_id`、跨 Team 数据约束和无猜测迁移隔离。
- F02 已统一 `type=skill`、`skillKind=text|image`，增加 version、并发 409 和 RevisionAudit。

## 未开始边界

- F01/F02 evidence 位于 `sprints/sprint-01/evidence/`。
- F03-F12 不存在 passing 声明或成功 evidence。
- 远程 GitHub `--apply` 未执行；当前环境没有可用的 `gh` CLI/认证。

## 下一步

1. 认领 F03: `pnpm harness claim --phase p27 --feature F03 --owner <agent-id>`。
2. 先创建 `apps/web/e2e/ai-store-007-explore-complete.spec.ts`。
3. 完成 Explore、导航、详情和稳定 loading/empty/error/pagination 状态。
4. 运行 `pnpm harness verify --sprint p27/02 --feature F03`。
