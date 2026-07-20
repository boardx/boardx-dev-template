# 会话交接 — Sprint p25/26

## 当前已验证
- F26 已由 `pnpm harness verify --sprint p25/26 --feature F26` 门控推进为 `passing`。
- Feature 验证：web 测试、lint、typecheck、桌面/移动端 Playwright、Harness doctor、证据日志存在性全部通过。
- 基础验证：`pnpm -w run verify:base` 通过。

## 本轮改动
- 设计问卷桌面布局改为 60/40，并阻止迟到编辑器请求覆盖工作流 Tab 的最新选择。
- 报告模板与分析报告移除内部最大宽度，使用持久工作流导航下方的完整内容宽度。
- 专业报告 GET 在零答卷时读取已保存模板快照，按章节顺序返回文本、图表或图片的只读框架。
- 报告渲染和导出显式区分框架章节与已生成章节；框架不加载 ECharts、图片资产或模型结论。

## 仍损坏或未验证
- 无 F26 功能 blocker。
- PR 应暂时 stacked 到 `codex/p25-f25-unified-workflow-ui`，避免把 PR #806 的前置变更重复计入审查；#806 合并后 retarget 到 `main`。

## 下一步最佳动作
- 推送 `codex/p25-f26-fullwidth-report-framework`。
- 创建独立 PR，正文包含 `Closes #811` 和 `Depends on #806`。
- 不要在该 PR 中加入 F27 或其他 Survey 功能。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p25/26 --feature F26`
- 调试：`E2E_PORT=62688 COLLAB_WS_PORT=62689 pnpm --filter @repo/web exec playwright test e2e/survey-p25-026-fullwidth-report-framework.spec.ts`
