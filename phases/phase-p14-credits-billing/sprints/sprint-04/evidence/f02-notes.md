# F02 购买积分 — 验证证据说明

## 命令与结果（按 feature_list.json 的 verification）

```
docker compose -f infra/docker-compose.yml up -d   # 本机用 --env-file .env（worktree 隔离端口）
pnpm --filter @repo/data run migrate               # 通过，复用既有表，无新增迁移
pnpm --filter @repo/web exec playwright test e2e/credits-002-purchase-credits.spec.ts
```

`f02-e2e-pass.txt`：8/8 通过（干净单次运行，本 feature 新增 spec）。
`f02-verify-base.txt`：`pnpm -w run verify:base` 45/45 成功。
`f02-regression-f01-f05.txt`：F01（credits-001）9 用例 + F05（billing-002）12 用例，
共 21/21 通过 —— 确认本次改动未影响既有钱包查看 / 支付引擎行为。

## 环境说明（worktree 隔离端口）
本 worktree 由 `scripts/init-worktree-env.sh` 分配独占端口（postgres 62051 / redis 62052 /
web-e2e 62053），docker compose 需要显式 `--env-file .env`，migrate 需要显式 export
`DATABASE_URL`/`REDIS_URL`（与 F01/F03 worktree 记录一致）。首次跑 `docker compose up -d`
遇到 `could not find an available, non-overlapping IPv4 address pool`（本机同时有多个
worktree/worker 各自的 docker network），`docker network prune -f` 清理未使用网络后恢复正常。

## 已知问题：共享机器资源争抢导致一次性 flaky 失败（非本 feature 代码问题）
第一次跑 F01+F05 回归套件（21 用例）时，`credits-001-view-wallet.spec.ts` 的首个用例因
`wallet-summary` 10s 内未出现而超时失败；单独重跑该文件 9/9 全绿，随后重跑完整 21 用例回归
套件也全绿（`f02-regression-f01-f05.txt` 即为该次干净记录）。与 F03 sprint-04 evidence 中
记录的同类现象一致（本机同时段有大量并行 worktree/agent 争抢 docker 资源），判定为环境抖动，
非本次改动引入的回归。

## 本次改动摘要
- 新增 `GET /api/payment/catalog?kind=credit_purchase`（apps/web/app/api/payment/catalog/route.ts）：
  Buy Credits 弹窗套餐列表来源，只读服务端目录（复用 F05 的 payment-catalog.ts），过滤掉
  F04 的 plan_upgrade 类目。
- 实现 `apps/web/lib/payment-fulfillment.ts` 里 F05 留的 `fulfillCreditPurchase` TODO：
  按订单 `team_id` 是否有值决定记入团队钱包还是下单用户个人钱包，复用 F01 的
  `recordTransaction`；用 `findTransactionByLabel` + `idem:<orderId>` 标签做第二层幂等
  防线（DB 层 `payment_orders.status='pending'` WHERE 短路是第一层，见 F05 的
  `markPaymentOrderPaid`）——同一订单回调两次只加一次余额，e2e 显式覆盖（呼应 admin
  #173 双花教训）。
- 安全加固 `apps/web/app/api/payment/orders/route.ts`：原实现的 `teamId` 是客户端直接传的
  数字 id，未做归属校验——任何登录用户理论上可以把别的团队 id 塞进请求体，让自己的购买记入
  一个自己无权限管理的团队钱包。改为客户端只传布尔意图 `scope: "team"`，服务端按当前团队
  cookie（`CURRENT_TEAM_COOKIE`，与 `/api/credits/wallet` 同一套解析方式）+
  `getMembership` + `canManageTeam` 校验角色，非 owner/admin 一律回退 `teamId=null`
  （个人订单）。e2e 显式覆盖 team member 越权尝试团队购买 → 回退个人订单。
- 新增 `apps/web/components/credits/buy-credits-dialog.tsx`：Buy Credits 弹窗（套餐列表 →
  选支付方式（WeChat Pay 可选，Alipay 置灰不可用，对齐 uc-credits-002 主流程步骤 5）→
  Generate QR Code 下单 → 展示二维码 + 订单号 + Refresh Status 轮询 → 成功/失败态 →
  最近购买记录）。
- 接入两个入口：`apps/web/app/(app)/credits/page.tsx` 的既有 "Buy credits" 按钮（团队管理
  角色在 Team Credits 页购买，scope 随页面已解析的 team/personal 联动）+
  `apps/web/components/app-shell/sidebar.tsx` 用户菜单新增 "Buy Credit" 入口（scope 固定
  personal，对应 uc-credits-002 前端入口 1）。两处购买成功后都会触发余额/流水刷新。
- 新增 e2e `apps/web/e2e/credits-002-purchase-credits.spec.ts`（8 用例）：套餐列表 UI、
  下单 + 二维码展示、stub webhook 回调成功加余额、回调幂等防双花、金额/套餐服务端定义
  （客户端自定义字段不采纳）、取消/关闭不改变余额、团队购买记团队钱包、team member 越权
  回退个人订单、下单相关接口未登录 401。

## 不在本次范围（明确未做）
- F04（升级/管理个人计划）：订阅弹窗、credits 模式路由——按任务要求不顺手做，只在
  `payment-fulfillment.ts` 里保留 F05 原有的 `fulfillPlanUpgrade` TODO 不动。
- 真实支付网关对接：延续 F05 的 stub 网关约定，webhook 仍由 e2e/人工直接 POST 模拟
  （带 `WEBHOOK_SECRET` 共享密钥）。
- 下单接口限流：F05 遗留的未做项，本次未新增范围要求，未处理。
