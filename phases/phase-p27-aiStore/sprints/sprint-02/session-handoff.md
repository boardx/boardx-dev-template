# 会话交接 - Sprint p27/02

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F03 Complete Explore, navigation, and detail。
- Claim: `pnpm harness claim --phase p27 --feature F03 --owner <agent-id>`。
- 首个失败测试: `apps/web/e2e/ai-store-007-explore-complete.spec.ts`。
- F03 门控: `pnpm harness verify --sprint p27/02 --feature F03`。

## 依赖门禁

- F01、F02 未 passing 时不得开始 F03 或 F04。
- F04 可与 F03 在不同 owner 下并行，但仍必须先满足 F01/F02。
- F04 首个测试为 `apps/web/e2e/ai-store-008-authoring-archive.spec.ts`，门控为 `pnpm harness verify --sprint p27/02 --feature F04`。

## 已知实现边界

- Explore 包含所有认证用户可见的 BoardX approved 资源，但使用仍需订阅。
- Create/Update 忽略客户端伪造 Team；Authorized editor 只能改内容。
- Archive 只允许所有者，已有订阅显示不可用。
