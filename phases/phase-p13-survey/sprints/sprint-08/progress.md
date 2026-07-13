# 进度日志 — Sprint p13/08

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-survey-remediation`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F08 / 回退非规范 Survey 集成并恢复已验证基线
- 当前 blocker: 无；进入实现前的 `init.sh` 基线验证被 F08 目标提交引入的 Survey 字号 lint 失败拦截。

## 会话记录
### 2026-07-13 07:53:07
- 本轮目标: 按 Harness 流程回退三笔绕过 feature/sprint/verify 的 Survey 提交。
- 已完成: 新增原始需求与 F08，生成 sprint-08，并由 `codex-survey-remediation` 认领为唯一 `in_progress`。
- 运行过的验证: `./init.sh`（失败前证据：`@repo/web#lint` 命中新增 Survey 页面未登记字号）。
- 已记录证据: init 输出保留在当前任务记录；F08 正式 verify 后由 Harness 写入 evidence。
- 提交记录: 待提交控制面与后续 revert。
- 已知风险或未解决问题: 仓库基线 lockfile 合并损坏已用独立提交修复；F08 尚未执行 revert。
- 下一步最佳动作: 提交控制面后依次 revert `cb09e92`、`47a3dc6`、`c43a8fb`，再运行 F08 验证。
