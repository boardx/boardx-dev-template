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

## 仍损坏或未验证
- `pnpm harness tick --session codex-survey-report-ui` 需要外部 coordinator 环境变量，当前环境未配置。
- PR #824 review 修复后的 F25 Playwright 本地复跑被 Docker Desktop 启动失败阻断；相关单元测试、类型检查和 lint 已通过，等待 GitHub CI 完整复验。
- 真实 PostgreSQL 双客户端并发 E2E 尚未单独覆盖；SQL 契约、首次创建冲突和后续更新冲突已有定向测试。

## 下一步最佳动作
- 推送 PR #824 的章节来源门禁修复，重新请求 review，等待 CI 与 review 门禁通过后由 `usersyj` coordinator 合并。
- 如需 coordinator 心跳，先配置 RepoHub/coord-gateway 所需环境变量，再运行 tick。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/25`
- 调试:`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-ai-iterable-report-template.spec.ts`
