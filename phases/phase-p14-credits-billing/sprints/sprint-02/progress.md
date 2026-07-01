# 进度日志 — Sprint p14/02

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F05（扫码支付引擎）— 实现完成，本地全绿，待 PR review + `pnpm harness verify` 门控转 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-01 09:25:47
- 本轮目标: F05 扫码支付引擎（CAP-PAYMENT 地基）— payment_orders 表 + 下单/二维码/轮询/webhook 回调 + 幂等发放钩子
- 已完成:
  - 迁移 `packages/data/migrations/016_payment_orders.sql`：新建 `payment_orders` 表（独立于 F01 的 credit_wallets/credit_transactions，未触碰其表/文件）
  - 仓储 `packages/data/src/payment.ts`：createPaymentOrder / getPaymentOrder / markPaymentOrderPaid（幂等：`WHERE status='pending'` 数据库层去重）/ markPaymentOrderFailed，已在 `packages/data/src/index.ts` 导出
  - API：
    - `POST /api/payment/orders`（`apps/web/app/api/payment/orders/route.ts`）— 下单 + 生成二维码（`apps/web/lib/qr.ts`，确定性 SVG 网格，无三方依赖）
    - `GET /api/payment/orders/:id`（`apps/web/app/api/payment/orders/[id]/route.ts`）— 轮询订单状态，越权返回 404
    - `POST /api/payment/webhook`（`apps/web/app/api/payment/webhook/route.ts`）— stub 支付网关回调，支持 payment.succeeded/payment.failed，成功时幂等调用发放钩子
  - 发放钩子 `apps/web/lib/payment-fulfillment.ts`：按 fulfillment_kind 分发到 credit_purchase / plan_upgrade 的 stub 实现（TODO 标记留给 F02/F04 接入真实发放逻辑）
  - 最小测试台 UI `apps/web/app/(app)/payment-test/page.tsx`：下单 → 展示二维码 → 轮询 → 展示 paid/failed 结果，非 F02/F04 最终 UI
  - e2e `apps/web/e2e/billing-002-scan-payment.spec.ts`：8 个用例覆盖下单/轮询/回调成功/回调幂等/回调失败/未登录 401/未登录跳登录/UI 全链路
  - `apps/web/playwright.config.ts` 小改动：端口从硬编码 3000 改为可用 `E2E_PORT` 覆盖（默认仍 3000，向后兼容）——本机多 agent 并行时端口 3000 常被其它 worktree 的 dev server 占用，加这个开关只影响本地临时调试，不改变默认行为
- 运行过的验证（均通过，退出码 0）:
  - `docker compose -f infra/docker-compose.yml -p paymentf05 up -d`（PG_PORT=15901 REDIS_PORT=16901，因宿主机被其它并行 agent 的默认端口/容器名占用，临时用独立 compose project name + 端口，验证完已 `down` 清理）
  - `pnpm --filter @repo/data run migrate` — 016_payment_orders.sql 应用成功
  - `pnpm --filter @repo/web exec playwright test e2e/billing-002-scan-payment.spec.ts` — 8/8 passed
  - `pnpm -w run verify:base` — 37/37 tasks successful（含 @repo/web:typecheck、@repo/web:lint 设计规范检查全过）
  - 交叉回归：`credits-001-view-wallet.spec.ts`（F01）+ `billing-001-upgrade-plan.spec.ts`（F04）8/8 passed，确认未破坏并行 agent 的既有 feature
- 已记录证据: `phases/phase-p14-credits-billing/sprints/sprint-02/evidence/f05-verification.txt`（migrate + playwright 完整输出）
- 提交记录: 分支 `worker/wrk-payment-1-p14-f05-payment-engine`（本会话内提交，见 PR）
- 已知风险或未解决问题:
  - 本机（多 agent 共享）postgres/redis 默认端口经常被其它并行 worktree 占用；验证时需自行选空闲端口 + 独立 compose project name，CI 环境应无此问题（用官方默认端口即可）
  - 二维码是确定性 SVG 占位图案（非真实 QR 编码协议），验收点是"可扫码支付区域可见 + 订单号 + 轮询"，符合 F05 notes 里 stub 网关的约定；真实二维码协议/网关接入留给后续按需替换 `apps/web/lib/qr.ts`
  - fulfillOrder（`apps/web/lib/payment-fulfillment.ts`）里 credit_purchase / plan_upgrade 都是 stub（打日志/返回描述，不写 DB），真正写 credit_wallets / 用户计划表留给 F02 / F04 各自实现替换 TODO
- 下一步最佳动作: coordinator review 通过后跑 `pnpm harness verify --sprint p14/02` 门控 F05 → passing；随后可解锁 F02（buy credits）/ F04（upgrade plan）调用本 feature 的下单/webhook 能力
