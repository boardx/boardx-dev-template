# 会话交接 — Sprint p25/12

## 工作位置
- worktree: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f12-survey-ui-redesign`
- branch: `codex/p25-f12-survey-html-followup`
- GitHub issue: `https://github.com/boardx/boardx-dev-template/issues/648`
- 前序 GitHub PR: `https://github.com/boardx/boardx-dev-template/pull/674`（已合并；最终验收增量需 follow-up PR）

## 当前已验证
- 微信目录 `AI 问卷诊断平台(1).html` 是六界面的唯一 UI 基线；Desktop 副本与原文件 SHA-256 均为 `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`。
- 首页、我的问卷、问卷编辑器、模板中心、报告模板和洞察报告已完成 `1280 x 720` 同状态并排视觉验收，最终没有 P0/P1/P2。
- 用户名、问卷数、完成率、答卷比例、报告样本和结论均来自真实会话或业务数据，不复制参考 HTML 的演示指标。
- `pnpm harness verify --sprint p25/12 --feature F12` 已通过；Harness 自动将 F12 转为 `passing`，证据为 `evidence/F12.verify.log`。
- F12 门控包含 107 个 Vitest、Web typecheck、4 条报告编排器 Playwright 和仓库 `verify:base`。
- UI 重构收尾后再次通过 design lint、107 个 Web tests、Web typecheck、35 条组合 Playwright、Harness doctor 0 FAIL/0 WARN、`verify:base` 58/58 tasks 和 `git diff --check`。
- 独立审查修正了默认接口原始文本/答卷 ID 下发、按总答卷数或回答单元格数误判指标样本、无独立假设却输出支持结论、纯开放题虚构零分、返回来源丢失、移动结果页溢出、首页报告计数不持久化和列表计数笛卡尔中间集；新增定向 Playwright 均已纳入 35 条组合回归。

## 状态边界
- Phase p25 尚未全部完成：F01-F12 为 `passing`，F13、F14 仍为 `pending`。
- F13 未认领，负责专业图表、图片和真实 Word/PDF/PNG 导出。
- F14 依赖 F13，负责全旅程对账与安全回归。
- 未使用真实 `DASHSCOPE_API_KEY` 验证供应商成功措辞；确定性失败降级、私有会话和恢复路径已覆盖。
- 不手改 `active-features.json`、feature 状态或 evidence；后续状态仍由 Harness 门控。

## 关键证据
- `evidence/2026-07-17-survey-html-fidelity.md`
- `evidence/2026-07-17-survey-html-fidelity-verification.md`
- `evidence/comparison-home.webp`
- `evidence/comparison-my-surveys.webp`
- `evidence/comparison-editor.webp`
- `evidence/comparison-templates.webp`
- `evidence/comparison-report-template.webp`
- `evidence/comparison-insight.webp`
- `evidence/F12.verify.log`

## 下一步最佳动作
- 提交并推送 `codex/p25-f12-survey-html-followup`，创建面向 `main` 的 follow-up PR，并更新 issue #648 / PR #674。
- 后续会话按 Harness 认领 F13；F13 passing 前不得开始 F14。

## 命令
- 启动: `pnpm -w run dev`
- F12 门控: `pnpm harness verify --sprint p25/12 --feature F12`
- F12 调试: `pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --reporter=line`
- Phase 审计: `pnpm harness doctor --phase p25`
