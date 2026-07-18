# 会话交接 — Sprint p25/20

## 当前已验证
- F20 实现已通过 web lint、web typecheck、专属 Playwright 和桌面视觉检查，尚待 Harness 将状态转为 passing。

## 本轮改动
- 将已有问卷设计、模板创建和 `step=design` 深链接集中到同一个新式编辑器入口。
- 增加双入口、刷新恢复、数据保真和无横向溢出的端到端覆盖。
- 增加 F20 需求、Sprint 记录与视觉证据。

## 仍损坏或未验证
- 尚未执行最终 Harness verify 和推送后的 PR 检查。

## 下一步最佳动作
- 完成 F20 Harness verify，提交生成的验证证据，推送并更新 PR #757。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/20 --feature F20`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-020-unified-design-entry.spec.ts`
