# 会话交接 — Sprint p13/06

## 当前已验证
- F06 发布/暂停问卷（公开答题开关）实现与声明的三条 verification 命令已在本地全部通过
  （见下方"命令"与 `evidence/F06.verify.log`），但**尚未**跑 `pnpm harness verify` 门控，
  状态仍是 `not_started`（本 worker 不能自升级为 passing）。
- F06 verification：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-006-publish-unpublish-survey.spec.ts`（4 passed）
- 回归（未声明但已跑，证明未破坏 F01/F02/F03/F05）：
  `pnpm --filter @repo/web exec playwright test e2e/survey-001-create-survey.spec.ts
  e2e/survey-002-list-manage-surveys.spec.ts e2e/survey-003-answer-survey.spec.ts
  e2e/survey-005-manage-templates.spec.ts e2e/survey-006-publish-unpublish-survey.spec.ts`
  → 18 passed。
- 证据: `phases/phase-p13-survey/sprints/sprint-06/evidence/F06.verify.log`

## 本轮改动
- 仅新增一个文件：`apps/web/e2e/survey-006-publish-unpublish-survey.spec.ts`。
- 未改动任何实现代码。PATCH /api/surveys/:id {isActive}
  （`apps/web/app/api/surveys/[id]/route.ts`）、公开答题门控
  （`apps/web/app/api/surveys/[id]/answer/route.ts` + `packages/data/src/survey.ts` 的
  `getPublicSurveyForAnswer`/`updateSurvey`）、卡片 Pause/Activate 切换 UI
  （`apps/web/app/(app)/surveys/page.tsx` 的 `toggleSurveyStatus`/`survey-toggle-*`）
  均已由 F01/F03 实现覆盖，F06 的缺口只是声明的 e2e 契约文件不存在。
- 顺带 scaffold 了本 sprint 目录（`pnpm harness new-sprint --phase p13 --id 06 ...`），
  因为 F06 此前 `sprint: null`，没有 sprint-06 目录。

## 仍损坏或未验证
- `pnpm -w run verify:base` 中 `@repo/auth#test` 的
  `password > hash 不等于明文，verify 正确匹配` 用例在 turbo 全并发下偶发超 5s 超时；
  单独跑 `pnpm --filter @repo/auth run test` 复测 836ms 全绿。本分支对
  `packages/auth` 零 diff，判定为共享机器资源争用导致的无关 flake，与 F06 无关，未修复。
- 未跑 `pnpm harness verify --sprint p13/06`（留给下一步 / 协调者门控）。

## 下一步最佳动作
- 下一轮:提交本 worktree 改动 → push `worker/wrk-survey-2-p13-f06-publish-pause` →
  开 PR（Closes #129）→ 不自行合并，等待 review/门控把 F06 转 passing。
- 不要动 `packages/auth`（与本 feature 无关的 flake，另开维护任务处理）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p13/06`
- 调试:
  - `pnpm --filter @repo/web exec playwright test e2e/survey-006-publish-unpublish-survey.spec.ts --reporter=list`
  - `pnpm --filter @repo/auth run test`（隔离复测 auth flake）
