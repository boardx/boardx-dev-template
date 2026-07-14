# 会话交接 — Sprint p25/10

## 当前已验证
- F10 已由 Harness 升级 passing；工作台 E2E 2/2、web lint/typecheck、verify:base 全部通过。

## 本轮改动
- `/surveys?survey=<id>&step=<step>` 成为五步工作台可刷新恢复的 URL 契约。
- 问卷卡新增工作台入口；设计和发布页复用现有 PATCH API，答题和报告页使用真实 URL。

## 仍损坏或未验证
- F11-F14 pending；不要宣称整个源仓功能已同步完成。

## 下一步最佳动作
- 从 F11 开始；保留五步 URL/testid，不把工作台退回仅 React state。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/10`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-010-source-workspace.spec.ts`
