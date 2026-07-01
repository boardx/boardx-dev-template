# 进度日志 — Sprint p15/02

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02（用户管理，owner wrk-admin-1，可能并行进行中，未在本会话触碰）
- 当前 blocker: 无（F03 已完成实现 + 验证；等待 `pnpm harness verify` 门控转 passing）

## 会话记录
### 2026-07-01（wrk-admin-2，F03 团队管理）
- 本轮目标: 实现 F03（团队管理：搜索/分页/编辑团队类型 + 手动上分），issue #137。
- 已完成:
  - 先合并 `origin/harness/coord-dispatch-wave2-admin-payment`（带入 F01 的
    `requireSysAdmin()`/`/admin` 骨架，本 worktree 起始基线原本不含），
    仅一处冲突（`packages/data/src/index.ts` barrel export，两边合并保留）。
  - `packages/data/src/teams.ts` 新增 `listAdminTeams`（搜索+分页+成员数/Credit 聚合）、
    `updateTeamType`、`isTeamType`。
  - 新 API：`GET /api/admin/teams`、`PATCH /api/admin/teams/:id`、
    `POST /api/admin/teams/:id/credit`（复用 p14 `getOrCreateTeamWallet`/`recordTransaction`）。
  - `apps/web/app/(app)/admin/teams/page.tsx` 从 F01 占位页替换为真实页面
    （搜索/分页/团队列表/编辑类型弹窗/手动上分弹窗）。
  - `admin-home.tsx` 团队管理模块卡片 `available: false → true`（去掉"即将上线"徽章）。
  - 同步更新 `e2e/admin-005-view-admin-home.spec.ts` 中团队相关的两条断言（F01 的测试，
    随 F03 落地而更新为真实行为；未改其余断言）。
- 运行过的验证:
  - `pnpm --filter @repo/data run typecheck` ✓
  - `pnpm --filter @repo/web run typecheck` ✓
  - `pnpm --filter @repo/data run lint` ✓ / `pnpm --filter @repo/web run lint` ✓
  - `docker compose -f infra/docker-compose.yml up -d`（`PG_PORT=60461 REDIS_PORT=60462`）
  - `pnpm --filter @repo/data run migrate` ✓（幂等，全部"已应用，跳过"，无新迁移）
  - `pnpm --filter @repo/web exec playwright test e2e/admin-002-manage-teams.spec.ts` ✓ 6/6 passed
  - `pnpm --filter @repo/web exec playwright test e2e/admin-005-view-admin-home.spec.ts e2e/admin-001-manage-users.spec.ts` ✓ 10/10 passed（回归确认未破坏 F01/F02 既有断言）
  - `pnpm -w run verify:base`（`init.sh` 基础验证）✓ 45/45 tasks successful
- 已记录证据: `phases/phase-p15-admin/sprints/sprint-02/evidence/`
  （`f03-01-migrate.txt`、`f03-02-playwright-admin-002.txt`、`f03-03-verify-base-tail.txt`、`README.md`）
- 提交记录: 分支 `worker/wrk-admin-2-p15-f03-team-management`（见 PR）
- 已知风险或未解决问题:
  - `scripts/init-worktree-env.sh` 目前不写 `PG_PORT`/`REDIS_PORT`（docker-compose.yml 实际读的
    变量名），只写 `apps/web/.env.local` 的 `DATABASE_URL`/`REDIS_URL`/`E2E_PORT`——本会话手动从
    这些端口反推并显式传给 `docker compose up`。建议后续给该脚本补上这两个 key（不在本 feature
    范围内，未改动，仅记录）。
  - F01 的实际代码目前只在 `origin/harness/coord-dispatch-wave2-admin-payment` 分支上，尚未合并
    进 `main`。本会话已把该分支合并进当前 worker 分支以复用 F01 门控，但建议 coordinator 尽快把
    该分支本身合并进 `main`，否则其他 depends_on F01 的后续 worker 会重复遇到同样的问题。
- 下一步最佳动作: 等 review + CI 绿后由 coordinator 合并；下一 owner 从 F02（用户管理，若
  wrk-admin-1 尚未完成）或本阶段其余 wave 1/2 feature 继续。不要动 `admin/users/*` 相关文件
  （F02 owner 的范围）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p15/02`
- 调试: `PG_PORT=60461 REDIS_PORT=60462 docker compose -f infra/docker-compose.yml up -d`，
  再 `DATABASE_URL=... REDIS_URL=... E2E_PORT=... pnpm --filter @repo/web exec playwright test e2e/admin-002-manage-teams.spec.ts`
