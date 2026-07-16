# 会话交接 - Sprint p27/05

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F09 Cross-Team edit sharing and Authorized/Shared。
- Claim: `pnpm harness claim --phase p27 --feature F09 --owner <agent-id>`。
- 首个失败测试: `apps/web/e2e/ai-store-011-cross-team-edit-share.spec.ts`。
- F09 门控: `pnpm harness verify --sprint p27/05 --feature F09`。

## 依赖门禁

- F04 未 passing 时不得开始 F09 或 F10。
- F10 还依赖 F09，分享与所有权边界通过前不得实现复制。
- F10 首个测试为 `apps/web/e2e/ai-store-012-copy-resources.spec.ts`，门控为 `pnpm harness verify --sprint p27/05 --feature F10`。

## 已知实现边界

- Edit share 始终编辑原 item，不改 `createdBy`/`originTeamId`。
- Authorized editor 不能管理生命周期、`allowCopy`、分享或 archive。
- Copy 创建独立 draft；Template Board 必须深拷贝到目标 Team。
