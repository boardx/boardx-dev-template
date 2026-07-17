# 进度日志 — Sprint p25/13

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f12-survey-ui-redesign`
- 标准启动路径: `pnpm --filter @repo/web exec next dev -p 3001`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F13 / 重建专业图表、图片与多格式报告导出
- 当前 blocker: F15 已由 Harness 门禁转为 `passing`；Phase p25 的 F13、F14 仍为 `pending`

## 会话记录
### 2026-07-18
- 本轮目标: 按用户标注截图删除组织/顾问社区卡片，为“我的问卷”补真实数量，并在最近问卷中增加发布时间。
- 已完成: 需求与 UI signoff 先行；新增 F15；删除两张卡片；指标区占满；导航显示真实 owner 问卷数；最近问卷显示计划/立即/未发布状态。
- 测试先行: 新增 F15 Playwright 后生产代码修改前 4/4 失败，完成实现后 4/4 通过。
- 运行过的验证: design lint；Web typecheck；22 files / 109 Web tests；旧首页回归 1/1；组合回归 19/19；Survey 七规格 38/38；`pnpm harness verify --sprint p25/13 --feature F15` 通过并包含 `verify:base`。
- 已记录证据: `evidence/F15.verify.log`、`evidence/2026-07-18-survey-home-information-adjustments.md`、用户标注/实现/并排视觉图。
- 提交记录: 文档先行检查点 `7f6c3ab`；实现提交待本轮创建。
- 已知风险或未解决问题: 当前数据模型没有独立 `publishedAt`；F15 按已确认契约优先 `publishStartAt`，立即发布使用现有生命周期时间，未发布显示空态。F13、F14 不在本轮范围。
- 下一步最佳动作: 提交 F15 实现和证据，推送当前分支并创建面向 `main`、关联 #648 的 follow-up PR。
