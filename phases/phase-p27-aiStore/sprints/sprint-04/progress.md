# 进度日志 - Sprint p27/04

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- Features: F07 USER and TEAM subscriptions and use; F08 Favorites and view statistics.
- 状态: F07/F08 均 `passing`。
- 依赖: F07 的 F03/F06 依赖已满足；F08 的 F03 依赖已满足。
- F07 验证: `pnpm --filter @repo/web exec playwright test e2e/ai-store-010-user-team-subscriptions.spec.ts`。
- F08 验证: `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`。
- F07 evidence: `evidence/F07.verify.log`；权威 E2E 与 `pnpm -w run verify:base` 均通过。
- F08 evidence: `evidence/F08.verify.log`；8 条权威 E2E 与 `pnpm -w run verify:base` 均通过。
- F07 已完成: USER/TEAM 两种订阅、管理员权限、团队成员继承、Team 隔离、独立取消、三类资源使用及最新版本同步。
- F08 已完成: user + consumer Team + item 收藏隔离、原子聚合计数、授权详情浏览统计和失败回滚。
- 下一步: Sprint 05 认领 F09，完成跨 Team 编辑分享和 Authorized/Shared 闭环。
