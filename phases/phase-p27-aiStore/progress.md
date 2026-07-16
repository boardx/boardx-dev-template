# 进度日志 - Phase p27 AI Store

## 当前状态

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 当前最高优先级: F01 Team tenancy and migration audit
- 计划规模: 12 Features / 6 Sprints / 全部 `not_started`
- Runtime 实现: 尚未开始；本轮只完成需求和 Harness 控制平面。
- 基线门禁: 控制平面会话的 `./init.sh` 与 `pnpm -w run verify:base` 已通过；领取 F01 前仍须在实际实现 worktree 重新运行 `./init.sh`。

## 已完成

- 对照 `boardx-web`、`boardx-backend` 和模板仓库整理完整 AI Store 功能基线。
- 固定 Agent/Skill/Template Team 归属、BoardX 全员可见、USER/TEAM 订阅、实时版本、编辑分享和独立复制契约。
- 将 AI Tool 与 AI Image Tool 合并为 Skills，保留 `skillKind=text|image`。
- Harness 支持 `tracking_issue: 662`，Feature Issue body 自动回链 Parent Issue。
- 12 个 Feature 已按依赖分入 6 个 Sprint，派生视图一致。

## 未开始边界

- 不存在任何 P27 passing Feature 或成功 evidence。
- 未运行 `pnpm harness verify --sprint p27/*`，因为目标 runtime 测试尚未实现。
- 远程 GitHub `--apply` 未执行；当前环境没有可用的 `gh` CLI/认证。

## 下一步

1. 在实现 worktree 运行 `./init.sh`。
2. 只认领 F01: `pnpm harness claim --phase p27 --feature F01 --owner <agent-id>`。
3. 先创建 `packages/data/src/aiStore.teamIsolation.test.ts` 的失败测试。
4. F01 完成后运行 `pnpm harness verify --sprint p27/01 --feature F01`。
