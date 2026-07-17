# Survey AI 工作台 UI 第一版证据

## 范围
- 五步工作流 UI 重组，保留现有 Survey 功能。
- 第二步改名为“报告模板”。
- 报告模板支持图表、图片、文本模块的位置、大小和独立提示词。

## 验证结果
- `pnpm exec vitest run lib/survey-report-layout.test.ts`: 3 passed。
- `pnpm --filter @repo/web run typecheck`: exit 0。
- `pnpm --filter @repo/web run lint`: design lint passed；仅输出仓库既有语言混用警告。
- `git diff --check`: exit 0。
- `E2E_PORT=3010 COLLAB_WS_PORT=3011 pnpm --filter @repo/web exec playwright test e2e/survey-p25-011-qwen-ai-workflow.spec.ts e2e/survey-p25-012-report-composer.spec.ts --reporter=line`: 4 passed，1 failed。

## Playwright 已通过路径
- 最新问卷创建工作流。
- AI-first 问卷设计工作台。
- 报告分类默认降级及 owner 权限。
- 报告模板的图表、图片、文本布局和独立提示词。

## 未通过边界
- `Qwen fallback session remains recoverable and private to its actor` 返回 500。
- 服务端错误为 `survey_ai_sessions_status_check` 拒绝既有代码写入的 `status=open`。
- 该失败属于本地数据库 schema 与既有 AI session 状态契约不一致，不由本次 UI 改动引入；F12 因此继续保持 `in_progress`。
