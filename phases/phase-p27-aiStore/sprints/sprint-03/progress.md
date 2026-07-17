# 进度日志 - Sprint p27/03

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- Features: F05 Team review and featured lifecycle; F06 BoardX review, featured, and live approved updates.
- 状态: F05、F06 均为 `passing`。
- 依赖: F04、F05 已 passing，F06 已完成。
- F05 验证: `pnpm --filter @repo/web exec playwright test e2e/ai-store-006-approval-featured.spec.ts`。
- F06 验证: `pnpm --filter @repo/web exec playwright test e2e/admin-003-ai-store-approval.spec.ts e2e/admin-004-featured-ai-store.spec.ts e2e/ai-store-009-live-approved-updates.spec.ts`。
- F05 evidence: `evidence/F05.verify.log`。
- F06 evidence: `evidence/F06.verify.log`。
- F05 已覆盖 owner/admin 审核与精选、普通成员 403、跨 Team 隔离、非法状态 409 和 published 内容免复审更新。
- F06 已覆盖 BoardX 审核/精选、approved 内容免复审实时更新、既有订阅读取最新版本，以及撤回后禁止新订阅和新执行。
- 下一步: 进入 sprint p27/04，按依赖认领 F07 USER/TEAM subscriptions and use。
