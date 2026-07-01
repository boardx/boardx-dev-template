# 会话交接 — Sprint p15/02

## 当前已验证
- F03（团队管理）：实现完成，验证全绿（见 `progress.md` 的"运行过的验证"一节）。
  尚未由 `pnpm harness verify` 门控为 `passing`（该转移不由本 agent 执行）。

## 本轮改动
- 合并了 `origin/harness/coord-dispatch-wave2-admin-payment`（带入 F01 admin 门控骨架 +
  p14 F05 payment engine，这两者不是本 feature 的产出，只是依赖需要）。
- `packages/data/src/teams.ts`：新增 `listAdminTeams`/`updateTeamType`/`isTeamType`。
- `apps/web/app/api/admin/teams/route.ts`（新）、`.../[id]/route.ts`（新）、
  `.../[id]/credit/route.ts`（新）。
- `apps/web/app/(app)/admin/teams/page.tsx`：从 F01 占位页替换为真实团队管理页。
- `apps/web/app/(app)/admin/admin-home.tsx`：teams 模块 `available: true`。
- `apps/web/e2e/admin-005-view-admin-home.spec.ts`：更新团队相关两条断言以匹配真实行为。
- 新增 `apps/web/e2e/admin-002-manage-teams.spec.ts`（本 feature 的目标验证）。

## 仍损坏或未验证
- 无已知损坏。`verify:base` 与目标 e2e 均通过。
- 环境小缺口（非本 feature 引入，未修）：`scripts/init-worktree-env.sh` 未写
  `PG_PORT`/`REDIS_PORT`，需手动从 `.env.local` 里的端口显式传给 `docker compose up`。
- `origin/harness/coord-dispatch-wave2-admin-payment`（含 F01 真实代码）尚未合并进 `main`——
  这是 coordinator 侧待办，不是本 feature 的阻塞项（已通过本地合并绕过）。

## 下一步最佳动作
- 下一轮：等 PR #137（Closes #137）review + CI 绿后由 coordinator 合并。
- 不要动 `apps/web/app/(app)/admin/users/*`、`apps/web/app/api/admin/users/*`
  （F02 owner wrk-admin-1 的范围）。
- 不要动 `apps/web/app/(app)/admin/ai-store/*`（F04/F05，blocked-on p11，未来 owner 的范围）。
- 建议尽快把 `harness/coord-dispatch-wave2-admin-payment` 合并进 `main`，避免后续依赖 F01/p14
  的 worker 重复做同样的临时合并。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p15/02`
- 调试:`PG_PORT=60461 REDIS_PORT=60462 docker compose -f infra/docker-compose.yml up -d && DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" pnpm --filter @repo/data run migrate && DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" REDIS_URL="redis://localhost:60462" E2E_PORT=60463 pnpm --filter @repo/web exec playwright test e2e/admin-002-manage-teams.spec.ts`
