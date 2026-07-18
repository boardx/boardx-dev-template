# 会话交接 — Sprint p25/20

## 当前已验证
- F20 已由 Harness 门禁转为 passing；web lint、web typecheck、专属 Playwright、phase doctor、`verify:base` 和桌面视觉检查均通过。

## 本轮改动
- 将已有问卷设计、模板创建和 `step=design` 深链接集中到同一个新式编辑器入口。
- 增加双入口、刷新恢复、数据保真和无横向溢出的端到端覆盖。
- 增加 F20 需求、Sprint 记录与视觉证据。

## 仍损坏或未验证
- 无已知损坏；仅剩推送后的 PR 状态检查。

## 下一步最佳动作
- 推送当前分支，更新并检查 PR #757。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/20 --feature F20`
- 调试:`E2E_PORT=62628 COLLAB_WS_PORT=62629 pnpm --filter @repo/web exec playwright test e2e/survey-p25-020-unified-design-entry.spec.ts`
