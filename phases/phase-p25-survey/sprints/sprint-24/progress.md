# 进度日志 — Sprint p25/24

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无，F24 已 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-19 01:44:24
- 本轮目标: 五步 Tab 切换只替换导航下方内容，不再替换整页壳层。
- 已完成:
  - 公共壳层统一承载返回列表、问卷标识和五步导航。
  - 设计页移除重复步骤条，报告模板页恢复公共头部。
  - 新增浏览器回归，验证跨步骤 DOM 节点身份与几何位置不变。
- 运行过的验证:
  - Web lint、typecheck 通过。
  - F20、F22、F24 Playwright 通过；F21 联合运行超时后单独复跑通过。
- 已记录证据: `evidence/persistent-workflow-shell.png`。
- 提交记录: `cfd24b6 feat(survey): keep workflow shell persistent`。
- 已知风险或未解决问题: 无业务契约变更；F24 完整 Harness 门禁已通过。
- 下一步最佳动作: 推送分支并更新 PR #757。
