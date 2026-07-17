# 会话交接 - Sprint p27/05

## 当前工作

- Parent Issue: [#679](https://github.com/boardx/boardx-dev-template/issues/679)
- F09 已由 Harness 门控转为 `passing`，evidence: `evidence/F09.verify.log`。
- 下一 Feature: F10 allowCopy and independent resource copies。
- Claim: `pnpm harness claim --phase p27 --feature F10 --owner <agent-id>`。
- 首个测试: `apps/web/e2e/ai-store-012-copy-resources.spec.ts`。
- F10 门控: `pnpm harness verify --sprint p27/05 --feature F10`。

## 依赖门禁

- F04/F09 已 passing，F10 依赖已满足。
- F10 首个测试为 `apps/web/e2e/ai-store-012-copy-resources.spec.ts`，门控为 `pnpm harness verify --sprint p27/05 --feature F10`。

## 已知实现边界

- Edit share 始终编辑原 item，不改 `createdBy`/`originTeamId`。
- Authorized editor 不能管理生命周期、`allowCopy`、分享或 archive。
- Copy 创建独立 draft；Template Board 必须深拷贝到目标 Team。
- Edit grant 绑定接受时的 consumer Team；切换 Team 后 Authorized 与编辑权限都不可见。
- Shared 只展示当前来源 Team 的 owned resources，授权编辑 UI 不提供类型、可见性或生命周期操作。
