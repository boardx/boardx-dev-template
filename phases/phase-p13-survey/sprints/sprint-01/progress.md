# 进度日志 — Sprint p13/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（worktree agent-a36d9cb2bf96083df）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02（问卷列表管理）等 F02-F06，依赖 F01 地基
- 当前 blocker: 无（F01 已实现并本地验证通过，等待 harness verify 门控）

## 会话记录
### 2026-07-01（wrk-survey-1）
- 本轮目标: 实现 F01「创建问卷（创建器 + 多题型 + 选项 + 预览）」，issue #124。
- 已完成:
  - 新增 DB 地基（migration `016_survey.sql`）：`surveys` / `survey_questions` / `survey_responses`（team 作用域）。
  - 新增仓储 `packages/data/src/survey.ts`：createSurvey（事务：survey+questions）、listVisibleSurveys、
    getSurveyWithQuestions、canViewSurvey、countResponses、纯函数 `isBlank`（单测覆盖）。
  - 重写 `apps/web/app/api/surveys/route.ts`：从内存 Map 版换成真实 DB 读写；POST 校验标题非空 +
    至少一道有效题目；scope=team 校验 teamId 且需为该团队成员（403）。
  - 重写 `apps/web/app/(app)/surveys/page.tsx`：创建器支持多题型（text/single/multiple/rating）+
    选项增删 + 上移/下移排序 + required 勾选 + 预览（只读渲染答题页样式）+ team 作用域的团队选择器 +
    创建成功后展示可分享链接（`/survey/:id/answer`，公开答题页留给 F03）。
  - `apps/web/playwright.config.ts` 增加 `E2E_PORT` 环境变量覆盖（默认仍 3000，向后兼容），
    解决本机多 agent 并行时端口互踩导致无法起自己的 dev server 的问题。
  - 重写 `apps/web/e2e/survey-001-create-survey.spec.ts`：7 个用例覆盖创建器/多题型/选项/排序/
    预览/team 作用域权限/空标题拒绝/零题目拒绝/未登录跳转。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（用隔离 `COMPOSE_PROJECT_NAME=surveyf01` +
    自定义端口，避免与其它并行 agent 的 postgres/redis 容器冲突）
  - `pnpm --filter @repo/data run migrate` → 016_survey.sql 应用成功
  - `pnpm --filter @repo/web exec playwright test e2e/survey-001-create-survey.spec.ts` → 7 passed
  - `pnpm --filter @repo/data run test`（单测，含新增 survey.test.ts）→ 18 passed
  - `pnpm --filter @repo/web run lint` → 通过
  - `pnpm -w run verify:base`（typecheck+lint+test 全仓库）→ 37/37 successful，无回归
- 已记录证据: `phases/phase-p13-survey/sprints/sprint-01/evidence/verification-output.txt`,
  `evidence/docker-ps.txt`
- 提交记录: 分支 `worker/wrk-survey-1-p13-f01-survey-create`，PR 见 GitHub #124（Closes #124）
- 已知风险或未解决问题:
  - 本仓库当前有多个 agent worktree 共用宿主机 docker，默认 `infra` compose project 容易端口/
    容器名冲突；本 feature 验证时用了自定义 `COMPOSE_PROJECT_NAME` + 端口规避，后续 sprint 若要
    固化「多 agent 并行跑 e2e」的标准做法，建议在 testing-standards 里补一条约定。
  - F01 只做创建/预览/保存地基；列表管理操作（Edit/Pause/Delete 等，F02）、公开答题（F03）、
    报告导出（F04）、模板（F05）、发布开关（F06）均未做，按 issue 范围有意排除。
  - `is_active` 落库默认 false（草稿），发布开关的 UI/API 留给 F06；F01 列表页展示的 Status
    徽章目前恒为 Draft，属预期（F06 才会切换）。
- 下一步最佳动作: 认领 F02（问卷列表管理），复用本 feature 的 `listVisibleSurveys` /
  `countResponses`；F02 需要新增 Edit/Pause/Delete 的 API + UI。
