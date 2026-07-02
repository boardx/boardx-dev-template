# 会话交接 — Sprint p14/03

## 当前已验证
- F03 积分流水查看已由 `pnpm harness verify --sprint p14/03 --feature F03` 门控为 `passing`。
- 验证链路包含：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/credits-003-view-credit-records.spec.ts`
  - `pnpm -w run verify:base`

## 本轮改动
- `/credits` 页面增加团队交易记录表、分页与空态。
- 用户菜单增加 Credit Records 弹窗入口，弹窗展示个人余额与交易记录。
- 新增 `GET /api/credits/transactions`，按 personal/team scope 做权限过滤与分页。
- data 层补充交易分页查询。
- 新增 `apps/web/e2e/credits-003-view-credit-records.spec.ts` 覆盖个人弹窗、团队记录与越权隔离。
- 新建 p14/03 sprint 文件，并由 harness 将 F03 置为 `passing`。

## 仍损坏或未验证
- 无 F03 已知未验证项。
- 本 worktree 的 `node_modules` 是本地运行产物，禁止提交。

## 下一步最佳动作
- 提交并推送 `codex/issue-132-credits-f03-isolated`，打开 draft PR，随后把 GitHub issue #132 推到 `status:in-review`。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p14/03 --feature F03`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/credits-003-view-credit-records.spec.ts`
