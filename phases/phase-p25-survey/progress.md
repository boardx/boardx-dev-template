# 进度日志 — Phase p25 Survey System

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-p25-survey-system`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F09 重建题目分类、模板标签与报告规划数据契约
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
