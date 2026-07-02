# 进度日志 — Sprint p14/04

## 当前已验证状态(唯一真相)
- 仓库根目录: /Users/shenyanbin/Downloads/harnessdemo4/boardx-dev-template/.claude/worktrees/agent-a0db025691ef5a7f4
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 待 coordinator 跑 `pnpm harness verify --sprint p14/04` 门控 passing；F04（升级计划）仍 blocked（依赖 F05，已就绪但未领取）
- 当前 blocker: 无（F02 本轮验证已全部通过，等门控转移状态）

## 会话记录
### 2026-07-01 19:03:15
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-02（wrk-payment-1，F02 购买积分）
- 本轮目标：实现 F02「购买积分（Buy Credits 弹窗 + 套餐 + 扫码下单）」，走 F05 支付引擎，
  e2e 用 stub 支付回调走通「下单→回调→余额增加」全链路。
- 已完成：
  - 新增 `GET /api/payment/catalog?kind=credit_purchase`（套餐列表只读来源）。
  - 实现 `apps/web/lib/payment-fulfillment.ts` 的 `fulfillCreditPurchase`（F05 留的 TODO）：
    按订单 team_id 决定记入团队/个人钱包，`findTransactionByLabel` + `idem:<orderId>` 做
    第二层幂等防线（第一层是 F05 既有的 DB `WHERE status='pending'`）。
  - 安全加固 `POST /api/payment/orders`：teamId 不再由客户端直接传数字 id，改为服务端按
    当前团队 cookie + `getMembership`/`canManageTeam` 校验角色，无权限一律回退个人订单。
  - 新增 `apps/web/components/credits/buy-credits-dialog.tsx`（Buy Credits 弹窗：套餐列表 +
    支付方式（WeChat Pay/Alipay 置灰）+ 生成二维码 + 轮询 + Refresh Status + 成功/失败态 +
    最近购买记录）。
  - 接入两个入口：`/credits` 页面既有 "Buy credits" 按钮、用户菜单新增 "Buy Credit" 入口
    （sidebar.tsx）。
  - 新增 e2e `credits-002-purchase-credits.spec.ts`（8 用例，含幂等防双花、金额套餐服务端
    定义、team 越权回退个人订单）。
- 运行过的验证：
  - `docker compose --env-file .env -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`（无新增迁移，复用 F01/F05 既有表）
  - `pnpm --filter @repo/web exec playwright test e2e/credits-002-purchase-credits.spec.ts` → 8/8
  - `pnpm --filter @repo/web exec playwright test e2e/credits-001-view-wallet.spec.ts e2e/billing-002-scan-payment.spec.ts` → 21/21（F01/F05 回归无影响）
  - `pnpm --filter @repo/web run lint` → design lint 全部通过
  - `pnpm --filter @repo/web exec tsc --noEmit -p .` → 通过
  - `pnpm -w run verify:base` → 45/45 成功
- 已记录证据：`phases/phase-p14-credits-billing/sprints/sprint-04/evidence/f02-e2e-pass.txt`、
  `f02-verify-base.txt`、`f02-regression-f01-f05.txt`、`f02-notes.md`。
- 提交记录：见分支 `worker/wrk-payment-1-p14-f02-buy-credits` 的 PR（Closes #131）。
- 已知风险或未解决问题：
  - 首次跑 F01+F05 回归套件时 `credits-001-view-wallet.spec.ts` 出现一次性 flaky 超时
    （共享机器 docker 资源争抢，与 F03 evidence 记录的同类现象一致），单独重跑与完整重跑
    均 9/9、21/21 全绿，判定非本次改动引入的回归，详见 `f02-notes.md`。
  - 本次范围内**未**跑 `verify:full`（协调者已确认的轻量门控策略），理由：多 worktree 并行
    时 `verify:full` 的全量 e2e（~266 条）在共享机器上高度 flaky，本 feature 已用 targeted
    spec + F01/F05 回归 + verify:base 的组合提供端到端证据。
- 下一步最佳动作：
  - coordinator：复核证据后跑 `pnpm harness verify --sprint p14/04`，把 F02 门控为 passing。
  - F04（升级/管理个人计划）依赖已就绪（F05 passing，F02 本轮交付了可复用的
    payment-catalog/orders/webhook/fulfillment 全链路），后续 agent 接 F04 时复用同一套
    `POST /api/payment/orders`（sku 换成 `plan_pro_monthly`）+ 实现
    `payment-fulfillment.ts` 里的 `fulfillPlanUpgrade` TODO 即可，不要碰 F02 已交付的
    `fulfillCreditPurchase`/`buy-credits-dialog.tsx`。
  - 不要动：`packages/data/migrations/017_payment_orders.sql`、`016_credits.sql`（F05/F01
    的既有表结构，本次未新增迁移）。

### 2026-07-02（evidence/p14-f02-buy-credits，独立复验）
- 背景：PR #191（`worker/wrk-payment-1-p14-f02-buy-credits`）已合并入 main。独立
  feature-evaluator 复审代码给出 "Revise"（12/16）——不是代码问题（正确性/可靠性/可维护性
  均 2/2 满分，含服务端 teamId 绑定安全修复），而是 `phases/phase-p14-credits-billing/
  feature_list.json` 中 F02 的 `verification` 命令从未在一次干净会话里被完整跑出证据并落盘
  到本目录当前分支（此前 progress.md/session-handoff.md 记录的证据文件是在原 worker 分支/
  会话中产生，未随 PR 一起在独立可复现环境下重新核验）。本轮任务：在全新 worktree、隔离
  docker 端口、从 `origin/main` 全新签出的分支上，重新、真实地跑一遍 feature_list.json 声明
  的 F02 verification 命令，落盘证据。
- 已完成：
  - `git fetch origin && git checkout -b evidence/p14-f02-buy-credits origin/main`（HEAD f04a15f）。
  - `bash scripts/init-worktree-env.sh` 分配隔离端口（pg:58492 redis:58493 minio:58495
    web:58494，project name `evidence-p14-f02-buy-credits`）。
  - `docker compose -f infra/docker-compose.yml up -d` → postgres/redis/minio healthy。
  - `corepack pnpm@9.0.0 install`（未用裸 `pnpm install`，避免降级 lockfile 影响其它并行
    worktree）。
  - `pnpm --filter @repo/data run migrate` → 全部迁移成功应用（含 016_credits.sql /
    017_payment_orders.sql）。
  - `pnpm --filter @repo/web exec playwright test e2e/credits-002-purchase-credits.spec.ts`
    —— 首次串行跑遇到 1 个偶发超时（测试 4「取消/关闭弹窗」，冷启动/首次编译预热阶段的
    时序 flake，见 evidence 文件备注）；单独重跑该用例通过，随后完整重跑两次均 **8/8
    passed，退出码 0**，判定原失败非真实回归。
- 已记录证据：`phases/phase-p14-credits-billing/sprints/sprint-04/evidence/F02.verify.log`
  （新落盘，本轮独立复验的完整通过日志，含日期/分支/HEAD/隔离端口头信息，格式对齐
  `phases/phase-p10-knowledge-base/sprints/sprint-03/evidence/F03.verify.log`）。
- 提交记录：本轮仅提交文档/证据（`F02.verify.log` + 本 progress.md + session-handoff.md
  更新），不改应用代码，不改 `feature_list.json`，PR 分支 `evidence/p14-f02-buy-credits`。
- 已知风险或未解决问题：无新增。F04 仍 blocked/owner null，未在本轮范围内处理。
- 下一步最佳动作：coordinator 核对本轮 `F02.verify.log` 后，按正常流程跑
  `pnpm harness claim` + `pnpm harness verify --sprint p14/04` 把 F02 转 passing（本 agent
  未自行执行 claim/verify，也未手改 feature_list.json 的 status/owner/evidence 字段）。
