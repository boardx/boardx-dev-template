# 进度日志 — Sprint p25/21

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: `F21 / 修复模板驱动报告入口`
- 当前 blocker: 无

## 会话记录
### 2026-07-19
- 本轮目标: 修复设计器“分析报告”进入旧结果页并触发 `ai_report_failed`。
- 已完成: 两处报告入口统一到 `/surveys?survey=:id&step=report`；新增 E2E 覆盖模板恢复、重新生成和旧接口禁用。
- 运行过的验证: web lint、web typecheck、F21 Playwright E2E。
- 已记录证据: 待 `pnpm harness verify --sprint p25/21 --feature F21` 写入。
- 提交记录: 待提交。
- 已知风险或未解决问题: 旧结果统计页继续保留，供历史链接和答卷统计使用；本 feature 不删除旧接口。
- 下一步最佳动作: 运行 Harness 门禁并提交到 PR #757。
