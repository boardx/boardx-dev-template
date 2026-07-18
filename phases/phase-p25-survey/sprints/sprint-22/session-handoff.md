# 会话交接 — Sprint p25/22

## 当前已验证
- F22 实现和定向回归已通过；等待 Harness 写入最终 passing 状态。
- Web lint、typecheck 通过。
- F19、F21、F22 Playwright 联合回归 3/3 通过。

## 本轮改动
- 分析报告统一为居中的单列阅读页，不再显示左侧章节目录与右侧报告 AI。
- 历史专业报告和模板驱动专业报告共用同一阅读工作台。
- 删除页面加载时对旧 `/api/surveys/:id/ai-report` 的 GET 请求。
- 新增桌面、移动端和旧接口禁用的 F22 E2E 证据。

## 仍损坏或未验证
- 无答卷时报告保持“暂无真实答卷”，不会伪造分析内容。
- 完整 Harness 门控尚待实现提交后执行。

## 下一步最佳动作
- 提交当前实现，运行 F22 Harness verify，提交证据和 passing 状态后更新 PR #757。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/22 --feature F22`
- 调试:`E2E_PORT=62648 COLLAB_WS_PORT=62649 pnpm --filter @repo/web exec playwright test e2e/survey-p25-022-single-column-report.spec.ts`
