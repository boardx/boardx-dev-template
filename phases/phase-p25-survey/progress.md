# 进度日志 — Phase p25 Survey System

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F13 重建专业图表、图片与多格式报告导出
- 当前 blocker: 无

## 会话记录
### 2026-07-14 06:47:39
- 本轮目标: 建立 Phase p25，并完成 Survey 数据、权限和发布生命周期地基。
- 已完成: 同步需求原文；确认源分支 UI；生成 6 个 feature；F01 增加兼容迁移、扩展题型、报告模板、发布窗口、回收上限与实名一人一答服务端门禁。
- 运行过的验证: data typecheck/test、web typecheck、Playwright 发布设置与一人一答、`verify:base`。
- 已记录证据: `sprints/sprint-01/evidence/F01.verify.log`。
- 提交记录: 待本轮 checkpoint commit。
- 已知风险或未解决问题: 源分支 AI 路由引用未实现的数据会话函数，不能直接复制；F02 需按仓库 AI gateway 契约实现。
- 下一步最佳动作: 创建 Sprint 02，认领 F02，接通模板库、千问 AI 草稿和编辑器保存闭环。

### 2026-07-14 16:21:00
- 本轮目标: 完成 Survey 全功能同步并按 Harness 交付。
- 已完成: F01-F07 全部 passing；同步专业工作台/模板/编辑器/公开答题/结果报告；接入千问兼容接口；持久化 AI 草稿恢复、session、trace 与报告产物；修正伪 PDF 为浏览器 Print/PDF。
- 运行过的验证: 61 个 data tests；web lint/typecheck；10 个 p25 Playwright；`verify:base`；`harness doctor --phase p25`。
- 已记录证据: `sprints/sprint-01` 至 `sprint-07/evidence/F*.verify.log`。
- 提交记录: `07469d4`、`9329374`，最终收尾提交待生成。
- 已知风险或未解决问题: 真实千问调用需部署环境配置 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`；DOCX/长图/单图不在源分支当前实现中，未标记完成。
- 下一步最佳动作: review 后推送 `codex/p25-survey-system`，创建关联 #617 的 PR 到 main。

### 2026-07-14 18:02:00
- 本轮目标: 修正 Survey 首页未包含源仓未提交 UI 的交付偏差。
- 已完成: F08 passing；以 `boardx-survey` stash 为依据同步 BoardX Survey 首页、导航和 Template Manager，移除旧 Command Center。
- 运行过的验证: web lint/typecheck、新增 2 条 E2E、既有 dashboard 回归、`verify:base`。
- 已记录证据: `sprints/sprint-08/evidence/F08.verify.log`。
- 提交记录: 待本轮提交。
- 已知风险或未解决问题: stash 的非 Survey/构建产物未同步；主仓权限和千问 provider 保持不变。
- 下一步最佳动作: 提交 `codex/p25-survey-source-fidelity` 并发起关联 #617 的 PR。

### 2026-07-14 18:35:00
- 本轮目标: 以 `boardx-survey/codex-survey-home-nav-redesign` 的 HEAD + stash 为事实源重新建立 p25 需求和执行清单。
- 已完成: 同步 9 份源需求/设计输入；固定源 commit、stash tree 和关键文件哈希；完成源能力差距矩阵；生成 F09-F14 可验证 feature。
- 运行过的验证: `jq empty phases/phase-p25-survey/feature_list.json`、源文档抽样哈希、`pnpm harness doctor --phase p25`（0 FAIL / 0 WARN）。
- 已记录证据: 本轮是需求 checkpoint，未认领实现 feature，不生成 passing evidence。
- 提交记录: 待需求 checkpoint 提交。
- 已知风险或未解决问题: 源 stash 是整仓 WIP，必须排除 `.next` 和非 Survey 脚手架；报告导出依赖需在 F13 单独评审。
- 下一步最佳动作: 提交需求 checkpoint；创建 sprint-09 并只认领 F09。

### 2026-08-01 02:30:00
- 本轮目标: 完成 F25 AI 可迭代报告模板与连续专业报告的最终门禁、GitHub 投影和 coordinator 交接。
- 已完成: F25 已由 Harness 验证为 passing；章节支持题目重复引用和多题组合，生成证据严格受章节来源约束；正式报告集中展示全局样本与方法信息并连续滚动；只读协作者保持只读；发布回收聚焦启用状态和时间窗口。
- 运行过的验证: Web 36 files / 195 tests、typecheck、lint；Data 15 files / 101 tests；workflow-worker 11 tests；F19/F24/F25 Playwright 8/8；pre-push affected 16/16；`pnpm harness doctor --phase p25` 为 0 FAIL / 0 WARN。
- 已记录证据: `sprints/sprint-25/evidence/`、`sprints/sprint-25/progress.md`、`sprints/sprint-25/session-handoff.md`。
- 提交记录: `72de1075 fix(survey): close final report review gaps`、`1af76a8b docs(survey): record final review evidence`。
- 已知风险或未解决问题: 尚未增加真实 PostgreSQL 双客户端并发 E2E；当前由 SQL 语义与 source contract 测试覆盖。F13、F14、F17 仍为 pending，不属于 F25 本次交付范围。
- 下一步最佳动作: 等待 PR #824 当前 HEAD review 门禁；通过后仅由 `usersyj` coordinator 合并。后续按权威 `feature_list.json` 从 F13 继续，禁止回退到已 passing 的 F09/F25。
