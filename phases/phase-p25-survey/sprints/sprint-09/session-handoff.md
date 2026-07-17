# 会话交接 — Sprint p25/09

## 当前已验证
- F09 已由 Harness 升级为 passing：data typecheck、63 个 data tests、web typecheck、Playwright API E2E 和基础回归均通过。

## 本轮改动
- `038_survey_source_contracts.sql` 增量增加题目 category、模板 tags 和报告 category_plan。
- `packages/data/src/survey.ts` 保留 Room scope 权限与字段，并移植源仓报告分类契约。
- 新增 report-template/report-categories 路由，读取走 canView，修改走 canManageSurveyScope。

## 仍损坏或未验证
- F10-F14 尚未实现，不应把当前结果描述为完整 Survey 同步完成。

## 下一步最佳动作
- 从 F10 开始同步源 stash 的真实工作台和五步流程；不要覆盖 `survey.ts` 或削弱 Room/team 权限。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/09`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-009-source-data-contract.spec.ts`
