# 会话交接 — Sprint p25/25

## 当前已验证
- F25 仍为 `in_progress`，局部数据测试、Web lint/typecheck、F25 E2E 与依赖功能回归均已通过。
- 正式 passing 必须由 `pnpm harness verify --sprint p25/25` 生成证据并完成状态迁移。

## 本轮改动
- 报告模板编排器新增章节题目来源多选，同题可跨章节复用。
- AI 分类 POST 支持 `previewOnly`，前端使用确认弹窗后才应用建议。
- 专业报告增加连续章节目录与平滑定位，保留单文档完整阅读。
- 修复报告源快照在双唯一键约束下的并发复用竞态，并添加回归测试。

## 仍损坏或未验证
- `pnpm harness tick --session codex-survey-report-ui` 需要外部 coordinator 环境变量，当前环境未配置。
- 尚未完成正式 harness verify 和证据日志入库。

## 下一步最佳动作
- 只继续 F25：提交实现后运行 harness verify；将生成的 `evidence/F25.verify.log` 强制加入 Git，
  再次运行 verify，确认脚本自动把 F25 标记为 `passing`。
- 不手改 `active-features.json`，不手动把 feature 状态改为 passing。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/25`
- 调试:`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
