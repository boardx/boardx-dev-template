# 会话交接 — Sprint p14/01

## 当前已验证
- F01（积分钱包查看）：实现完成，e2e `credits-001-view-wallet.spec.ts` 9/9 通过（exit 0），
  `pnpm --filter @repo/data run migrate` 通过，`pnpm -w run verify:base` 37/37 通过。
  状态仍是 `in_progress`（未跑 `pnpm harness verify` 门控转 passing——按规矩由该命令而非本 agent 转移状态）。

## 本轮改动
- `packages/data/migrations/016_credits.sql`：新表 `credit_wallets`（scope personal/team，personal 唯一 owner_user_id、team 唯一 team_id 的 partial unique index）+ `credit_transactions`（kind usage/purchase，amount 正负号表方向，balance_after 快照）。
- `packages/data/src/credits.ts`：仓储层，`getOrCreatePersonalWallet` / `getOrCreateTeamWallet` / `getPersonalWallet` / `getTeamWallet` / `listTransactions` / `recordTransaction`（原子更新钱包汇总字段 + 插入流水，供 F02/F05/p9/p12 后续复用）。已在 `packages/data/src/index.ts` 导出。
- `apps/web/lib/credits.ts`：共享装配层——`loadPersonalWallet` / `loadTeamWallet`（含 `seedDemoIfEmpty`：新钱包首次访问播种一组确定性演示流水，写真实表，非内存 mock；`?state=empty` 时跳过播种展示真空态）。
- `apps/web/app/api/credits/wallet/route.ts`：真正的 `GET /api/credits/wallet?scope=personal|team`。team scope 从 cookie 读当前团队 id，用 `@repo/auth` 的 `canManageTeam`（owner/admin）做权限门，member 返回 403。
- `apps/web/app/api/credits/route.ts`：保留旧路径，内部委托同一套 `loadPersonalWallet`（原来是纯内存 mock，现在是真实 DB）。
- `apps/web/app/(app)/credits/page.tsx`：先查 `/api/teams` + `/api/teams/current` 判断当前团队角色，owner/admin 走 `scope=team`（展示团队名 `data-testid="scope-label"`），否则走 `scope=personal`；新增 403 提示态 `data-testid="forbidden"`。
- `apps/web/components/app-shell/sidebar.tsx`：用户菜单打开时拉取 `/api/credits/wallet?scope=personal`，把硬编码的 "3,210 credits" 换成真实余额（`data-testid="user-menu-credits-balance"`）。
- `apps/web/e2e/credits-001-view-wallet.spec.ts`：重写为真实验收测试（原文件是纯 mock 的 TDD 占位）。
- `apps/web/playwright.config.ts`：加 `E2E_PORT` 环境变量可选覆盖端口（默认值仍 3000，未设置时行为与之前完全一致）。

## 仍损坏或未验证
- 未做：F02（购买）、F03（流水弹窗细节）、F04/F05（支付）——均是后续 feature，本轮按 notes 明确不做。
- 已知环境噪音（非本次改动引入，未修）：
  - `apps/web/e2e/team-*.spec.ts` 里部分辅助函数硬编码 `baseURL: "http://localhost:3000"`，不读 `E2E_PORT`，本机多 agent 占用 3000 时会连不上、报错——预先存在的问题，超出本 feature 范围，未改动这些文件。
  - 本机 docker 默认 compose 项目名 `infra` + 默认端口 5432/6379 被其它并行 agent 占用/循环重建过；本次验证改用隔离 `-p credits-p14` + `PG_PORT=5561 REDIS_PORT=6561`，语义等价但命令行需要显式加这些参数才能在本机跑通（干净单 agent 环境下不需要）。

## 下一步最佳动作
- 下一轮：等 PR review + CI `harness-verify` 通过后由 coordinator 跑 `pnpm harness verify --sprint p14/01` 把 F01 转 passing。
- 不要动：`packages/data/src/teams.ts`、`@repo/auth` 的 `canManageTeam`（本轮只读复用，未改）；也不要动 `apps/web/e2e/team-*.spec.ts`（预先存在的端口硬编码问题，超出本 feature 范围）。
- F02/F03/F05 实现时直接复用 `packages/data/src/credits.ts` 的 `recordTransaction`，不要重新发明钱包写入逻辑。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p14/01`
- 调试（本机端口冲突时）:
  ```
  PG_PORT=5561 REDIS_PORT=6561 docker compose -f infra/docker-compose.yml -p credits-p14 up -d
  PGHOST=localhost PGPORT=5561 PGUSER=boardx PGPASSWORD=boardx PGDATABASE=boardx pnpm --filter @repo/data run migrate
  PGHOST=localhost PGPORT=5561 PGUSER=boardx PGPASSWORD=boardx PGDATABASE=boardx E2E_PORT=3103 pnpm --filter @repo/web exec playwright test e2e/credits-001-view-wallet.spec.ts
  ```
