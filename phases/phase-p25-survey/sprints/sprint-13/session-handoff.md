# 会话交接 — Sprint p25/13

## 当前已验证
- F01-F12 与 F15 为 `passing`；F13、F14 仍为 `pending`。
- `pnpm harness verify --sprint p25/13 --feature F15` 已通过，证据为 `evidence/F15.verify.log`。
- Web 单测 22 files / 109 tests、Survey 七规格 Playwright 38/38、design lint、Web typecheck 与仓库 `verify:base` 均通过。

## 本轮改动
- 新增首页信息精简需求 `requirements/13-home-dashboard-information-adjustments.md`。
- 创建 Sprint p25/13 并由 Harness 将 F15 分配、认领给 `wrk-survey-1`。
- 保存用户标注截图到 `evidence/source-home-dashboard-adjustments.png`。
- 删除首页组织/顾问社区卡片并让真实指标区占满。
- Survey 导航显示与 owner 列表一致的问卷数量。
- 最近问卷显示发布时间或“尚未发布”，并通过 `390 x 844` 无溢出验收。
- 新增 F15 测试、实现截图和 `1672 x 996` 同输入并排视觉证据。

## 仍损坏或未验证
- Phase p25 尚未全部完成：F13 专业多格式导出、F14 全旅程对账仍待认领。
- 当前数据模型没有独立 `publishedAt`；F15 不新增伪造字段，沿用已确认的显示优先级。

## 下一步最佳动作
- 推送 `codex/p25-f12-survey-html-followup` 并创建面向 `main` 的 ready PR，关联 issue #648 和已合并 PR #674。
- F13 需另行认领；F13 `passing` 前不得开始依赖它的 F14。

## 命令
- 启动: `pnpm --filter @repo/web exec next dev -p 3001`
- 验证: `pnpm harness verify --sprint p25/13 --feature F15`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-home-information.spec.ts --reporter=line`
