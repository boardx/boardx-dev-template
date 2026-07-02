# 会话交接 — Sprint p14/04

## 当前已验证
- F04 尚未 passing；没有手动改 status。
- 已通过:
  - `pnpm --filter @repo/data run typecheck`
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web run lint`
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
- `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts` 曾在本轮通过一次（`7 passed (1.0m)`），但后续本地 Docker Postgres flapping 后无法稳定复跑。

## 本轮改动
- Data:
  - `packages/data/migrations/018_user_plan.sql`
  - `packages/data/src/auth.ts`
- Billing/payment:
  - `apps/web/app/api/billing/route.ts`
  - `apps/web/lib/payment-fulfillment.ts`
  - `apps/web/app/(app)/billing/page.tsx`
- UI entries/dialogs:
  - `apps/web/components/billing/billing-plan-dialog.tsx`
  - `apps/web/components/credits/buy-credits-dialog.tsx`
  - `apps/web/components/app-shell/sidebar.tsx`
  - `apps/web/app/(app)/credits/page.tsx`
  - `apps/web/app/(app)/ava/page.tsx`
- Verification:
  - `apps/web/e2e/billing-001-upgrade-plan.spec.ts`
  - `phases/phase-p14-credits-billing/sprints/sprint-04/evidence/F04.verify.log`
  - `phases/phase-p14-credits-billing/sprints/sprint-04/evidence/f04-validation-notes.md`

## 仍损坏或未验证
- Final harness verification is blocked by local Docker/Postgres instability, not by a TypeScript/design lint failure.
- Exact failing command: `pnpm harness verify --sprint p14/04 --feature F04`
- Harness passed Docker and migration, then failed Playwright. `F04.verify.log` shows missing UI because billing/register API calls started returning 500 after Postgres entered recovery.
- Postgres logs showed:
  - `server process ... was terminated by signal 13: Broken pipe`
  - `database system is in recovery mode`
  - repeated automatic recovery.
- I tried:
  - `docker compose -f infra/docker-compose.yml restart postgres`
  - `docker compose -f infra/docker-compose.yml down -v`
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pkill -f 'next dev'`
  - migrations after recovery
  The DB recovered temporarily, then flapped again during Playwright.

## 下一步最佳动作
- Continue F04 in this same worktree.
- First stabilize local DB/dev server:
  - `pkill -f 'next dev'`
  - wait for `docker compose -f infra/docker-compose.yml ps postgres` to show healthy
  - `pnpm --filter @repo/data run migrate`
- Then rerun:
  - `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts`
  - `pnpm harness verify --sprint p14/04 --feature F04`
- Do not manually mark F04 passing; let harness verify do it.
- Do not touch F03/F02 work or `active-features.json`.

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p14/04`
- 调试:
  - `pnpm --filter @repo/data run typecheck`
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts`
  - `docker compose -f infra/docker-compose.yml ps postgres`
  - `docker compose -f infra/docker-compose.yml logs --tail=120 postgres`
