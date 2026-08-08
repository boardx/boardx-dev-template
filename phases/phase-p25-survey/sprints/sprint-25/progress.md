# 进度日志 — Sprint p25/25

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无；F25 已由 Harness 门控升级为 `passing`
- 当前 blocker: 无功能 blocker；coordinator 心跳环境变量仍未配置

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
- 提交记录:
  - `7d11728a feat(survey): implement iterative report templates`
  - `3583b854 test(survey): record F25 verification evidence`
- 已知风险或未解决问题: `pnpm harness tick --session codex-survey-report-ui` 因缺少 coordinator 凭据无法登记心跳。
- 下一步最佳动作: 提交 Harness 自动生成的 passing 状态、最终验证日志和本交接记录；F25 无剩余开发项。

### 2026-07-31 13:56:00
- 本轮目标: 完成 F25 post-passing 代码审查加固并进入 GitHub 交付门禁。
- 已完成:
  - 章节 `questionIds` 纳入模板快照、requirement hash 和文本/图表/图片证据过滤。
  - AI 模板迭代携带用户指令和当前草稿，完整声明章节题目、输出形式与顺序契约。
  - 缺失题目引用保留并显式提示修复，不再静默删除或按位置重新绑定。
  - 模板保存增加微秒精度乐观锁，覆盖首次并发创建和后续更新；GET 单次读取模板与版本。
  - 独立代码复审结论为 `APPROVE`。
- 运行过的验证:
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/data typecheck`
  - Web 定向单元测试 33 条通过。
  - Data source contract 13 条通过。
  - `E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`，2 条通过。
  - `pnpm harness doctor --phase p25`，0 FAIL / 0 WARN。
  - `pnpm harness verify --sprint p25/25`，确认 F25 已 passing，按不可逆规则跳过。
- 提交记录:
  - `41cd44cf fix(survey): harden iterative report templates`
- 下一步最佳动作: 同步 GitHub Issue，推送 `codex/survey-five-step-ui`，创建 PR 并进入 review/CI/coordinator 合并门禁。

### 2026-07-31 23:37:00
- 本轮目标: 修复 PR #824 中 Codex review 提出的两项 P1 章节来源门禁问题。
- 已完成:
  - 禁止空 `questionIds` 章节回退到整份问卷证据，改为在生成前返回可修复的 422 校验错误。
  - 图表章节必须至少引用一道可生成分布数据的题目；前端禁用不兼容的新选择并提示修复旧配置。
  - 所有章节在调用 AI 或图片生成前统一预检，避免无效模板产生部分副作用。
  - 发布回收工作台在切换问卷或异步载入发布时间后同步“立即开始/长期有效”开关，避免展示策略与保存值不一致。
- 运行过的验证:
  - 报告相关 Web 单元测试 17 条通过。
  - `pnpm --filter @repo/web typecheck` 通过。
  - `pnpm --filter @repo/web lint` 通过，仅有既存的文案语言警告。
  - F25 Playwright 复跑被本机 Docker Desktop 启动失败阻断；PostgreSQL `127.0.0.1:62136` 未监听，未将该次运行记为通过。
- 下一步最佳动作: 提交并推送 review 修复，触发 PR #824 CI 和重新 review；门禁通过后交由 `usersyj` coordinator 合并。

### 2026-08-01 00:12:54
- 本轮目标: 完成 PR #824 第二轮 review 加固并补齐可追踪交付证据。
- 已完成:
  - AI 模板 POST 固定为纯预览，只有带版本 CAS 的 PATCH 可以持久化，避免绕过并发保护。
  - 章节新增独立的分析目标与分析方法，并贯通编辑、AI 推演、存储、版本键、不可变快照和生成提示。
  - 生成前验证全部章节题目引用；失效引用返回章节级 422，且在任何文本或图片模型调用前停止。
  - 正式报告集中展示一次研究方法与证据口径；历史 v1 报告读取时补齐兼容默认值。
  - 保持 F19 规定的全有或全无发布语义：任一章节失败时保留最近成功报告，不发布部分版本。
  - 发布回收时间开关在问卷或发布时间属性变化时同步，避免保存陈旧 UI 状态。
- 运行过的验证:
  - `pnpm -w run verify:base`，81/81 Turbo tasks 通过；Web 36 个测试文件、189 条测试通过。
  - `pnpm --filter @repo/data test`，15 个测试文件、101 条测试通过。
  - `pnpm harness doctor --phase p25`，0 FAIL / 0 WARN。
  - Docker API 在获批访问后仍无响应，本轮无法启动 PostgreSQL Playwright 环境，未将 E2E 记为通过。
- 下一步最佳动作: 提交并推送本轮加固，解决 PR review threads，重新请求独立 code/feature review 与 GitHub CI；全部门禁通过后交由 `usersyj` coordinator 合并。

### 2026-08-01 00:37:40
- 本轮目标: 关闭 PR #824 独立 feature/code review 的最后四项门禁问题。
- 已完成:
  - 章节运行期生成失败返回章节 ID、标题和可重试状态，前端明确提示失败章节并保留上一份完整报告。
  - F19 E2E 模板使用真实题目来源，符合严格章节来源校验。
  - 发布回收开始/结束时间分别同步，避免修改一个日期重置另一个未保存开关。
  - 正式 PDF/Word 导出补齐一次性的研究方法与证据口径，不重复章节内容。
- 运行过的验证:
  - Web 全量单元测试 36 个文件、190 条通过。
  - Web typecheck 通过；Web lint 通过，仅保留既存 phase-p17 文案语言警告。
  - 报告导出定向测试 2 条通过；`git diff --check` 通过。
  - Turbo 基础门禁 81/81 tasks 通过；Harness doctor 0 FAIL / 0 WARN；verify 确认 F25 已 passing 并按不可逆规则跳过。
  - Docker Desktop 在获批访问后仍停滞于 Server API，本地 F19/F24 Playwright 无法启动，未记为通过。
- 下一步最佳动作: 提交并推送到 PR #824，重新请求独立 code/feature review 与 GitHub CI；门禁通过后仅由 `usersyj` coordinator 合并。

### 2026-08-01 01:28:00
- 本轮目标: 关闭独立 feature review 提出的章节定位与当前 HEAD 浏览器证据缺口。
- 已完成:
  - 模板装配校验失败与运行期生成失败统一返回具体章节 ID、标题和可重试状态，失败时释放 claim 且不落部分版本。
  - F19 E2E 按乐观锁契约读取并提交 `expectedUpdatedAt`，同时验证文本、图表、图片和受保护图片下载。
  - Playwright 在未显式配置 `S3_ENDPOINT` 时从 worktree `MINIO_PORT` 推导隔离对象存储端点。
  - F24 使用新版模板编辑器稳定的“继续发布”命令验证移动端键盘可达性。
  - F25 连续报告 fixture 对齐集中方法论和完整 GET 响应契约。
- 运行过的验证:
  - F19/F24/F25 Playwright 共 7 条全部通过，耗时 41.0 秒。
  - 章节失败路由和模板装配定向单测 17 条通过。
- 已记录证据:
  - sprint-19 `report-desktop.png`、`report-mobile.png`
  - sprint-24 `persistent-workflow-shell.png`
  - sprint-25 `ai-iterable-report-template.png`、`continuous-professional-report.png`
- 下一步最佳动作: 跑完整单测、typecheck、lint、Turbo 基础门禁和 Harness doctor；提交推送后重新请求 code/feature review，最终仅由 `usersyj` coordinator 合并。

### 2026-08-01 01:40:00
- 最终门禁:
  - Web 全量测试 36 files / 191 tests、typecheck、lint 全部通过。
  - `pnpm -w run verify:base` 81/81 tasks 通过。
  - Harness doctor 0 FAIL / 0 WARN；verify 确认 F25 已 passing 并按不可逆规则跳过。
- 下一步最佳动作: 提交并推送 PR #824，重新请求独立 code/feature review 与 GitHub CI；门禁通过后仅由 `usersyj` coordinator 合并。

### 2026-08-01 02:10:00
- 本轮目标: 完成 PR #824 当前 HEAD 的最终 review 修复、GitHub 投影和 coordinator 交接。
- 已完成:
  - 开放文本无安全聚合证据时改为章节级 422，图片章节生成提示纳入分析目标与方法。
  - 只读协作者不再看到模板/报告变更控件；章节预览严格使用所选题目来源。
  - 正式报告题目数量改为模板章节题目 ID 的去重并集，章节目录取消 sticky，完整报告连续滚动。
  - 8 条 GitHub review 线程逐条回复修复证据并全部关闭；Issue #823 和 PR #824 已同步当前提交与 `usersyj` 交接。
  - Harness sync dry-run 已执行；计划仅包含旧 F01/F02 且 assignee 为 `wrk-survey-1`，因此按投影规则未执行会制造错误 Issue 的 `--apply`。
- 运行过的验证:
  - Web 全量测试 36 files / 194 tests、typecheck、lint 通过。
  - Data 15 files / 101 tests、workflow-worker 11 tests 通过。
  - F19/F24/F25 Playwright 7/7；最终专业报告 E2E 1/1。
  - pre-push affected 16/16；Harness doctor 0 FAIL / 0 WARN；`git diff --check` 通过。
- 提交记录:
  - `9278b2d9 fix(survey): enforce report source and access boundaries`
  - `d1cc27b9 fix(survey): align report scope and scrolling`
- 下一步最佳动作: 等待 GitHub Codex 对当前 HEAD 的 review 结果；门禁通过后仅由 `usersyj` coordinator 合并 PR #824。

### 2026-08-01 02:24:37
- 本轮目标: 关闭 PR #824 最新 Codex review 的三项证据边界问题。
- 已完成:
  - 图片章节在所选题目没有匿名聚合 claim 时提前拒绝，不再生成无证据支撑的视觉。
  - 全局样本限制只保留在正式报告前言，章节不再重复展示同一限制信息。
  - 复制问卷链接时将相对路径解析为当前站点的绝对受访者 URL。
- 运行过的验证:
  - TDD 定向章节单测 8/8；Web 全量 36 files / 195 tests。
  - Web typecheck 与 design lint 通过，仅有既存 phase-p17 文案语言警告。
  - F19/F24/F25 Playwright 8/8；Harness doctor 0 FAIL / 0 WARN。
- 提交记录: `72de1075 fix(survey): close final report review gaps`。
- 下一步最佳动作: 推送当前提交与证据，回复并关闭 3 条 GitHub review 线程，重新触发当前 HEAD review；最终仅由 `usersyj` coordinator 合并。

### 2026-08-01 03:05:00
- 本轮目标: 关闭 PR #824 当前 HEAD review 新增的三项报告证据边界问题。
- 已完成:
  - 图片来源不兼容错误纳入 API 结构化 422 白名单，失败时不发布任何报告产物。
  - 低样本等全局解读限制保存在正式报告版本并仅展示一次，章节不再重复相同限制。
  - 模板章节预览明确列出当前章节选中的题目来源，不再错误声明使用整份问卷。
- 运行过的验证:
  - Web 全量测试 36 files / 197 tests、typecheck、design lint 通过；lint 仅保留既存 phase-p17 文案语言警告。
  - F19/F24/F25 Playwright 共 8/8 通过；截图证据已刷新。
  - `pnpm -w run verify:base` 81/81 tasks 通过；Harness doctor 0 FAIL / 0 WARN；verify 确认 F25 已 passing 并按不可逆规则跳过。
  - `git diff --check` 通过。
- 下一步最佳动作: 执行 Harness doctor/verify 与基础门禁，提交并推送；逐条回复并关闭 3 条 review 线程，再对新 HEAD 触发 review。最终仅由 `usersyj` coordinator 合并。

### 2026-08-01 11:15:00
- 本轮目标: 修复真实 PostgreSQL 问卷题目 ID 类型不一致导致模板章节无法匹配，以及开放文本章节和千问 JSON 模式生成失败。
- 已完成:
  - 数据库字符串题目 ID 在证据入口统一归一化为数字，模板章节能够按保存的 `questionIds` 正确匹配证据。
  - 开放文本题只生成匿名回复覆盖率证据，不向模型或报告暴露原始回答；覆盖率仅在章节没有结构化结论时兜底使用。
  - 千问 JSON 调用统一确保消息包含 JSON 输出约束，并保留有界供应商错误详情用于诊断。
  - 正式报告正文与证据卡去重，保留一次业务含义、一次证据结论和一次行动建议。
  - survey 338 已成功生成 100 份有效答卷、10 个模板章节的正式报告，生成时间为 2026/08/01 11:11。
- 运行过的验证:
  - 报告定向单元测试 5 files / 41 tests 通过。
  - Web typecheck 与 design lint 通过；lint 仅保留既存 phase-p17 文案语言警告。
  - F25 Playwright 通过；Harness doctor 0 FAIL / 0 WARN。
- 下一步最佳动作: 将本轮修复与同会话的答卷查看改动按范围审查后提交，进入 PR review 与 `usersyj` coordinator 合并门禁。

### 2026-08-01 12:30:00
- 本轮目标: 修复正式报告未强制执行已保存章节模板要求、且旧缓存产物被继续复用的问题。
- 已完成:
  - 文本章节生成协议新增强制 `templateExecution`，逐章执行分析目标、分析方法和输出要求；缺少管理结论、综合分析或行动建议时整章生成失败，不发布半成品。
  - 正式报告文本章节新增结构化叙事输出，并兼容历史无叙事字段的 v1 产物读取。
  - 报告产物版本键升级为 `template-driven-report-v2`，避免复用未执行模板要求的旧缓存。
  - survey 338 已在已登录真实页面重新生成版本 2；10 个章节均显示管理结论、综合分析、行动建议和绑定题目证据。
- 运行过的验证:
  - Web 报告定向测试 5 files / 32 tests、专业报告 API 12 tests、Data 版本测试 10 tests 通过。
  - Web 与 Data typecheck 通过；`pnpm --filter @repo/web build` 通过，仅保留既存 `supports-color` ESM warning。
  - 真实 `POST /api/surveys/338/professional-report` 约 89 秒返回 200，页面生成时间更新为 2026/08/01 12:27、版本更新为 2。
- 下一步最佳动作: 审查本轮报告生成契约改动后提交到 PR #824，重新执行 review/CI 门禁并由 `usersyj` coordinator 合并。

### 2026-08-01 14:10:00
- 本轮目标: 修复报告模板章节切换为图表后未保存、正式报告仍按文本生成的问题。
- 已完成:
  - 章节来源校验按输出类型拆分：文本章节允许开放题来源，图表章节仍强制要求可聚合的结构化题目。
  - 模板存在未保存变更时禁用“查看分析报告”，避免用户打开仍使用旧模板快照的报告。
  - survey 338 已真实保存“组织特征”为 `chart / line-simple`，重新生成正式报告后该章节渲染为 ECharts 画布，其余章节保持文本输出。
- 运行过的验证:
  - 报告定向单元测试 5 files / 28 tests、Web typecheck、design lint 通过。
  - `pnpm --filter @repo/web build` 通过，仅保留既存 `supports-color` ESM warning。
  - 真实 `POST /api/surveys/338/professional-report` 返回 200；报告页“组织特征”节点为 `data-output-type=chart`，包含 1 个 canvas 和 1 个 ECharts 实例。
- 未通过边界: 旧版 F16 Playwright AI stub 未返回新版文本章节 `narrative` 契约，导致生成版本数断言失败；该 fixture 漂移与本次图表保存链路无关。
- 下一步最佳动作: 更新 F16 AI stub 到新版叙事契约后补跑完整 E2E，再按 PR #824 review 门禁提交给 `usersyj` coordinator。

### 2026-08-01 19:05:00
- 本轮目标: 修复正式报告页面已生成 ECharts 图表、PDF 导出却降级为文本行的问题。
- 已完成:
  - PDF 导出改为克隆当前正式报告阅读 DOM，不再通过独立简化模板重新拼装报告。
  - 导出前将每个 ECharts canvas 序列化为带语义标签的 PNG，等待图片解码后再打开打印流程。
  - F19 报告 AI 测试桩补齐新版文本章节 `narrative` 契约，并新增打印页必须包含图表图片的断言。
- 运行过的验证:
  - `pnpm --filter @repo/web test -- report-export.test.ts`，3/3 通过；新增 canvas 到打印图片的定向回归测试。
  - `pnpm --filter @repo/web typecheck` 通过。
  - `pnpm --filter @repo/web lint` 通过，仅保留既存 phase-p17 文案语言警告。
  - `pnpm --filter @repo/web build` 通过，仅保留既存 `supports-color` ESM warning。
  - `pnpm harness doctor --phase p25`，0 FAIL / 0 WARN；`git diff --check` 通过。
- 未通过边界: F19 Playwright 两次均在导航报告页时未找到工作台；第一次同时出现 PostgreSQL 尚未接受连接，第二次未产生页面诊断产物。失败发生在 PDF 点击前，未将其记为导出通过。
- 下一步最佳动作: 保留定向测试与类型门禁证据；测试环境会话/数据库稳定后补跑 F19 完整浏览器流程，再进入 PR review 与 `usersyj` coordinator 合并门禁。

### 2026-08-02 11:15:00
- 本轮目标: 完成专业报告生成、图表导出、真实答卷查看和发布时段校验的最终加固，并按 Harness 流程提交 GitHub 门禁。
- 已完成:
  - 正式报告按已保存章节的图片、图表、文本输出类型生成；连续阅读和 PDF 打印复用同一份报告 DOM，ECharts 画布导出为图片。
  - 章节来源校验覆盖图片与图表输出，图片章节同样必须绑定可形成匿名聚合证据的结构化题目。
  - 发布回收关闭“立即开始”或“长期有效”后，开始/结束时间变为必填并显示字段级错误。
  - 答卷工作台展示真实答卷列表和单份问答详情，模板版本与正式报告读取链路完成回归验证。
  - 用户明确授权跳过本轮 coord-gateway token/lease 步骤；其余 Harness 验证、证据、GitHub Issue/PR、review 门禁继续执行。最终合并权限仍归 `usersyj` coordinator。
- 运行过的验证:
  - `pnpm --filter @repo/web exec vitest run lib/survey-report-category-plan.test.ts lib/survey-report-chapter-generation.test.ts lib/report-export.test.ts`，3 files / 19 tests 通过。
  - `pnpm --filter @repo/web run typecheck` 通过。
  - F10/F16/F19/F25 联合 Playwright，15/15 通过；包含发布时间必填、模板持久化、连续报告和 AI 模板迭代。
  - 本轮最终改动前已通过 `pnpm -w run verify:base` 81/81 tasks、Web 全量 36 files / 204 tests、Data 版本测试 10/10 和 Harness doctor 0 FAIL / 0 WARN。
- 下一步最佳动作: 运行最终 doctor/verify/diff-check，提交并推送 PR #824；回复并关闭当前两条 review finding，再触发新 HEAD review，由 `usersyj` coordinator 在门禁通过后合并。
