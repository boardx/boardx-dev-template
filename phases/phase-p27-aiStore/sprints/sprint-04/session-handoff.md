# 会话交接 - Sprint p27/04

## 当前工作

- Parent Issue: [#679](https://github.com/boardx/boardx-dev-template/issues/679)
- F07/F08 已由 Harness 门控转为 `passing`。
- Evidence: `evidence/F07.verify.log`、`evidence/F08.verify.log`。
- 下一 Feature: Sprint 05 的 F09 Cross-Team edit sharing and Authorized/Shared。
- Claim: `pnpm harness claim --phase p27 --feature F09 --owner <agent-id>`。
- 首个测试: `apps/web/e2e/ai-store-011-cross-team-edit-share.spec.ts`。

## 依赖门禁

- F03、F06 与 F07 已 passing。
- Sprint 04 已完成，不存在未满足依赖或 `in_progress` Feature。

## 已知实现边界

- 普通成员只能 USER 订阅；Team owner/admin 才能 TEAM 订阅。
- USER/TEAM 关系都强制当前 `consumerTeamId`，订阅不授予编辑权。
- Favorites 必须按 user + Team + item 隔离，乐观失败回滚。
- `likes` 是跨消费 Team 的服务端聚合值；同一用户在不同 Team 可各自收藏一次。
- `views` 只在详情权限校验成功后原子增加，不可见资源的 404 不计数。
- 个人订阅和团队订阅都绑定当前 consumer Team；切换 Team 后源资源与订阅均不可跨 Team 使用。
- Explore 卡片对已有订阅显示 Manage，具体个人/团队范围在详情中管理，避免成员误删团队订阅。
