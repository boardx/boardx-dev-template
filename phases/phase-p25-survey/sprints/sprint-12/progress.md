# 进度日志 — Sprint p25/12

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-p25-f12-survey-ui-redesign`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F12 / 重建动态报告规划与分类报告编排器
- 当前 blocker: F12 仍需验证真实答卷报告、零/低样本限制和失败重试；组合 E2E 另发现本地 `survey_ai_sessions_status_check` 不接受代码既有的 `open` 状态

## 会话记录
### 2026-07-17（统一创建界面）
- 本轮目标: 按诊断工作台参考统一新建选择器、模板中心、问卷编辑器和 AI 助手。
- 已完成: 三路新建选择器；标签过滤的诊断模板中心；单边界摘要和连续题目画布；AI draft/changeSet 预览确认；移动端单列响应式布局。
- 运行过的验证: Survey 创建/模板/AI Playwright 10 tests passed；移动编辑器视觉测试 1 passed；Web typecheck；design lint；`git diff --check`；Task 3 独立复审通过。
- 最终审查修复验证: p25-001/008/011/012 共 22 tests passed；p25-002 的匿名移动长问卷等 4 条通过，跨页面测试单独 1 passed。
- 已记录证据: `evidence/2026-07-17-survey-unified-creation-surfaces.md`、`evidence/survey-unified-editor-desktop.png`、`evidence/survey-unified-editor-mobile.png`。
- 状态边界: F12 保持 `in_progress`；真实答卷报告、零/低样本限制和失败重试仍需继续验收。

### 2026-07-17（首页导航精简）
- 本轮目标: 统一左侧菜单图标，移除首页无效的组织/顾问社区信息，并闭合 WHY/HOW/THEN 三个入口。
- 已完成: 四个菜单图标统一尺寸与描边；删除组织和顾问社区卡片；模板、AI 新建问卷、分析报告入口接入真实工作流，无可分析答卷时确定性回到“我的问卷”。
- 运行过的验证: 聚焦 Playwright 2 tests passed；Web typecheck；design lint；`git diff --check`。
- 已记录证据: `evidence/2026-07-17-survey-home-navigation.md`、`evidence/survey-reference-home.png`；F12 保持 `in_progress`。
- 下一步最佳动作: 继续统一“我的问卷”、模板中心及五步工作流的视觉与交互边界。

### 2026-07-17（资源库式我的问卷）
- 本轮目标: 按新 UIUX 参考稿调整 Survey 管理工作台，参考本地 `AI 问卷诊断平台(1).html` 与 AI Store resource library 截图。
- 已完成: 新增 `requirements/12-resource-library-uiux-change.md`；将 `?view=my` 的我的问卷改为左侧分组导航、顶部搜索/团队栏、胶囊筛选和资源表格列表；保留 F12 报告编排器和既有 `data-testid` 验证入口。
- 运行过的验证: `pnpm --filter @repo/web run lint`；`pnpm --filter @repo/web run typecheck`；`pnpm --filter @repo/web run test -- survey-report`（21 files / 107 tests passed）。
- 未通过验证: `E2E_PORT=62138 COLLAB_WS_PORT=62139 pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --reporter=line` 启动成功但 4 tests failed，原因是注册用户时 Postgres 返回 `password authentication failed for user "boardx"`；需恢复该 worktree 的标准 DB 凭证/容器后重跑。
- 已记录证据: 尚未生成正式 Harness evidence；F12 保持 `in_progress`。
- 已知风险或未解决问题: 本轮是我的问卷 UIUX 调整，不覆盖 F12 的真实答卷报告生成、零/低样本限制与任务失败重试最终验收。
- 下一步最佳动作: 复跑验证后提交到 `codex/p25-f12-survey-ui-redesign`，再通过 PR 同步 main。

### 2026-07-17（需求澄清：HTML 为唯一 UI 基线）
- 本轮目标: 核对用户指定的微信目录原文件，并消除 resource-library 解释与原型信息架构的冲突。
- 已完成: 微信原文件与 Desktop 副本 SHA-256 均为 `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`；新增 `requirements/12-diagnostic-platform-html-fidelity.md`，明确六个界面和真实数据约束；更新 UIUX 设计规格。
- 需求结论: 上一条 resource-library 方向被本次澄清取代，不作为实现目标；`/surveys` 保持参考 HTML 的诊断工作台首页，“我的问卷”保持三种创建入口加紧凑列表。
- 已记录证据: 原文件路径、哈希和界面清单已写入 requirements 与设计规格；F12 保持 `in_progress`。
- 下一步最佳动作: 按更新后的规格完成 UI 预览并进行人类 UI signoff，再进入 F12 最终实现与 Harness verify。

### 2026-07-17（参考诊断平台首页）
- 本轮目标: 修正 `/surveys` 仍显示旧问卷列表的问题，按 `AI 问卷诊断平台(1).html` 落实参考首页。
- 已完成: 新增诊断工作台首页、四项指标、组织/社区信息、WHY/HOW/THEN 方法区、推荐模板和最近问卷；我的问卷移动到 `?view=my`，模板中心保留 `?view=templates`。
- 运行过的验证: 聚焦 Playwright 2 tests passed；Web typecheck；design lint；完整页面视觉截图人工对照通过。
- 已记录证据: `evidence/2026-07-17-survey-reference-home.md`、`evidence/survey-reference-home.png`；F12 保持 `in_progress`。
- 下一步最佳动作: 继续按同一参考视觉统一“我的问卷”和两个模板中心，再处理五步工作流的页面级一致性。

### 2026-07-16（报告模板工作台结构）
- 本轮目标: 按 Survey 平台 UIUX 重构方案，先稳定 F12 报告模板编辑器的三栏工作台边界。
- 已完成: 当前 `step=template` 真实入口统一为可折叠模块列表、实时报告预览、AI/配置助手三栏结构；保留图表、图片、文本、提示词和模块缩放能力。
- 运行过的验证: F12 Playwright 3 tests passed；Web typecheck；design lint。
- 已记录证据: `evidence/F12-report-builder-shell.md`；F12 继续保持 `in_progress`。
- 已知风险或未解决问题: 本轮只完成平台重构计划的首个可审查切片；其余 Survey 首页、问卷列表、模板中心和其他工作流统一视觉仍需后续 feature 边界实施。
- 下一步最佳动作: 继续 F12 的模块选择、预览和 AI 应用交互，再完成剩余真实答卷与失败恢复验收。

### 2026-07-15
- 本轮目标: 修复报告使用模拟数值、跨题混轴、固定管理话术和工作台截图式导出的问题。
- 已完成: 新增真实答卷证据聚合、证据引用校验和专业报告文档模型；报告页面按题独立展示计数/占比/分母；零样本不生成数字或结论；生成按钮改为千问证据输入；PDF/Word 改用独立 A4 文档。
- 运行过的验证: 3 个 Vitest 文件共 9 tests passed；Web typecheck；design lint；`survey-p25-012-report-composer.spec.ts` 3 tests passed；`git diff --check`。
- 已记录证据: `evidence/2026-07-15-survey-professional-report.md`；F12 保持 `in_progress`。
- 已知风险或未解决问题: 真实千问成功分支仍依赖本地 `DASHSCOPE_API_KEY`；模型失败时已验证会保留真实统计，但尚未完成 F12 的异步任务/重试全部验收。
- 下一步最佳动作: 用含真实答卷的业务问卷人工检查 PDF/Word 分页与措辞，再继续 F12 的异步产物验收。

### 2026-07-15（AI 工作台 UI）
- 本轮目标: 按已确认 UI 方案重构 Survey 五步工作流，突出 AI 创建、修改、报告模板和报告生成。
- 已完成: 五步导航将“设计模块”改为“报告模板”；设计、发布、答卷、报告页接入可折叠目录和精简 AI 助手；报告模板新增图表/图片/文本 12 列画布、位置大小调整及模块级提示词。
- 运行过的验证: `pnpm exec vitest run lib/survey-report-layout.test.ts`（3 passed）；`pnpm --filter @repo/web run typecheck`；`pnpm --filter @repo/web run lint`；当时聚焦 Playwright 为 4 passed，遗留 fallback 场景已在后续统一创建界面回归中闭合。
- 已记录证据: `evidence/2026-07-15-survey-ai-workbench-ui.md`；F12 保持 `in_progress`。
- 提交记录: UI 设计检查点 `f54d79c`；实现提交待本轮收尾。
- 已知风险或未解决问题: AI 面板当前复用现有动作，预览与应用尚未引入新的差异协议；F12 的非 UI 验收边界仍未完成。
- 下一步最佳动作: 人工检查五个工作流界面并收集 UI 反馈，再继续 F12 的数据与失败恢复验收。

### 2026-07-15（分类 API 修复）
- 本轮目标: 修复报告设计页点击“AI 重新分类”必然失败的问题。
- 已完成: 为 `report-categories` 补齐千问 POST 分类；保留 `canManageSurveyScope` 权限；千问不可用时持久化默认分类；增加所有者/外部用户端到端覆盖。
- 运行过的验证: `pnpm --filter @repo/web run test -- survey-report`（86 passed）；`pnpm --filter @repo/web run typecheck`；`pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --reporter=line`（1 passed）。
- 已记录证据: 本轮命令输出；正式 Harness evidence 尚未生成，F12 保持 `in_progress`。
- 提交记录: 本轮修复提交见 `codex/p25-f12-report-composer` 分支。
- 已知风险或未解决问题: 当前修复只闭合分类 API；F12 的真实答卷报告生成、零/低样本限制与任务重试仍需独立验收。
- 下一步最佳动作: 先提交并评审本次接口修复，再继续补齐 F12 剩余验收场景，最后统一运行 `pnpm harness verify --sprint p25/12 --feature F12`。
