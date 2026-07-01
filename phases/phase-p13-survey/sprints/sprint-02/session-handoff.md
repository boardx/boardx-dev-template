# 会话交接 — Sprint p13/02

## 当前已验证
- F02 已在独立 worktree 完成用户指定 verification，尚未转为 `passing`（未手改状态）。
- 已通过:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-002-list-manage-surveys.spec.ts`（3 passed）
  - `pnpm -w run verify:base`（45 successful / 45 total）
- 证据: `phases/phase-p13-survey/sprints/sprint-02/evidence/F02.verify.log`

## 本轮改动
- 迁入 F02 survey 列表管理实现:
  - `packages/data/src/survey.ts`
  - `apps/web/app/api/surveys/route.ts`
  - `apps/web/app/api/surveys/[id]/route.ts`
  - `apps/web/app/(app)/surveys/page.tsx`
  - `apps/web/e2e/survey-002-list-manage-surveys.spec.ts`
- 迁入验证环境修复:
  - `scripts/init-worktree-env.sh`
  - `packages/data/src/migrate.ts`
  - `apps/web/playwright.config.ts`
- 补齐 sprint-02 元数据，当前工作集只含 F02。

## 仍损坏或未验证
- 未运行 `pnpm harness verify --sprint p13/02 --feature F02`；不要手改 F02 为 `passing`。
- `pnpm harness new-sprint` 在 sprint 目录已存在后拒绝覆盖；当前权威状态在 `feature_list.json`。
- F02 的 Pause/Activate 只实现列表管理范围内的 `is_active` 切换；公开答题门控仍留给 F03/F06，报告留给 F04。

## 下一步最佳动作
- coordinator 运行 `pnpm harness verify --sprint p13/02 --feature F02`，让 harness 根据 verification 自动更新状态和 evidence。
- 不要碰 F03/F04/F05/F06。
