# 会话交接 — Sprint p13/01

## 当前已验证
- F01（创建问卷）：实现完成，本地跑过全部三条 verification 命令且退出码 0（见
  `evidence/verification-output.txt`）。`status` 仍是 `in_progress`——按硬约束，
  只有 `pnpm harness verify` 能把它转成 `passing`，本会话未运行该命令（worker 不越权）。

## 本轮改动
- `packages/data/migrations/016_survey.sql`（新增 surveys/survey_questions/survey_responses）
- `packages/data/src/survey.ts`（新增仓储 + 单测 `survey.test.ts`）
- `packages/data/src/index.ts`（新增 export）
- `apps/web/app/api/surveys/route.ts`（内存版 → 真实 DB 版，重写）
- `apps/web/app/(app)/surveys/page.tsx`（创建器加多题型/排序/预览/team 选择器/分享链接，重写）
- `apps/web/playwright.config.ts`（加 `E2E_PORT` 覆盖，默认值不变，向后兼容）
- `apps/web/e2e/survey-001-create-survey.spec.ts`（重写为 7 个真实场景用例）

## 仍损坏或未验证
- 无已知回归：`pnpm -w run verify:base` 37/37 通过。
- F01 范围内不含：列表管理（Edit/Pause/Delete）、公开答题页、报告导出、模板、发布开关——
  均是 F02-F06，按 issue 边界有意排除，不是遗漏。
- 本机同时有多个 agent worktree 在跑，默认 docker compose project 名/端口 3000 都可能被
  其它 agent 占用；本会话验证时用了 `COMPOSE_PROJECT_NAME=surveyf01` + 自定义端口
  （15913/16913 for db/redis，3913 for web）规避冲突，验证完已 `docker compose down` 清理。

## 下一步最佳动作
- coordinator：review 通过后按 F01 的 verification 命令跑 `pnpm harness verify --sprint p13/01`
  确认转 `passing`。
- 下一个 worker：认领 F02（问卷列表管理），可直接复用 `packages/data/src/survey.ts` 里的
  `listVisibleSurveys` / `countResponses` / `getSurvey`；F02 需要新增 PATCH（pause/activate）
  和 DELETE 路由 + 列表页卡片操作 UI。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p13/01`（coordinator 专属，worker 不跑这条）
- 调试:多 agent 并行时用独立 compose project 起依赖，例如：
  `COMPOSE_PROJECT_NAME=surveyf01 PG_PORT=15913 REDIS_PORT=16913 docker compose -f infra/docker-compose.yml up -d`
  然后 `DATABASE_URL=postgresql://boardx:boardx@localhost:15913/boardx E2E_PORT=3913 pnpm --filter @repo/web exec playwright test e2e/survey-001-create-survey.spec.ts`
