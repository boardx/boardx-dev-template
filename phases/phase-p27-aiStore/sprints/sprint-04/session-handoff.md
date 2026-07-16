# 会话交接 - Sprint p27/04

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F07 USER and TEAM subscriptions and use。
- Claim: `pnpm harness claim --phase p27 --feature F07 --owner <agent-id>`。
- 首个失败测试: `apps/web/e2e/ai-store-010-user-team-subscriptions.spec.ts`。
- F07 门控: `pnpm harness verify --sprint p27/04 --feature F07`。

## 依赖门禁

- F03、F06 未 passing 时不得开始 F07。
- F08 只依赖 F03，可由不同 owner 在 F03 passing 后并行。
- F08 首个测试为 `apps/web/e2e/ai-store-004-favorite-item.spec.ts`，门控为 `pnpm harness verify --sprint p27/04 --feature F08`。

## 已知实现边界

- 普通成员只能 USER 订阅；Team owner/admin 才能 TEAM 订阅。
- USER/TEAM 关系都强制当前 `consumerTeamId`，订阅不授予编辑权。
- Favorites 必须按 user + Team + item 隔离，乐观失败回滚。
