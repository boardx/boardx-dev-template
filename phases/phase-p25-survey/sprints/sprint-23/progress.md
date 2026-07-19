# 进度日志 — Sprint p25/23

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无，F23 已 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-19
- 本轮目标: 修复零答卷问卷点击重新生成后出现内部错误码的问题。
- 已完成:
  - 根因确认是 `report_source_has_no_responses`，与 DashScope 无关。
  - API 在领取生成任务前返回 `422 report_requires_responses`，不调用模型。
  - 有历史空报告和无历史报告两种页面均显示回收提示并禁用重新生成。
  - API 失败兜底不再向页面透出内部错误码。
- 运行过的验证:
  - Web 单测 36 个文件、184 条测试通过。
  - Web lint、typecheck 通过。
  - F22/F23 Playwright 联合回归 2/2 通过。
- 已记录证据: `evidence/report-generation-empty-state.png`。
- 提交记录:
  - `0c5288d` `fix(survey): guard report generation without responses`
  - `41ef04c` `test(survey): record F23 verification evidence`
- 已知风险或未解决问题: 用户仍需先发布问卷并提交至少 1 份真实答卷才能生成正式报告。
- 下一步最佳动作: 推送分支并更新 PR #757。
