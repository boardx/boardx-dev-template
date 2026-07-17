# 会话交接 - Sprint p27/02

## 当前已验证

- Parent Issue: [#679](https://github.com/boardx/boardx-dev-template/issues/679)
- F03 已通过完整 Explore Playwright 和全仓基础验证。
- Evidence: `evidence/F03.verify.log`。
- Team 切换隔离、Skills Tab、分页、详情来源/版本、错误重试均已覆盖。
- F04 已通过 authoring/archive Playwright 和全仓基础验证。
- Evidence: `evidence/F04.verify.log`。
- 041 迁移增加 `archived_at`；归档保留订阅并返回 `unavailable`，授权编辑保留来源 Team、审核状态和作者身份。

## 下一步

- 首个 Feature: F05 Team review and featured lifecycle。
- Claim: `pnpm harness claim --phase p27 --feature F05 --owner <agent-id>`。
- 验证: `apps/web/e2e/ai-store-006-approval-featured.spec.ts`。
- F05 门控: `pnpm harness verify --sprint p27/03 --feature F05`。

## 已知实现边界

- Explore 包含所有认证用户可见的 BoardX approved 资源，但使用仍需订阅。
- Create/Update 忽略客户端伪造 Team；Authorized editor 只能改内容。
- Archive 只允许来源 Team 中的所有者，已有订阅显示不可用。
