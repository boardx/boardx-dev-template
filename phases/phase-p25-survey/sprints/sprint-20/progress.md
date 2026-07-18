# 进度日志 — Sprint p25/20

## 当前已验证状态(唯一真相)
- 仓库根目录: `.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F20 / 统一问卷设计入口
- 当前 blocker: 无

## 会话记录
### 2026-07-19
- 本轮目标: 统一“我的问卷”和“用此模板建问卷”的设计入口。
- 已完成: 将已有问卷、模板创建及 `step=design` 深链接统一到连续设计画布；保留已有问卷数据。
- 运行过的验证: web lint、web typecheck、F20 Playwright（1 passed）、1920 x 1200 视觉检查。
- 已记录证据: `evidence/unified-design-entry-desktop.png`、`evidence/design-qa.md`。
- 提交记录: 待提交。
- 已知风险或未解决问题: 无功能 blocker；尚需完成 Harness verify。
- 下一步最佳动作: 提交实现，运行 `pnpm harness verify --sprint p25/20 --feature F20` 并推送 PR #757。
