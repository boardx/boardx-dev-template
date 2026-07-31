# 会话交接 — Sprint p25/25

## 当前已验证
- F25 已由 `pnpm harness verify --sprint p25/25` 门控升级为 `passing`。
- 正式证据位于 `evidence/F25.verify.log`，两张 UI 截图位于同目录。

## 本轮改动
- 报告模板编排器新增章节题目来源多选，同题可跨章节复用。
- AI 分类 POST 支持 `previewOnly`，前端使用确认弹窗后才应用建议。
- 专业报告增加连续章节目录与平滑定位，保留单文档完整阅读。
- 修复报告源快照在双唯一键约束下的并发复用竞态，并添加回归测试。

## 仍损坏或未验证
- `pnpm harness tick --session codex-survey-report-ui` 需要外部 coordinator 环境变量，当前环境未配置。
- F25 无已知未验证功能边界。

## 下一步最佳动作
- F25 已完成，不再修改其 passing 状态或证据；下一轮按权威功能清单选择新的未完成功能。
- 如需 coordinator 心跳，先配置 RepoHub/coord-gateway 所需环境变量，再运行 tick。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/25`
- 调试:`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
