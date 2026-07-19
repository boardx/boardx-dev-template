# 会话交接 — Sprint p25/21

## 当前已验证
- F21 已由 Harness 转为 passing；专项 E2E、doctor 和仓库基础验证均通过。

## 本轮改动
- 设计器和发布完成页的报告入口改为模板驱动专业报告工作台。
- 新增 F21 E2E，验证已保存章节模板被恢复、报告可重新生成、旧 `/ai-report` 不再被调用。

## 仍损坏或未验证
- 无。

## 下一步最佳动作
- 后续功能继续使用模板驱动的 `step=report` 入口；不要删除仍承载历史统计能力的旧 results 页面。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/21`
- 调试:`E2E_PORT=62638 COLLAB_WS_PORT=62639 pnpm --filter @repo/web exec playwright test e2e/survey-p25-021-template-report-entry.spec.ts`
