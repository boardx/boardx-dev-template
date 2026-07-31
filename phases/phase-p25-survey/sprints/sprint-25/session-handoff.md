# 会话交接 — Sprint p25/25

## 当前已验证
- F25 已由 `pnpm harness verify --sprint p25/25` 门控升级为 `passing`。
- 正式证据位于 `evidence/F25.verify.log`，两张 UI 截图位于同目录。
- 2026-07-31 post-passing 加固已完成独立复审，结论为 `APPROVE`；F25 E2E 2/2、doctor 0 FAIL / 0 WARN。

## 本轮改动
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
- `pnpm harness tick --session codex-survey-report-ui` 需要外部 coordinator 环境变量，当前环境未配置。
- 当前 HEAD 的 F19/F24/F25 Playwright 已本地通过 8/8；Docker 与 PostgreSQL/Redis/MinIO 均恢复可用。
- 真实 PostgreSQL 双客户端并发 E2E 尚未单独覆盖；SQL 契约、首次创建冲突和后续更新冲突已有定向测试。

## 下一步最佳动作
- PR #824 已推送到 `d1cc27b9`，8 条历史 review 线程均已回复并关闭，当前 HEAD 的 Codex review 已重新触发。
- Issue #823 已更新当前范围、验证结果并明确分配给 `usersyj`；最终 merge 只能由 `usersyj` coordinator 执行。
- Harness sync dry-run 只计划投影旧 F01/F02 且 owner 错配为 `wrk-survey-1`，为避免制造错误 GitHub 状态未执行 `--apply`；F25 由 Issue #823 与 PR #824 准确跟踪。
- 等待当前 HEAD 的 GitHub review/CI 门禁；若无新 finding，由 `usersyj` coordinator 合并 PR #824。
- `72de1075` 后的最新未提交 review 修复已完成；本地 Web 197 tests、F19/F24/F25 Playwright 8/8、Turbo 基础门禁 81/81 与 doctor 0 FAIL / 0 WARN 已通过，待提交推送并关闭对应 GitHub 线程。
- 如需 coordinator 心跳，先配置 RepoHub/coord-gateway 所需环境变量，再运行 tick。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/25`
- 调试:`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
