# 进度日志 - Sprint p27/04

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- Features: F07 USER and TEAM subscriptions and use; F08 Favorites and view statistics.
- 状态: F07/F08 均 `not_started`，无 evidence。
- 依赖: F07 等待 F03 与 F06；F08 等待 F03。
- F07 验证: `pnpm --filter @repo/web exec playwright test e2e/ai-store-010-user-team-subscriptions.spec.ts`。
- F08 验证: `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`。
- blocker: Explore 和 BoardX approved 生命周期尚未实现。
- 下一步: 依赖满足后认领 F07，先写普通成员 TEAM 订阅 403 与跨 Team 使用失败测试。
