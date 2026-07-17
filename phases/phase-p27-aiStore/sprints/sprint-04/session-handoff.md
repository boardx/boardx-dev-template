# 会话交接 - Sprint p27/04

## 当前工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- F07 已由 Harness 门控转为 `passing`，evidence: `evidence/F07.verify.log`。
- 下一 Feature: F08 Favorites and view statistics。
- Claim: `pnpm harness claim --phase p27 --feature F08 --owner <agent-id>`。
- 首个测试: `apps/web/e2e/ai-store-004-favorite-item.spec.ts`。
- F08 门控: `pnpm harness verify --sprint p27/04 --feature F08`。

## 依赖门禁

- F03、F06 与 F07 已 passing。
- F08 的 F03 依赖已满足。
- F08 首个测试为 `apps/web/e2e/ai-store-004-favorite-item.spec.ts`，门控为 `pnpm harness verify --sprint p27/04 --feature F08`。

## 已知实现边界

- 普通成员只能 USER 订阅；Team owner/admin 才能 TEAM 订阅。
- USER/TEAM 关系都强制当前 `consumerTeamId`，订阅不授予编辑权。
- Favorites 必须按 user + Team + item 隔离，乐观失败回滚。
- 个人订阅和团队订阅都绑定当前 consumer Team；切换 Team 后源资源与订阅均不可跨 Team 使用。
- Explore 卡片对已有订阅显示 Manage，具体个人/团队范围在详情中管理，避免成员误删团队订阅。
