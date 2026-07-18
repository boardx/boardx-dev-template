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

### 2026-07-18 23:05:00
- 本轮目标: 关闭全分支终审发现的章节输出、隐私、权限、哈希和历史访问阻塞项。
- 已完成: 正式产物逐章固化唯一输出契约；模型输入移除开放题原文并拒绝原文回显；
  POST 只使用持久化计划哈希；恢复旧契约不误报；只读 GET 不写计划；发布口径进入
  `survey-source-v2`；版本历史不再截断为 20 条。
- 运行过的验证: Data 94 项、Web 162 项、Data/Web typecheck 与 F16 Playwright 通过。
- 已知风险或未解决问题: 等待 harness backfill、独立复审与全仓基础验证。
- 下一步最佳动作: 刷新证据并复审；无阻塞后提交、推送现有 PR `#716`。

### 2026-07-18 20:58:00
- 本轮目标: 关闭复审剩余的历史隐私、正式图表渲染和历史查询扩展性问题。
- 已完成: 正式报告按 8 种白名单模板使用真实聚合数据构造并渲染 ECharts option；
  历史产物依据各自 source revision 递归脱敏；历史列表改为 50 条游标分页摘要，
  完整报告按合法 artifact UUID 精确加载，首屏外当前契约不会误报要求变化。
- 运行过的验证: Data 94 项、Web 166 项、Data/Web typecheck、design lint、
  路由定向 7 项和 F16 Playwright 全流程通过。
- 已记录证据: `evidence/survey-report-single-output-desktop.png` 已由本轮 E2E 刷新。
- 已知风险或未解决问题: 等待独立复审、harness evidence backfill 和全仓基础验证。
- 下一步最佳动作: 复审无 blocker 后提交并推送现有 PR `#716`。

### 2026-07-18 21:06:00
- 本轮目标: 关闭第三轮复审的历史版本完整性与可达性问题。
- 已完成: 新增 source snapshot 外键并对缺快照产物 fail-closed；历史分页接入分析报告
  “加载更早版本”；游标使用 `created_at + artifact id` 稳定排序，切换版本后保留已加载历史。
- 运行过的验证: Data/Web typecheck、Data 95 项、路由与状态 22 项、F16 Playwright 通过。
- 已记录证据: E2E 桌面截图与 `evidence/F16.verify.log` 已通过 harness backfill 刷新。
- 已知风险或未解决问题: 独立 reviewer 已确认无 blocker/Important。
- 下一步最佳动作: 提交并推送现有 PR `#716`，等待 CI 与 merge。
