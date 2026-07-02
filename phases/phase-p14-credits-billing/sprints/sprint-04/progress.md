# 进度日志 — Sprint p14/04

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-worktrees/issue-133-billing-upgrade-plan`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F04 / 升级/管理个人计划（订阅弹窗 + credits 模式路由 + 额度不足触发）
- 当前 blocker: 本地 Docker Postgres 在 Playwright/Next DB 访问期间反复进入 recovery mode，阻塞最终 `pnpm harness verify --sprint p14/04 --feature F04`。

## 会话记录
### 2026-07-01 19:03:15
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-02 18:05:00
- 本轮目标: 实现 F04 billing upgrade-plan flow（个人计划弹窗、subscription/credits 模式路由、额度不足入口、支付成功升级计划）。
- 已完成:
  - 新增 `users.plan_id` migration 和 data 仓储读写；`plan_upgrade` fulfillment 支付成功后把用户升级为 `pro`。
  - `/api/billing` 返回真实 current plan、plan SKU、credit pack catalog。
  - `/billing` 页面升级 CTA 创建 payment order、展示 QR、轮询 paid 后刷新当前计划。
  - 新增 `BillingPlanDialog` 与 `BuyCreditsDialog`；用户菜单、`/credits` Buy credits、AVA 低额度提示均接入。
  - 扩展 F04 Playwright spec 覆盖升级成功、菜单弹窗、credits 模式、AVA 入口、关闭不改计划。
- 运行过的验证:
  - `pnpm --filter @repo/data run typecheck` ✅
  - `pnpm --filter @repo/web run typecheck` ✅
  - `pnpm --filter @repo/web run lint` ✅
  - `docker compose -f infra/docker-compose.yml up -d` ✅
  - `pnpm --filter @repo/data run migrate` ✅
  - `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts` 曾通过一次（`7 passed (1.0m)`）；后续本地 Postgres recovery flapping 导致失败。
  - `pnpm harness verify --sprint p14/04 --feature F04` ❌，失败点为 Playwright 阶段 DB 连接中断；详见 `evidence/F04.verify.log`。
- 已记录证据:
  - `phases/phase-p14-credits-billing/sprints/sprint-04/evidence/F04.verify.log`
  - `phases/phase-p14-credits-billing/sprints/sprint-04/evidence/f04-validation-notes.md`
- 提交记录: 待提交。
- 已知风险或未解决问题: 本地 Docker Postgres 日志反复出现 `server process ... was terminated by signal 13: Broken pipe`、`database system is in recovery mode`，即使 `down -v` 重建后仍在 Playwright 访问中复现；F04 不能由 harness 推进 passing。
- 下一步最佳动作: 在稳定 Docker/Postgres 环境中先 `pkill -f 'next dev'` 清理 stale dev server，再跑 `pnpm harness verify --sprint p14/04 --feature F04`；通过后由 harness 自动写 passing/evidence。
