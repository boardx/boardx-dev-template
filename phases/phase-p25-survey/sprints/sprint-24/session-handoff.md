# 会话交接 — Sprint p25/24

## 当前已验证
- F24 已由 Harness 门控为 passing：lint、typecheck、新增 Playwright、doctor 和 `verify:base` 均通过。
- F20 统一设计入口、F21 报告入口、F22 单列报告回归均通过。

## 本轮改动
- `WorkspaceShell` 在五步工作流中保持稳定头部文案、结构和几何尺寸。
- 设计器不再渲染第二套步骤条，报告模板不再隐藏公共工作流头部。
- 新增 F24 需求、E2E 和截图证据。

## 仍损坏或未验证
- 无。

## 下一步最佳动作
- 推送当前分支并更新 PR #757。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/24 --feature F24`
- 调试:`E2E_PORT=62668 COLLAB_WS_PORT=62669 pnpm --filter @repo/web exec playwright test e2e/survey-p25-024-persistent-workflow-shell.spec.ts`
