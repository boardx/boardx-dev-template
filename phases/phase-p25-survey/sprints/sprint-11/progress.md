# 进度日志 — Sprint p25/11

## 当前已验证状态（唯一真相）
- 仓库根目录：`/private/tmp/boardx-p25-survey-fidelity`
- 标准启动路径：`pnpm -w run dev`
- 标准验证路径：`pnpm -w run verify:base`
- F11 已由 `pnpm harness verify --sprint p25/11` 门控升级为 `passing`。
- 下一未完成功能：F12 / 千问报告分类与 AI 报告。

## 会话记录
### 2026-07-14
- 以 `boardx-survey` 的 `codex-survey-home-nav-redesign` 分支及 `stash@{0}` 为源，同步 7,958 行最新问卷创建器。
- 同步报表导出、报告分类编排和报告规划模块，并加入 `echarts` 依赖。
- 保留 F10 的 URL 深链、刷新恢复、步骤语义和兼容 testid。
- 新增 F11 E2E，覆盖最新版空白创建器、14 种题型以及 Qwen 回退会话的跨用户隔离。
- 设计 lint、Web 类型检查、F10/F11 Playwright、F11 四条 verification 和全仓 `verify:base` 均通过。
- Harness 证据：`evidence/F11.verify.log`。

## 已知边界
- F12-F14 仍为 pending；报告分类 AI、完整分析报告和 Room 安全矩阵尚未声明完成。
- `GET /api/surveys/:id/ai-report` 当前返回 405，不影响 F11 创建器与会话恢复，归 F12 报告链路处理。
