# 进度日志 — Sprint p25/13

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f12-survey-ui-redesign`
- 标准启动路径: `pnpm --filter @repo/web exec next dev -p 3001`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F15 / 精简 Survey 首页并补充问卷数量与发布时间
- 当前 blocker: 无；F15 已由 Harness 认领为本 sprint 唯一 `in_progress`

## 会话记录
### 2026-07-18
- 本轮目标: 按用户标注截图删除组织/顾问社区卡片，为“我的问卷”补真实数量，并在最近问卷中增加发布时间。
- 已完成: 新增 `requirements/13-home-dashboard-information-adjustments.md`；更新 UI signoff；创建并认领 F15；保存用户标注截图。
- 运行过的验证: `jq empty phases/phase-p25-survey/feature_list.json`。
- 已记录证据: `evidence/source-home-dashboard-adjustments.png`。
- 提交记录: 待提交文档检查点和实现。
- 已知风险或未解决问题: 当前数据模型没有独立 `publishedAt`；F15 明确计划发布时间优先，立即发布使用现有生命周期时间，未发布显示空态。
- 下一步最佳动作: 先写失败的 F15 Playwright 验收，再做最小实现并运行 Harness verify。
