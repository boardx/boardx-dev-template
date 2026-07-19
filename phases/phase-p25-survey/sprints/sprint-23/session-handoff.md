# 会话交接 — Sprint p25/23

## 当前已验证
- F23 实现与定向回归通过，等待 Harness 最终 passing 门控。
- Web 单测 184/184、F22/F23 Playwright 2/2、lint、typecheck 均通过。

## 本轮改动
- 零答卷生成请求改为明确的 422 业务响应，并在 claim/model 调用前结束。
- 报告页零答卷时禁用重新生成并提示先发布、回收至少 1 份有效答卷。
- 新增 API 和浏览器回归，确保不调用模型、不发布空报告、不暴露内部错误码。

## 仍损坏或未验证
- 尚未运行完整 Harness verify 和基础验证。
- 正式报告仍要求真实答卷，这是数据可信度约束，不是故障。

## 下一步最佳动作
- 提交当前实现，运行 `pnpm harness verify --sprint p25/23 --feature F23`，提交证据后更新 PR #757。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/23 --feature F23`
- 调试:`E2E_PORT=62658 COLLAB_WS_PORT=62659 pnpm --filter @repo/web exec playwright test e2e/survey-p25-023-empty-report-generation.spec.ts`
