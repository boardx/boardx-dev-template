# F15 Survey 首页信息调整验收

## 需求

- 删除首页“组织”和“顾问社区”两张卡片，真实指标区占满该行。
- 左侧“我的问卷”显示与 owner 列表一致的真实问卷数量。
- 最近问卷增加发布时间；计划发布显示 `publishStartAt`，立即发布显示现有生命周期时间，未发布显示“尚未发布”。

需求与人类确认来源：

- `requirements/13-home-dashboard-information-adjustments.md`
- `source-home-dashboard-adjustments.png`

## 测试先行

新增 `apps/web/e2e/survey-p25-015-home-information.spec.ts` 后，在修改生产代码前运行：

```text
4 failed
- survey-home-organization expected 0, received 1
- survey-nav-workspace-count not found
- survey-home-published-at-<id> not found
- mobile publication detail not found
```

完成实现后，同一规格为 `4 passed`。

## 自动化验证

- `pnpm --filter @repo/web run lint`：通过；仅保留仓库既有语言混用警告。
- `pnpm --filter @repo/web run typecheck`：通过。
- `pnpm --filter @repo/web test`：22 files / 109 tests 通过。
- F15 Playwright：4/4 通过。
- F08 首页回归：1/1 通过。
- p25-001 + p25-008 + p25-015 组合回归：19/19 通过。
- p25-001/002/005/008/010/012/015 七规格完整回归：38/38 通过。

## 视觉验收

- 用户标注原图：`source-home-dashboard-adjustments.png`
- 同 CSS 视口缩放图：`source-home-dashboard-adjustments-1672.png`
- 当前实现：`survey-home-f15-desktop.png`
- 同输入并排图：`comparison-home-f15.png`
- 对比视口：每侧 `1672 x 996`

并排检查结论：

- P0/P1/P2：无。
- 两张目标卡片已删除，指标区没有遗留空白占位。
- “我的问卷”数量位于标签右侧并保持稳定对齐。
- 发布时间位于最近问卷中部；已发布与未发布状态可直接区分。
- `390 x 844` 移动端自动化检查无横向溢出。

## 状态边界

- 本证据只覆盖 F15 首页信息调整。
- F13、F14 仍为 `pending`，不能据此宣称 Phase p25 全部完成。
