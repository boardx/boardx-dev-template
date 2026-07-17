# 会话交接 — Sprint p25/13

## 当前已验证
- F01-F12 保持 `passing`；F15 为当前唯一 `in_progress`。
- F15 需求、UI 确认和可执行 verification 已写入权威清单，`feature_list.json` 通过 JSON 解析。

## 本轮改动
- 新增首页信息精简需求 `requirements/13-home-dashboard-information-adjustments.md`。
- 创建 Sprint p25/13 并由 Harness 将 F15 分配、认领给 `wrk-survey-1`。
- 保存用户标注截图到 `evidence/source-home-dashboard-adjustments.png`。

## 仍损坏或未验证
- 尚未修改生产代码，三个新行为均应先由失败的 Playwright 测试证明缺口。
- 当前数据模型没有独立 `publishedAt`；实现必须遵循 F15 文档中的显示优先级，不伪造额外字段。

## 下一步最佳动作
- 编写并运行 `survey-p25-015-home-information.spec.ts`，确认它因三项行为缺失而失败，再修改首页组件。
- 不回写 F12 状态或 evidence，不手改 `active-features.json`。

## 命令
- 启动: `pnpm --filter @repo/web exec next dev -p 3001`
- 验证: `pnpm harness verify --sprint p25/13 --feature F15`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-home-information.spec.ts --reporter=line`
