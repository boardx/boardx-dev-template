# 会话交接 — Sprint p14/04

## 当前已验证

### F04（升级/管理个人计划，owner wrk-codex-billing-1）
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

### F02（购买积分，owner wrk-payment-1）
- F02（购买积分，owner wrk-payment-1）：实现完成，本地跑通 feature_list.json 指定的全部
  verification 命令：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`（无新增迁移，复用 F01 的 credit_wallets/
    credit_transactions + F05 的 payment_orders）
  - `pnpm --filter @repo/web exec playwright test e2e/credits-002-purchase-credits.spec.ts`
    — **8/8 passed**（干净单次运行，见 `evidence/f02-e2e-pass.txt`）
  - 额外跑了 F01/F05 回归（`credits-001-view-wallet.spec.ts` + `billing-002-scan-payment.spec.ts`）
    21/21 通过，确认未破坏并行/既有 feature。
  - `pnpm -w run verify:base` → 45/45 成功（`evidence/f02-verify-base.txt`）。
  - **未跑 `verify:full`**（协调者已确认的轻量门控策略，见 progress.md 说明）。
  - 状态仍是 `blocked`→ 待 coordinator 跑 `pnpm harness verify --sprint p14/04` 门控（未自行改
    `passing`）。

## 本轮改动
- 新增 `apps/web/app/api/payment/catalog/route.ts`：`GET /api/payment/catalog?kind=credit_purchase`，
  Buy Credits 弹窗套餐列表来源（复用 F05 的 payment-catalog.ts 只读目录）。
- 修改 `apps/web/lib/payment-fulfillment.ts`：把 F05 留的 `fulfillCreditPurchase` TODO 换成
  真实实现——按订单 `team_id` 决定记团队还是个人钱包（复用 F01 的 `recordTransaction`），
  `findTransactionByLabel` + `idem:<orderId>` label 做幂等查重（DB 层
  `payment_orders.status='pending'` WHERE 短路是第一层防线，本函数是第二层，双保险防双花，
  呼应 admin #173 教训）。
- 修改 `apps/web/app/api/payment/orders/route.ts`（安全加固，属于 F02 的"权限与可见性"验收
  范围）：原实现 `teamId` 由客户端直接传数字 id，未做归属校验；改为客户端只传布尔意图
  `scope: "team"`，服务端按 `CURRENT_TEAM_COOKIE` + `getMembership` + `canManageTeam` 校验，
  非 owner/admin 一律回退 `teamId=null`（个人订单）。**这是对 F05 既有接口的安全修复，不是
  新增字段——原 `teamId` 参数已废弃且不再被采纳**，需要留意如果有其他调用方直接传
  `teamId` 数字，行为会变成"忽略该字段、按 scope+cookie 重新解析"。
- 新增 `apps/web/components/credits/buy-credits-dialog.tsx`：Buy Credits 弹窗组件
  （套餐列表 → 支付方式（WeChat Pay 可选/Alipay 置灰）→ Generate QR Code 下单 → 二维码 +
  订单号 + 轮询/Refresh Status → 成功/失败态 → 最近购买记录），走 F05 的
  `POST /api/payment/orders` + `GET /api/payment/orders/:id` + webhook 全链路。
- 修改 `apps/web/app/(app)/credits/page.tsx`：既有 "Buy credits" 按钮接入弹窗（scope 随页面
  已解析的 team/personal），购买成功后触发余额+流水刷新（`refreshTick` 状态）。
- 修改 `apps/web/components/app-shell/sidebar.tsx`：用户菜单新增 "Buy Credit" 入口
  （`data-testid="user-menu-buy-credits"`，scope 固定 personal），购买成功后刷新用户菜单
  余额显示。
- 新增 e2e `apps/web/e2e/credits-002-purchase-credits.spec.ts`（8 用例）：套餐 UI、下单+
  二维码、stub webhook 回调成功加余额、回调幂等防双花、客户端自定义金额/套餐不被采纳、
  取消/关闭不改变余额、团队购买记团队钱包、team member 越权回退个人订单、未登录 401。

## 仍损坏或未验证
- 无已知代码损坏。一次性 flaky（`credits-001-view-wallet.spec.ts` 在与其他 spec 并发跑的
  首次尝试中超时；单独/完整重跑均全绿）判定为共享机器 docker 资源争抢，详见
  `evidence/f02-notes.md`，与本次改动无关。
- F04（升级/管理个人计划）**未做**（依赖 F05，已就绪，但不在本次范围内，按任务说明不顺手
  做）：owner 仍是 null，status 仍是 blocked，下一个 agent 可以直接领取。
- 下单接口限流：F05 遗留的已知未做项，本次未新增处理（非 F02 verification 要求）。

## 下一步最佳动作
- coordinator：复核本轮证据（`evidence/f02-*`），确认后跑
  `pnpm harness verify --sprint p14/04`，把 F02 门控为 passing。
- 后续 agent 接 F04（订阅升级）时：复用 F02 交付的 `POST /api/payment/orders`（sku 换成
  `plan_pro_monthly`，见 `apps/web/lib/payment-catalog.ts`）+ 实现
  `apps/web/lib/payment-fulfillment.ts` 里的 `fulfillPlanUpgrade` TODO（当前仍是 F05 原始
  stub，未改动）。弹窗 UI 可参考 `buy-credits-dialog.tsx` 的结构（套餐/计划列表 + 支付方式 +
  二维码 + 轮询），但 F04 是订阅计划对比（Free/Pro 权益），UI 内容不同，建议新建组件而不是
  改 `buy-credits-dialog.tsx`（避免两个 feature 耦合在同一个弹窗组件里）。
- 不要动：`packages/data/migrations/`（本次无新增迁移，复用 F01 016_credits.sql / F05
  017_payment_orders.sql）、`apps/web/app/api/payment/webhook/route.ts`（F05 的 webhook
  鉴权/幂等核心逻辑，本次未改动，仅新增了它调用的 fulfillOrder 的具体实现）。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p14/04`
- 调试:
  ```bash
  docker compose --env-file .env -f infra/docker-compose.yml up -d
  export $(grep -E "^(DATABASE_URL|REDIS_URL|E2E_PORT)=" .env | xargs)
  pnpm --filter @repo/data run migrate
  pnpm --filter @repo/web exec playwright test e2e/credits-002-purchase-credits.spec.ts
  ```

## 独立复验追记（2026-07-02，evidence/p14-f02-buy-credits）
- PR #191 已合并 main，但独立 feature-evaluator 复审判定 "Revise"（12/16）：代码本身满分
  （正确性/可靠性/可维护性均 2/2），唯一扣分点是没有一份在干净/隔离环境下真实跑出、并随
  分支落盘到本仓库的 verification 证据日志（"没有证据 = 没有完成"）。
- 本轮在全新 worktree（从 `origin/main` 重新 `git fetch` + `checkout -b`，独立 docker 端口
  pg:58492/redis:58493/minio:58495/web:58494，`corepack pnpm@9.0.0 install`，非裸
  `pnpm install`）里，重新执行了 feature_list.json 声明的 F02 全部三条 verification 命令：
  `docker compose up -d` → `pnpm --filter @repo/data run migrate` → `pnpm --filter @repo/web
  exec playwright test e2e/credits-002-purchase-credits.spec.ts`，最终 **8/8 passed，退出码
  0**。完整输出已落盘 `evidence/F02.verify.log`（含日期/分支/HEAD/端口头信息）。
- 本轮只提交证据 + progress.md/session-handoff.md 文档更新，**未**触碰
  `feature_list.json`（status/owner/evidence 字段）、**未**执行 `pnpm harness claim`
  或 `pnpm harness verify`、**未**合并任何 PR——按约定这些操作留给 coordinator。
