# 会话交接 — Sprint p13/04

## 当前已验证
- F05 问卷模板管理（应用/保存/删除模板）已由 `pnpm harness verify --sprint p13/04 --feature F05` 门控升级为 `passing`。
- F05 verification 全部通过:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-005-manage-templates.spec.ts`
- 基础验证 `pnpm -w run verify:base` 通过。
- 证据: `phases/phase-p13-survey/sprints/sprint-04/evidence/F05.verify.log`

## 本轮改动
- 数据层:
  - 新增 `packages/data/migrations/017_survey_templates.sql`，创建 `survey_templates` 并写入内置模板。
  - 扩展 `packages/data/src/survey.ts`，增加模板列表、创建、查询、删除权限与删除仓储函数。
- API:
  - 新增 `apps/web/app/api/survey-templates/route.ts`，支持 GET 可见模板与 POST 团队模板。
  - 新增 `apps/web/app/api/survey-templates/[id]/route.ts`，支持 DELETE 自己/团队可管理模板。
- UI:
  - 更新 `apps/web/app/(app)/surveys/page.tsx`，创建问卷时可选 Blank / 内置 / 团队模板，保存当前问卷为团队模板，删除可管理模板，应用后仍可编辑，并展示团队模板空态。
- 验证:
  - 新增 `apps/web/e2e/survey-005-manage-templates.spec.ts`。

## 仍损坏或未验证
- 无已知损坏。
- `pnpm lint-design` / `pnpm -w run lint-design` 在根目录无对应 script；实际设计检查由 `pnpm --filter @repo/web run lint` 覆盖并已通过。

## 下一步最佳动作
- 本 worktree 只完成并提交 F05；不要改其他 worktree，不要 push/PR。
- 若继续 p13 后续功能，先新建/认领下一 sprint feature，再按根 `AGENTS.md` 开工流程重新确认唯一目标。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p13/04`
- 调试:
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `pnpm --filter @repo/data exec tsc --noEmit`

---

## 追加交接 — 2026-07-02（worker wrk-survey-1，F04，分支 `worker/wrk-survey-1-p13-f04-view-report`）

### 当前已验证（本轮，未由 harness verify 门控为 passing）
- 实现了 GitHub issue #127 / `phases/phase-p13-survey/feature_list.json` 里的 F04
  「查看答卷与报告（Summary/Individual/Report + 导出）」，`user_visible_behavior` 全部覆盖：
  Summary 按题聚合（占比条形图/均值）、Individual 逐份浏览、Report 生成统计报告并支持 CSV/PDF 导出、
  无回收空态、仅创建者/团队成员可查看、导出失败可重试。
- F04 声明的三条 verification 命令全部执行成功（exit code 0），证据见
  `phases/phase-p13-survey/sprints/sprint-04/evidence/F04.verify.log`：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-004-view-answers-report.spec.ts`（4 passed）
- 回归：`survey-001/002/003/005` 全部 e2e 与 `verify:base`（45/45）重跑后均通过；首次单次全量跑时
  `survey-005` 与 `@repo/auth` test 各出现一次因机器资源争抢的超时，隔离重跑均秒级通过，判定与本次代码
  改动无关（未修改这两处涉及的代码路径）。

### 本轮改动
- `packages/data/src/survey.ts`：新增 `listSurveyResponses(surveyId)`。
- 新增 `apps/web/app/api/surveys/[id]/results/route.ts`（GET，聚合数据 + 权限用 `canViewSurvey`）。
- 新增 `apps/web/app/api/surveys/[id]/results/export/route.ts`（GET，CSV 附件下载，同权限）。
- 新增 `apps/web/app/(app)/surveys/[id]/results/page.tsx`（Summary/Individual/Report 三视图 + 导出）。
- `apps/web/app/(app)/surveys/page.tsx`：卡片操作区新增 "Report" 按钮跳转到 results 页；未改动既有
  `survey-view-{id}` 内联占位逻辑（避免破坏 F02 的既有断言）。
- 新增 `apps/web/e2e/survey-004-view-answers-report.spec.ts`。

### 仍损坏或未验证 / 需要协调者处理
- **F04 未挂载到任何 sprint**：`feature_list.json` 中 F04 的 `sprint` 字段是 `null`，本 sprint-04 的
  `sprint.md`/`active-features.json` 领取清单实际是 F05（已 passing）。任务明确要求把证据落到
  `sprints/sprint-04/evidence/F04.verify.log`（已完成），但 `pnpm harness verify --sprint p13/04` 不会拿到
  F04（它只认领取清单里的 feature）。没有手改 `feature_list.json`/`active-features.json`。协调者需要决定：
  要么先跑一次 sprint 挂载/resync 把 F04 关联到正确 sprint，再用 `pnpm harness verify --sprint <id> --feature F04`
  门控为 passing；要么按现状直接对 F04 跑针对性 verify。本 worker 未自我提升 F04 状态，仍是 `not_started`。
- PDF 导出走浏览器原生打印（`window.print()`），不是服务端生成二进制 PDF 文件；如果验收标准要求服务端直接
  产出 `.pdf` 文件本体，需要另开 feature 引入 PDF 生成依赖（当前未引入任何新增第三方包）。
- 未自行合并/自我 push --no-verify；`verify:base` 与声明的三条 verification 命令均干净通过，未触发降级路径。

### 下一步最佳动作
- 协调者/下一轮：确认 F04 的 sprint 归属并跑 `pnpm harness verify` 完成状态门控；PR 已开（见 PR 链接），
  由协调者 review 后合并，本 worker 未自我合并。

---

## 追加交接 — 2026-07-02（同一 worker，review 修复轮，PR #212 未变）

### 背景
- 协调者已跑 `harness(coord)` 提交把 F04 正式认领派发给 wrk-survey-1（`phases/phase-p13-survey/feature_list.json`
  中 F04 现在是 `sprint: "04"`, `status: "in_progress"`, `owner: "wrk-survey-1"`）——解决了上面记录的
  "F04 未挂载到任何 sprint" 遗留问题。已 `git fetch origin && git rebase origin/main`，干净无冲突。
- PR #212 收到独立代码审查：Revise，一处 Required fix（auth/scope/tests 均 Accept 质量）：
  `apps/web/app/api/surveys/[id]/results/export/route.ts` 的 `csvEscape()` 未防 CSV 公式注入——
  未登录匿名访客可控的 `text` 答案若以 `=`/`+`/`-`/`@` 开头，会被 Excel/Sheets/LibreOffice 当公式执行。

### 本轮改动（修复 + 回归测试，追加到同一分支同一 PR）
- `apps/web/app/api/surveys/[id]/results/export/route.ts`：`csvEscape()` 新增
  `FORMULA_PREFIX = /^[=+\-@\t\r]/` 检测，命中时先加前导 `'` 再走原有引号转义，中和公式注入。
- `apps/web/e2e/survey-004-view-answers-report.spec.ts`：新增
  "CSV 导出对公式注入形态的答案做转义（安全回归）" 用例，用独立 `playwright.request.newContext()`
  模拟匿名访客提交 `=HYPERLINK(...)` 形态答案，断言 CSV 导出内容里该单元格已被 `'` 前缀中和。
- `phases/phase-p13-survey/sprints/sprint-04/evidence/F04.verify.log`：用修复后重跑结果覆盖（5 passed，
  含新回归用例），标注 "re-run after code-review fix"。
- `phases/phase-p13-survey/sprints/sprint-04/progress.md`：追加本轮记录。

### 已验证（本轮）
- `pnpm --filter @repo/web run typecheck` / `pnpm --filter @repo/data run typecheck` — 均通过
- `pnpm --filter @repo/web run lint` — 通过
- F04 声明的三条 verification 命令（docker up / migrate / playwright test） — 全部 exit 0，
  `survey-004-view-answers-report.spec.ts` 5 passed
- `survey-001..005` 合并回归（19 tests） — 全部通过，确认修复未引入新破坏

### 仍需协调者处理
- F04 状态门控（`not_started` → `passing`）仍需协调者/harness verify 完成，本 worker 不能自证。
- 未自我合并 PR #212；同一 PR 上追加了新 commit，未开新 PR。

### 命令
- 验证：`pnpm --filter @repo/web exec playwright test e2e/survey-004-view-answers-report.spec.ts`
- 回归：`pnpm --filter @repo/web exec playwright test e2e/survey-001-create-survey.spec.ts e2e/survey-002-list-manage-surveys.spec.ts e2e/survey-003-answer-survey.spec.ts e2e/survey-004-view-answers-report.spec.ts e2e/survey-005-manage-templates.spec.ts`
