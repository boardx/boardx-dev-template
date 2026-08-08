# 会话交接 — Sprint p25/25

## 当前已验证
- F25 已由 `pnpm harness verify --sprint p25/25` 门控升级为 `passing`。
- 正式证据位于 `evidence/F25.verify.log`，两张 UI 截图位于同目录。
- 2026-07-31 post-passing 加固已完成独立复审，结论为 `APPROVE`；F25 E2E 2/2、doctor 0 FAIL / 0 WARN。
- 2026-08-02 最终联合 E2E 已覆盖 F10/F16/F19/F25，15/15 通过；F16 测试桩与 F19 报告页面冷启动问题均已解决。
- 用户授权本轮跳过 coord-gateway token/lease；其他 Harness 和 GitHub 门禁继续执行，最终合并仍只能由 `usersyj` coordinator 完成。

## 本轮改动
- 正式报告 PDF 现在直接导出当前连续阅读文档；ECharts canvas 会转换成 PNG 后写入打印页，图表不会再被旧导出器降级成文本分布行。
- 打印流程等待图表图片解码完成再调用浏览器打印；导出回归测试会断言打印 HTML 含真实 canvas 图片数据和图表语义标签。
- F19 报告 AI 测试桩已对齐新版结构化叙事契约，并增加 PDF 图表断言。
- 修复模板保存的输出类型校验：开放题可用于文本章节，只有图表章节要求结构化可聚合题目；不再因一个合法开放文本章节阻断整份模板保存。
- 模板草稿未保存时禁用分析报告入口，防止查看旧模板版本生成的过期报告。
- survey 338 已真实保存并重新生成；“组织特征”按 `line-simple` 输出为 ECharts 图表，页面检查到 1 个 canvas 和 1 个图表实例。
- 文本章节生成现在强制执行模板中的分析目标、分析方法和输出要求，结构化产出管理结论、综合分析和行动建议；缺项时拒绝发布报告。
- 报告产物版本键升级为 `template-driven-report-v2`，旧缓存不会被新版生成流程复用；历史 v1 报告仍可兼容展示。
- survey 338 已真实重新生成版本 2，10 个模板章节均按新契约输出并保留绑定题目证据。
- 真实数据库题目 ID 统一归一化，模板章节不再因字符串/数字差异丢失题目证据。
- 开放文本章节使用不含原文的匿名覆盖率证据；混合章节与执行摘要优先结构化结论。
- 千问 JSON 请求显式包含 JSON 输出约束，避免 DashScope `response_format` 返回 400。
- 正式报告正文与证据卡移除重复结论和建议；survey 338 的 10 章报告已真实生成并核对。
- 报告模板编排器新增章节题目来源多选，同题可跨章节复用。
- AI 分类 POST 支持 `previewOnly`，前端使用确认弹窗后才应用建议。
- 专业报告增加连续章节目录与平滑定位，保留单文档完整阅读。
- 修复报告源快照在双唯一键约束下的并发复用竞态，并添加回归测试。
- 章节题目引用现在参与报告版本键并严格约束每章生成证据。
- AI 模板推演改为基于用户指令和当前草稿的定向迭代。
- 缺失引用显式修复，模板保存使用微秒精度乐观锁阻止协作者覆盖。
- AI 模板 POST 现在仅返回预览；持久化统一走带 CAS 的 PATCH。
- 每章独立保存分析目标与分析方法，并冻结到正式报告版本快照中。
- 失效题目引用在模型调用前返回章节级 422，避免无效或错配证据进入报告。
- 正式报告将研究方法和证据口径集中呈现一次，历史 v1 产物读取时保持兼容。
- F19 的全有或全无发布契约保持不变，任一章节失败时不会发布部分报告。
- 章节运行期失败现在携带失败章节身份，前端保留上一份完整报告并给出可重试提示。
- F19 E2E 使用真实章节题目来源；F24 E2E 新增开始时间修改后结束时间开关不被重置的断言。
- 模板驱动正式导出包含一次性的研究方法与证据口径。
- 模板装配校验失败与章节生成失败现在共享章节级失败响应，能直接定位失败章节且不会发布部分报告。
- Playwright 对隔离 MinIO 动态端口、报告模板 CAS 保存、新版模板移动端命令和集中方法论契约均已对齐。
- 图片章节与文本章节统一要求匿名聚合 claim；不兼容来源在生成前返回章节级失败。
- 报告级样本限制只在正式报告前言出现，不再复制到各章节。
- 发布回收工作台复制的是带当前 origin 的完整受访者 URL。
- 图片来源不兼容现在返回结构化章节级 422，且失败请求不会发布报告产物。
- 正式报告版本保留全局解读限制，并在方法论区域仅展示一次。
- 章节预览边界精确列出所选题目来源，不再把局部来源描述成整份问卷。

## 仍损坏或未验证
- coord-gateway token/lease 未执行，这是用户明确授权的本轮流程例外；因此本会话不声明持有 coordinator lease。
- 未执行全仓所有 Playwright；已执行本次范围对应的 F10/F16/F19/F25 联合套件 15/15，并已通过全仓基础门禁。
- 当前 HEAD 的 F19/F24/F25 Playwright 已本地通过 8/8；Docker 与 PostgreSQL/Redis/MinIO 均恢复可用。
- 真实 PostgreSQL 双客户端并发 E2E 尚未单独覆盖；SQL 契约、首次创建冲突和后续更新冲突已有定向测试。

## 下一步最佳动作
- PR #824 已推送到 `d1cc27b9`，8 条历史 review 线程均已回复并关闭，当前 HEAD 的 Codex review 已重新触发。
- Issue #823 已更新当前范围、验证结果并明确分配给 `usersyj`；最终 merge 只能由 `usersyj` coordinator 执行。
- Harness sync dry-run 只计划投影旧 F01/F02 且 owner 错配为 `wrk-survey-1`，为避免制造错误 GitHub 状态未执行 `--apply`；F25 由 Issue #823 与 PR #824 准确跟踪。
- 等待当前 HEAD 的 GitHub review/CI 门禁；若无新 finding，由 `usersyj` coordinator 合并 PR #824。
- `72de1075` 后的最新未提交 review 修复已完成；本地 Web 197 tests、F19/F24/F25 Playwright 8/8、Turbo 基础门禁 81/81 与 doctor 0 FAIL / 0 WARN 已通过，待提交推送并关闭对应 GitHub 线程。
- 如需 coordinator 心跳，先配置 RepoHub/coord-gateway 所需环境变量，再运行 tick。
- 当前未提交工作树的最终范围已通过 F10/F16/F19/F25 联合 Playwright 15/15、报告定向单测 19/19 和 Web typecheck；提交推送后需关闭两条最新 review 线程并重新触发 HEAD review。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/25`
- 调试:`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
