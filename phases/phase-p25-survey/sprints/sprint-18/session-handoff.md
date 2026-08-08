# 会话交接 — Sprint p25/18

## 当前已验证
- F18 已由 `pnpm harness verify --sprint p25/18 --feature F18 --backfill-evidence` 门控转为 passing。
- 单测 125 项、design lint、TypeScript typecheck、Playwright 2 项、phase doctor 和全仓基础验证均通过。

## 本轮改动
- 设计问卷页改为参考稿的连续编辑结构，移除左侧题目大纲。
- 新增问卷摘要与诊断假设派生逻辑及单元测试。
- 五步导航和顶部预览、报告模板、发布操作匹配参考稿。
- AI 助手采用右侧固定栏、上下文提示、快捷要求和紫色发送按钮。
- 新增 F18 Playwright 桌面与移动端验收及截图证据。

## 仍损坏或未验证
- 无已知功能阻塞。
- BoardX 全局导航是平台既有壳层，与独立 HTML 原型存在预期差异。

## 下一步最佳动作
- 提交当前实现并创建指向 `main`、关联 issue #648 的独立 PR。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/18 --feature F18 --backfill-evidence`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-018-design-workbench-ui.spec.ts`
