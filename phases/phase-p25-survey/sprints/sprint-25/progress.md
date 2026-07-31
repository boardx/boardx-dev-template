# 进度日志 — Sprint p25/25

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F25 / 实现 AI 可迭代报告模板与连续专业报告
- 当前 blocker: harness tick 依赖的 coordinator 环境变量未配置；不影响本地 feature verify

## 会话记录
### 2026-07-31 02:42:03
- 本轮目标: 将已确认的 `#template` 与 `#report` 原型按 Harness 流程实现到生产 Survey 工作台。
- 已完成:
  - 报告章节可选择并重复使用问卷题目，支持跨题组合分析。
  - AI 重新推演改为先预览、确认后进入草稿、保存后才持久化。
  - 专业报告一次渲染全部模板章节，章节目录支持平滑定位。
  - 报告源快照写入兼容两个唯一键下的并发幂等冲突。
- 运行过的验证:
  - `./init.sh`
  - `pnpm --filter @repo/data test -- src/survey-report-version.test.ts src/survey-source-contract.test.ts`
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web run typecheck`
  - `E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
  - F12/F22/F24 Survey 回归 E2E
  - `pnpm harness doctor --phase p25`
- 已记录证据:
  - `evidence/ai-iterable-report-template.png`
  - `evidence/continuous-professional-report.png`
- 提交记录: 待提交实现并运行 `pnpm harness verify --sprint p25/25`
- 已知风险或未解决问题: `pnpm harness tick --session codex-survey-report-ui` 因缺少 coordinator 凭据无法登记心跳。
- 下一步最佳动作: 提交实现，运行 harness verify，提交 `F25.verify.log` 后再次 verify 由脚本将 F25 升为 passing。
