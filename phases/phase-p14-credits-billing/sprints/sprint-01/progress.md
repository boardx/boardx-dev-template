# 进度日志 — Sprint p14/01

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/agent-a40ded8fcd5d56427`（worker `wrk-credits-1`）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01（本轮已实现，等待 `pnpm harness verify` 门控转 passing）
- 当前 blocker: 无（本机多 agent 共用同一 docker 默认端口/端口 3000，已用隔离 compose project + `E2E_PORT` 覆盖规避，详见 session-handoff）

## 会话记录
### 2026-07-01 09:04:01
- 本轮目标: 实现 F01（积分钱包查看：Team Credits 页 + 用户菜单个人余额）
- 已完成:
  - `packages/data/migrations/016_credits.sql`：新建 `credit_wallets`（scope=personal/team）+ `credit_transactions` 表。
  - `packages/data/src/credits.ts`：钱包仓储（`getOrCreatePersonalWallet` / `getOrCreateTeamWallet` / `listTransactions` / `recordTransaction`），已导出到 `packages/data/src/index.ts`。
  - `apps/web/lib/credits.ts`：共享装配逻辑（含确定性演示流水播种 `seedDemoIfEmpty`，写真实表而非内存 mock）。
  - `apps/web/app/api/credits/wallet/route.ts`：真实 `GET /api/credits/wallet?scope=personal|team`，team scope 用 `@repo/auth` 的 `canManageTeam` 做 owner/admin 权限校验（403 拒绝 member）。
  - `apps/web/app/api/credits/route.ts`：保留旧路径，等价于 `scope=personal`（向后兼容）。
  - `apps/web/app/(app)/credits/page.tsx`：按当前团队角色自动判断个人/团队视角，team 视角展示团队名（`scope-label`）。
  - `apps/web/components/app-shell/sidebar.tsx`：用户菜单 Credit 余额入口改为拉取真实个人钱包余额（原来是硬编码 "3,210 credits"）。
  - `apps/web/e2e/credits-001-view-wallet.spec.ts`：从纯 mock 的 TDD 占位测试，改写为覆盖真实验收标准的端到端测试（个人钱包、team owner 查看、member 403、空态、用户菜单余额、未登录 401/跳转）。
  - `apps/web/playwright.config.ts`：新增可选 `E2E_PORT` 环境变量覆盖端口（默认仍是 3000，行为不变），仅用于本机多 worktree/多 agent 并行跑 e2e 时避开端口冲突。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（本机多 agent 共享默认 compose 项目名冲突，改用 `-p credits-p14` + `PG_PORT=5561 REDIS_PORT=6561` 隔离；见 evidence）→ 0
  - `pnpm --filter @repo/data run migrate` → 0（016_credits.sql 应用成功）
  - `pnpm --filter @repo/web exec playwright test e2e/credits-001-view-wallet.spec.ts`（`E2E_PORT=3103`，因本机 3000 端口被另一 agent 占用）→ 9/9 通过，exit 0
  - `pnpm -w run verify:base` → 37/37 成功（typecheck/lint/test 全绿，未破坏其它 feature）
- 已记录证据:
  - `evidence/f01-docker-and-migrate.txt`
  - `evidence/f01-e2e-credits-001-view-wallet.txt`
- 提交记录: 见分支 `worker/wrk-credits-1-p14-f01-credits-wallet` 的 PR（Closes #130）
- 已知风险或未解决问题:
  - 本机同时有其它 worktree 的 agent 占用默认端口 3000 与默认 docker compose 项目名 `infra`；本轮验证改用隔离 compose project + `E2E_PORT`，命令语义与 verification 一致，但字面命令行在本机需要加 env 才能跑通（干净单 agent 环境下裸跑默认端口即可，无需 `E2E_PORT`）。
  - `apps/web/e2e/team-*.spec.ts` 等既有测试的部分用例内部硬编码 `baseURL: "http://localhost:3000"`（不读 `E2E_PORT`），在本机端口冲突场景下会失败；这是既有代码的预先存在的问题，非本次改动引入，未做修改（范围外）。
  - F02（购买）/F05（支付）/AI 消耗扣费（p9/p12）尚未实现，钱包目前只有「查看」+ 确定性演示流水播种，无真实购买/扣费写入路径——符合 F01 notes 的范围（只建地基 + 查看）。
- 下一步最佳动作: 等待 review + `pnpm harness verify --sprint p14/01` 门控转 passing；后续 F02/F03/F05 可复用 `packages/data/src/credits.ts` 的 `recordTransaction`。
