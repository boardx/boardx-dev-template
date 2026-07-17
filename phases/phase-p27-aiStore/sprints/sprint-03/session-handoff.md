# 会话交接 - Sprint p27/03

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F05 Team review and featured lifecycle。
- Claim: `pnpm harness claim --phase p27 --feature F05 --owner <agent-id>`。
- 首个失败测试: `apps/web/e2e/ai-store-006-approval-featured.spec.ts`。
- F05 门控: `pnpm harness verify --sprint p27/03 --feature F05`。

## 依赖门禁

- F04 未 passing 时不得开始 F05。
- F06 依赖 F05，必须在 Team 生命周期通过后开始。
- F06 首个新增测试为 `apps/web/e2e/ai-store-009-live-approved-updates.spec.ts`，门控为 `pnpm harness verify --sprint p27/03 --feature F06`。

## 已知实现边界

- Team/BoardX Featured 是独立状态。
- 首次 BoardX 发布必须审核；approved 后内容编辑免复审并立即同步。
- BoardX 撤回后保留订阅关系，但禁止新订阅和新执行。

## 完成状态

- F05、F06 均已由 Harness 验证为 `passing`。
- F06 evidence: `evidence/F06.verify.log`。
- F06 verification: 19 个 Playwright 用例通过，随后 `pnpm -w run verify:base` 通过。
- 本 sprint 无剩余未完成 Feature；后续从 p27/04 的 F07 开始。
