# 进度日志 — Sprint p13/04

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-worktrees/issue-128-survey-templates`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（F05 已 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-02 03:16:25
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-02 03:26:20
- 本轮目标: GitHub issue #128 / Phase p13 F05：问卷模板管理（应用 / 保存 / 删除模板）。
- 已完成:
  - 新增 `survey_templates` migration，包含内置模板种子数据与团队模板存储。
  - 扩展 `@repo/data` 问卷仓储，支持可见模板列表、创建团队模板、权限删除模板。
  - 新增 `/api/survey-templates` GET/POST 与 `/api/survey-templates/[id]` DELETE。
  - 在 `/surveys` 创建器中加入 Blank / 内置模板 / 团队模板选择，支持应用后继续编辑、保存当前问卷为团队模板、删除可管理模板、团队模板空态。
  - 新增 `apps/web/e2e/survey-005-manage-templates.spec.ts` 覆盖 F05 用户路径。
- 运行过的验证:
  - `pnpm --filter @repo/data exec tsc --noEmit`（通过）
  - `pnpm --filter @repo/web exec tsc --noEmit`（通过）
  - `pnpm --filter @repo/web run lint`（通过）
  - `pnpm harness verify --sprint p13/04 --feature F05`（通过，F05 -> passing）
- 已记录证据:
  - `phases/phase-p13-survey/sprints/sprint-04/evidence/F05.verify.log`
- 提交记录:
  - 待提交
- 已知风险或未解决问题:
  - 无。首次 verify 中 migration 曾因 Postgres 刚启动连接中断失败；Postgres ready 后完整 verify 已通过。
- 下一步最佳动作:
  - 提交本 worktree 的 F05 改动；不要 push/PR。

### 2026-07-02（worker wrk-survey-1，F04）
- 本轮目标: GitHub issue #127 / Phase p13 F04：查看答卷与报告（Summary/Individual/Report + 导出）。
- 说明: `phases/phase-p13-survey/feature_list.json` 中 F04 的 `sprint` 字段为 `null`（未挂到任何 sprint，与本
  sprint-04 的 `sprint.md` 领取清单是 F05 不一致）；按任务指派直接对 F04 开工，证据仍落盘在
  `sprints/sprint-04/evidence/`（指派要求的路径），未手改 `feature_list.json` 或 `active-features.json`。
- 已完成:
  - `packages/data/src/survey.ts`：新增 `listSurveyResponses(surveyId)`，按提交时间倒序读取某问卷全部答卷。
  - 新增 `apps/web/app/api/surveys/[id]/results/route.ts`：GET 返回问卷 + 按题聚合 summary + 逐份 responses，
    权限复用 `canViewSurvey`（创建者本人 / 当前团队上下文内团队成员），未登录 401，无权限 403。
  - 新增 `apps/web/app/api/surveys/[id]/results/export/route.ts`：GET 返回 CSV 附件（Content-Disposition），
    权限同上；失败返回结构化 JSON 错误供前端重试。
  - 新增 `apps/web/app/(app)/surveys/[id]/results/page.tsx`：Summary / Individual / Report 三视图切换，
    无回收空态、无权限拒绝态、导出 CSV（下载）、导出 PDF（走浏览器打印，print: 样式已做打印优化布局），
    导出失败展示重试按钮。
  - `apps/web/app/(app)/surveys/page.tsx`：在问卷卡片操作区新增 "Report" 按钮（`survey-report-{id}`），
    链接到 `/surveys/{id}/results`；未改动既有 `survey-view-{id}` 内联占位行为，避免破坏 F02 的
    `survey-002-list-manage-surveys.spec.ts` 断言。
  - 新增 `apps/web/e2e/survey-004-view-answers-report.spec.ts`：覆盖空态、Summary/Individual/Report 三视图、
    CSV 导出下载、权限边界（创建者可见、团队外用户 403、未登录 401，且 403 响应体不泄露答卷内容）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（通过）
  - `pnpm --filter @repo/data run migrate`（通过）
  - `pnpm --filter @repo/web exec playwright test e2e/survey-004-view-answers-report.spec.ts`（4 passed）
  - `pnpm --filter @repo/data run typecheck` / `pnpm --filter @repo/web run typecheck`（均通过）
  - `pnpm --filter @repo/web run lint`（通过）
  - `pnpm --filter @repo/data run test`（35 passed）
  - `pnpm --filter @repo/web exec playwright test e2e/survey-001..005*.spec.ts`（合并跑 18 passed，确认未破坏
    F01/F02/F03/F05 既有回归；首次单跑全量时 survey-005 因机器资源争抢超时，单独重跑与合并重跑均通过，判定为
    与本改动无关的偶发资源争抢，非代码问题）
  - `pnpm -w run verify:base`（重跑后 45/45 通过；首次跑时 `@repo/auth` 的 bcrypt 单测因并发 CPU 争抢超时，
    单独跑 `pnpm --filter @repo/auth run test` 0.75s 内通过，判定为资源争抢导致的偶发失败，非本次改动引入）
- 已记录证据:
  - `phases/phase-p13-survey/sprints/sprint-04/evidence/F04.verify.log`
- 提交记录:
  - 分支 `worker/wrk-survey-1-p13-f04-view-report`，已 push，PR 待创建/见 session-handoff。
- 已知风险或未解决问题:
  - F04 未挂载到任何 sprint（`feature_list.json` 中 `sprint: null`），因此 `pnpm harness verify --sprint p13/04`
    不会门控 F04（该 sprint 权威领取清单是 F05）。未自行修改 `feature_list.json` 的 `sprint`/`owner`/`status`
    字段；F04 是否需要先补一个 `new-sprint` 挂载步骤，或由协调者手动跑
    `pnpm harness verify --sprint <正确 sprint> --feature F04` 完成状态门控，留给下一轮/协调者处理。
  - PDF 导出未引入额外依赖，采用浏览器原生打印（`window.print()` + Report 视图的 `print:` 优化样式）生成 PDF，
    不是服务端直接吐 `application/pdf` 二进制；这符合 notes 里"核心导出不依赖 CAP-AI"的范围描述，但如果后续
    验收要求服务端产出真实 PDF 文件，需要另起一个 feature 引入 PDF 生成依赖。
- 下一步最佳动作:
  - 协调者确认 F04 的 sprint 挂载方式，并跑 `pnpm harness verify` 门控其状态为 passing（本 worker 不能自证）。

### 2026-07-02（worker wrk-survey-1，F04 — review 修复）
- 背景: 协调者转达 PR #212 的独立代码审查结论为 Revise（auth/scope/tests 均 Accept 质量，仅一处 Required fix）。
  期间协调者已跑 `harness(coord)` 把 F04 正式认领派发给 wrk-survey-1（`sprint: "04"`, `status: "in_progress"`,
  `owner: "wrk-survey-1"`），解决了上一条记录里"F04 未挂载到任何 sprint"的遗留问题；已 fetch + rebase 到最新
  `origin/main`（干净 rebase，无冲突），此后 diff 只剩本 feature 自己改动的文件。
- 审查发现: `apps/web/app/api/surveys/[id]/results/export/route.ts` 的 `csvEscape()`（原 16-20 行）只转义
  `"`、`,`、`\n`，没有中和以 `=`/`+`/`-`/`@` 开头的单元格值。问卷 `text` 类型答案完全由 respondent 控制，
  且答题 API 对未登录匿名访客公开（F02/F03 的既有设计），恶意答案（如
  `=HYPERLINK("http://evil","x")`）会原样写入 CSV，团队成员用 Excel/Sheets/LibreOffice 打开时被当公式执行
  ——经典 CSV 注入漏洞，判定为合理且必须修的安全问题。
- 已完成:
  - `csvEscape()` 新增 `FORMULA_PREFIX = /^[=+\-@\t\r]/` 前缀检测：命中时先加前导 `'` 再走原有引号转义逻辑，
    强制目标应用把该单元格当字面文本而非公式。
  - `apps/web/e2e/survey-004-view-answers-report.spec.ts` 新增用例
    "CSV 导出对公式注入形态的答案做转义（安全回归）"：用独立 `playwright.request.newContext()`
    （不共享 page 的 owner 会话 cookie，沿用 admin-001 spec 的隔离多用户模式）模拟匿名访客提交
    `=HYPERLINK(...)` 形态的恶意文本答案，再以 owner 身份调用 CSV 导出，断言导出内容里该单元格已被加上
    前导 `'`（且断言了 CSV 自身对内部双引号的 `""` 转义规则，避免断言写死成不符合实际编码的字符串）。
- 运行过的验证（修复后重跑）:
  - `pnpm --filter @repo/web run typecheck` / `pnpm --filter @repo/data run typecheck`（均通过）
  - `pnpm --filter @repo/web run lint`（通过）
  - `docker compose -f infra/docker-compose.yml up -d`（通过）
  - `pnpm --filter @repo/data run migrate`（通过）
  - `pnpm --filter @repo/web exec playwright test e2e/survey-004-view-answers-report.spec.ts`（5 passed，
    含新增的公式注入回归用例）
  - `pnpm --filter @repo/web exec playwright test e2e/survey-001..005*.spec.ts`（合并跑 19 passed，确认修复
    未破坏既有 survey 回归）
- 已记录证据:
  - `phases/phase-p13-survey/sprints/sprint-04/evidence/F04.verify.log`（已用本轮重跑结果覆盖，标注了
    "re-run after code-review fix"）。
- 提交记录:
  - 同分支 `worker/wrk-survey-1-p13-f04-view-report`，追加 commit 并 push 到同一 PR #212（未开新 PR）。
- 已知风险或未解决问题:
  - 无新增已知问题。PDF 导出仍是浏览器打印路径（见上一条记录），未变。
- 下一步最佳动作:
  - 协调者/审查者确认修复到位后，跑 `pnpm harness verify` 完成 F04 状态门控（本 worker 仍不能自证 passing）。
