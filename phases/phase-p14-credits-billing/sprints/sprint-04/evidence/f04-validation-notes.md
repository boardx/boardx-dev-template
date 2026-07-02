# F04 validation notes — billing upgrade plan

Worker: `wrk-codex-billing-1`
Worktree: `/private/tmp/boardx-worktrees/issue-133-billing-upgrade-plan`

## Implemented

- Added persistent personal plan state via `users.plan_id` migration and `@repo/data` repository helpers.
- Wired `plan_upgrade` payment fulfillment to update the user's plan to `pro` after a paid order.
- Replaced billing stub payload with real current-plan data, plan SKU, and credit pack catalog data.
- Added plan dialog entry from the user menu.
- Added subscription mode with Free/Pro comparison, Upgrade to Pro order creation, QR display, order polling, and Manage Subscription affordance.
- Added credits mode routing into a Buy Credits dialog that uses the existing payment order API with credit-pack SKUs.
- Added Buy Credits entry on `/credits`.
- Added AVA low-credit prompt entry into the same plan dialog.
- Extended `apps/web/e2e/billing-001-upgrade-plan.spec.ts` to cover page display, plan upgrade fulfillment, user-menu dialog, credits-mode purchase flow, AVA prompt, close-without-change, and unauthenticated API/page behavior.

## Commands run

- `pnpm --filter @repo/data run typecheck` — passed.
- `pnpm --filter @repo/web run typecheck` — passed.
- `pnpm --filter @repo/web run lint` — passed (`design lint: 全部通过`).
- `docker compose -f infra/docker-compose.yml up -d` — passed after escalation for Docker daemon access.
- `pnpm --filter @repo/data run migrate` — passed after escalation for `tsx` IPC sandbox issue; `018_user_plan.sql` applied.
- `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts` — passed once with `7 passed (1.0m)` before the local Postgres service began flapping.
- `pnpm harness verify --sprint p14/04 --feature F04` — did not pass; evidence written to `F04.verify.log`.

## Current blocker

The local Docker Postgres service for this isolated worktree repeatedly entered recovery during Playwright/Next DB access:

- Next/Playwright output included `Error: Connection terminated unexpectedly` from `@repo/data` queries.
- Postgres logs showed backend termination and recovery, including `server process ... was terminated by signal 13: Broken pipe`, `database system is in recovery mode`, and automatic recovery loops.
- Recreated the isolated compose services with `docker compose -f infra/docker-compose.yml down -v` followed by `up -d`; migration then passed, but a later Playwright run again triggered the same Postgres connection termination after the first test.

This is recorded as an external/local verification environment blocker. F04 remains `in_progress`; no manual `passing` status was set.
