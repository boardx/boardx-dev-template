# Evidence — F03（团队管理：搜索/分页/编辑团队类型 + 手动上分）

## 运行环境说明
本 worktree 用 `scripts/init-worktree-env.sh` 分配的独立端口跑验证（同机多 agent 并行，
避免与其他 worktree 抢默认端口 5432/6379/3000）：

```bash
PG_PORT=60461 REDIS_PORT=60462 \
  docker compose -f infra/docker-compose.yml up -d

DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" \
  pnpm --filter @repo/data run migrate

DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" \
REDIS_URL="redis://localhost:60462" \
E2E_PORT=60463 \
  pnpm --filter @repo/web exec playwright test e2e/admin-002-manage-teams.spec.ts
```

注：`scripts/init-worktree-env.sh` 目前只把端口写进 `apps/web/.env.local`（DATABASE_URL/
REDIS_URL/E2E_PORT）供 Next dev/Playwright 用；`infra/docker-compose.yml` 读的是
`PG_PORT`/`REDIS_PORT` 这两个 compose 专用变量，脚本没有写这两个 key，需要手动从
`.env.local` 里的端口号显式传给 `docker compose up`（已在上面命令体现）。这是现有脚本的一个
小缺口，与本 feature 无关，未在本次改动，仅记录方便下一轮排查。

## 文件
- `f03-01-migrate.txt` — `pnpm --filter @repo/data run migrate` 输出（幂等，全部"已应用，跳过"，
  证明本 feature 未新增迁移——`teams.team_type` 与 `credit_wallets/credit_transactions` 均已由
  `015_team_general.sql`/p14 `016_credits.sql` 建好，F03 直接复用）。
- `f03-02-playwright-admin-002.txt` — 目标 verification 命令
  （`e2e/admin-002-manage-teams.spec.ts`）完整通过输出：6/6 passed。
- `f03-03-verify-base-tail.txt` — `pnpm -w run verify:base`（`init.sh` 的基础验证）通过输出尾部：
  45/45 tasks successful，证明本 feature 未引入新的基础失败。

## 覆盖范围与复用说明
- **门控**：复用 F01 的 `apps/web/lib/admin.ts` → `requireSysAdmin()`，未新建平行门控逻辑。
  `apps/web/app/(app)/admin/teams/page.tsx` 从 F01 的占位页（`ComingSoon`）替换为真实页面；
  `admin-home.tsx` 的团队管理模块卡片 `available` 由 `false` 改 `true`（不再带"即将上线"徽章）。
- **数据**：`packages/data/src/teams.ts` 新增 `listAdminTeams`（名称搜索 + 分页 + 成员数/Credit
  聚合）与 `updateTeamType`；两者都是纯读/写既有表（`teams`/`team_members`/`credit_wallets`），
  未加迁移。
- **手动上分**：`apps/web/app/api/admin/teams/[id]/credit/route.ts` 直接复用 p14 的
  `getOrCreateTeamWallet` + `recordTransaction`（`packages/data/src/credits.ts`），与 F02
  用户手动上分应共用同一套仓储函数，未写平行的积分变更路径。
- **API**：
  - `GET /api/admin/teams?q=&page=&pageSize=` — 分页/搜索列表。
  - `PATCH /api/admin/teams/:id { teamType }` — 更新团队类型（`standard`|`enterprise`，非法值 400）。
  - `POST /api/admin/teams/:id/credit { amount, note }` — 手动增加 Credit（`amount<=0` 拒绝 400）。
  三者均走 `requireSysAdmin()`：未登录 401，非 SysAdmin 403。
- **随附小改动（非新范围，只是让 F01 的现有 e2e 断言跟上真实行为）**：
  `e2e/admin-005-view-admin-home.spec.ts` 里"团队管理模块导航"相关断言从"点进占位子页 + 带
  即将上线徽章"改为"点进真实 `/admin/teams` + 不带徽章"；未改该文件的其它断言（AI Store
  两个模块仍带徽章，因为 F04/F05 未建）。
- **不属于 F03 范围、未做**：F02 用户管理、F04/F05 AI Store 审核/精选；团队改名/删除/成员管理
  （已有 `uc-team-007`/team 自身设置覆盖，不在后台管理范围内）。

## 集成说明（供 coordinator 参考）
本 worktree 起始基线（`origin/harness/coord-wave3-remaining` 合并后）不含 F01 的实际代码
（`requireSysAdmin`/`admin/teams` 占位页等）——F01 真正落地在 `origin/harness/coord-dispatch-
wave2-admin-payment`（PR #145 已合并到该中间分支，但该分支尚未合并进 `main`）。为了复用 F01
的门控（而不是重新造一个），本会话额外执行了：

```bash
git merge origin/harness/coord-dispatch-wave2-admin-payment --no-edit
```

只产生一处冲突（`packages/data/src/index.ts` 的 barrel export 列表，双方都在追加新增导出行，
已两边合并保留）。这把 F01（admin 门控/首页）与 p14 F05（payment engine，属另一 owner
`wrk-payment-1`）的代码一并带入本分支——这些不是本 feature 的产出，PR diff 里请按文件归属区分。
建议 coordinator 尽快把 `harness/coord-dispatch-wave2-admin-payment` 合并进 `main`，避免后续
worker 重复踩到同样的"依赖分支未上主干"问题。
