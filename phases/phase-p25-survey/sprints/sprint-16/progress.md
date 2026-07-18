# 进度日志 — Sprint p25/16

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无；F16 已 passing，F17 等待 F16 PR 合并后开工
- 当前 blocker: 无

## 会话记录
### 2026-07-18 03:09:00
- 本轮目标: 在单个 Survey 交付 worktree 完成 F16，并保持一项 feature 一个独立分支和 PR。
- 已完成: 事实库内容哈希与修订、不可变报告产物、缓存复用、stale 状态、版本历史、
  自然语言章节契约，以及章节/要求/真实报告同屏 UI。
- 运行过的验证: Data/Web 单测、Web typecheck、design lint、F12+F16 Playwright 回归均通过。
- 已记录证据: `evidence/survey-report-composer-desktop.png` 与
  `evidence/comparison-report-composer-f16.png`。
- 提交记录: `1ea7f77`、`d07d161`、`2592235`、`a998805`、`d215ec8`。
- 已知风险或未解决问题: F17 LangGraph 自主分析仍为 pending，且不属于本 PR。
- 下一步最佳动作: 同步 F16 feature issue，推送分支并创建关联 `#648` 的 Delivery PR；
  F16 合并前不开始 F17。

### 2026-07-18 12:08:37
- 本轮目标: 完成 F16 harness 门控。
- 已完成: `pnpm harness verify --sprint p25/16 --feature F16` 全部通过，F16 由 harness
  合法升级为 `passing`。
- 运行过的验证: F16 六条 feature verification 与 58 项 `verify:base` 全部通过。
- 已记录证据: `evidence/F16.verify.log`。
- 已知风险或未解决问题: 无 F16 blocker；F17 尚未开始。
- 下一步最佳动作: 提交 evidence 与 sprint 文档，检查 git 树证据，关闭 Docker 栈，
  同步 GitHub 并创建 Delivery PR。

### 2026-07-18 12:27:00
- 本轮目标: 在最新 `origin/main` 上完成交付前回归。
- 已完成: 合并最新 main，按新 lockfile 同步依赖，并重新执行 F16 全部定向验证。
- 运行过的验证: Data 86 项、Web 123 项、design lint、Web typecheck、F16 Playwright、
  harness doctor，以及全仓 `verify:base` 69/69 个 Turbo 任务全部通过。
- 已记录证据: 最终桌面截图由 Playwright 在合并后的代码上重新生成。
- 已知风险或未解决问题: 无 F16 blocker；F17 仍等待本 PR 合并。
- GitHub 投影: F16 feature issue 为 `#715`，正文 `Refs #648`。
- Delivery PR: `#716`（目标 `main`，ready，mergeable），只 `Closes #715`、`Refs #648`。
- Umbrella 回链: `#648` 已追加 `#715` / `#716` 与 F17 后续顺序。
- 下一步最佳动作: 等待 `#716` review/CI/merge；合并前不开始 F17。

### 2026-07-18 19:15:41
- 本轮目标: 按最终确认的方案 1，将报告模板收敛为单一输出章节与右栏配置预览。
- 已完成: 每章只能选择图片、图表或文本；图表支持 8 个白名单 ECharts 模板、
  非空效果预览、完整只读 Option JSON 和复制；完整报告与不可变历史仅在“分析报告”。
- 运行过的验证: Data 91 项、Web 154 项、design lint、Web typecheck、F16 Playwright、
  harness doctor 和 `./init.sh` 的 69/69 项基础验证均通过。
- 已记录证据: `evidence/survey-report-single-output-desktop.png`；原 `F16.verify.log`
  仍由首次合法 harness 门禁维护，passing 状态下 verify 按设计跳过且不覆写日志。
- 已知风险或未解决问题: 无 F16 blocker；F17 LangGraph 自主分析仍不属于本 PR。
- 下一步最佳动作: 完成 Task 5 与全分支审查，推送更新现有 PR `#716`。

### 2026-07-18 22:35:00
- 本轮目标: 修复 Task 5 审查发现的并发生成、原始答卷泄漏与 stale 再生成覆盖缺口。
- 已完成: 新增按产物键原子抢占的持久化 generation claim；并发 POST 只允许一个生成者；
  浏览器、历史版本与导出统一移除原始文本答卷；补齐新答卷后只标记 stale、用户显式生成新版本
  的端到端路径。
- 运行过的验证: Data 92 项、Web 157 项、Data/Web typecheck、design lint、F16 Playwright
  以及 `pnpm harness verify --sprint p25/16 --feature F16 --backfill-evidence` 全部通过。
- 已记录证据: `evidence/F16.verify.log` 已通过合法 backfill 刷新；
  `evidence/survey-report-single-output-desktop.png` 已重新生成。
- 已知风险或未解决问题: 无 F16 blocker；F17 LangGraph 自主分析仍为后续独立 feature。
- 下一步最佳动作: 完成修复复审与全分支审查，提交并推送现有 PR `#716`。
