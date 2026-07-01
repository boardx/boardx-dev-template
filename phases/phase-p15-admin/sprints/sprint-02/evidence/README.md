# Evidence — F03（团队管理：搜索/分页/编辑团队类型 + 手动上分）

## 运行环境说明
本 worktree 用 `scripts/init-worktree-env.sh` 分配的独立端口跑验证（同机多 agent 并行，
避免与其他 worktree 抢默认端口 5432/6379/3000）：

```bash
PG_PORT=60461 REDIS_PORT=60462 \
  docker compose -f infra/docker-compose.yml up -d

DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" \
  pnpm --filter @repo/data run migrate

DATABASE_URL="postgresql://boardx:boardx@localhost:60461/boardx" \
REDIS_URL="redis://localhost:60462" \
E2E_PORT=60463 \
  pnpm --filter @repo/web exec playwright test e2e/admin-002-manage-teams.spec.ts
```

注：`scripts/init-worktree-env.sh` 目前只把端口写进 `apps/web/.env.local`（DATABASE_URL/
REDIS_URL/E2E_PORT）供 Next dev/Playwright 用；`infra/docker-compose.yml` 读的是
`PG_PORT`/`REDIS_PORT` 这两个 compose 专用变量，脚本没有写这两个 key，需要手动从
`.env.local` 里的端口号显式传给 `docker compose up`（已在上面命令体现）。这是现有脚本的一个
小缺口，与本 feature 无关，未在本次改动，仅记录方便下一轮排查。

## 文件
- `f03-01-migrate.txt` — `pnpm --filter @repo/data run migrate` 输出（幂等，全部"已应用，跳过"，
  证明本 feature 未新增迁移——`teams.team_type` 与 `credit_wallets/credit_transactions` 均已由
  `015_team_general.sql`/p14 `016_credits.sql` 建好，F03 直接复用）。
- `f03-02-playwright-admin-002.txt` — 目标 verification 命令
  （`e2e/admin-002-manage-teams.spec.ts`）完整通过输出：6/6 passed。
- `f03-03-verify-base-tail.txt` — `pnpm -w run verify:base`（`init.sh` 的基础验证）通过输出尾部：
  45/45 tasks successful，证明本 feature 未引入新的基础失败。
- `f03-04-verify-full-attempt.txt` — `git push`（未加 `--no-verify` 那次）触发的 pre-push
  hook 完整输出：`verify:base` 通过 → `next build` 通过 → 全量 e2e 224 passed / 64 failed。
  失败明细见下方"push 用了 `--no-verify`"一节的根因分析。
- `f03-05-review-fixes-playwright.txt` — review 三处加固（幂等/审计/note 长度上限）落地后
  重跑 `e2e/admin-002-manage-teams.spec.ts`：8/8 passed（新增两条用例覆盖幂等重放与
  note 裁剪，见下方"review 加固"一节）。

## review 加固（PR #157 review 反馈，3 处 medium finding）
针对 `apps/web/app/api/admin/teams/[id]/credit/route.ts`（手动上分接口）：
1. **幂等**：客户端（`ManualCreditModal`）每次打开弹窗生成一个 `crypto.randomUUID()`，作为
   `Idempotency-Key` 请求头随提交一起发送；服务端把该 key 编码进流水的 `label`
   （`Admin grant · idem:<key>`），提交前先用 `findTransactionByLabel`（新增于
   `packages/data/src/credits.ts`）按 `wallet_id + label` 精确查重——命中则直接返回当前余额
   （响应体带 `idempotent: true`），不二次调用 `recordTransaction`。未加迁移/新列，靠
   label 字符串的 uuid 唯一性做查重键。新增 e2e：「手动上分带幂等 key：重复提交（同 key）
   不会重复入账」。
2. **审计**：`recordTransaction` 的 `description` 现在包含 `操作人 <email> (uid:<id>)`
   （来自 `requireSysAdmin()` 返回的 `gate.user`），把敏感财务操作的执行者写入流水，
   可追溯。已用 `docker exec ... psql` 直接查库确认落库格式正确（见下方验证记录）。
3. **note 长度上限**：服务端 `note.trim().slice(0, 200)`，客户端 `Input` 同步加
   `maxLength={200}` 与 `onChange` 裁剪，双重防线。新增 e2e：「手动上分 note 超长会被
   服务端裁剪到 200 字符」（500 字符输入，请求仍 200 而非因超长报错，验证接受路径不中断）。

验证记录（直接查库确认，超出 e2e 断言范围但作为额外证据）：
```
docker exec infra-postgres-1 psql -U boardx -d boardx -c \
  "SELECT label, description FROM credit_transactions WHERE label LIKE 'Admin grant%' ORDER BY id DESC LIMIT 5;"
-- 确认：同一 idem key 的两次提交只有一条对应流水；description 含"操作人 <email> (uid:<id>)"；
--       500 字符 note 落库后 description 中 note 部分长度精确为 200
  (SELECT length(regexp_replace(description, '^.*· ', '')) ...) => 200
```

## 覆盖范围与复用说明
- **门控**：复用 F01 的 `apps/web/lib/admin.ts` → `requireSysAdmin()`，未新建平行门控逻辑。
  `apps/web/app/(app)/admin/teams/page.tsx` 从 F01 的占位页（`ComingSoon`）替换为真实页面；
  `admin-home.tsx` 的团队管理模块卡片 `available` 由 `false` 改 `true`（不再带"即将上线"徽章）。
- **数据**：`packages/data/src/teams.ts` 新增 `listAdminTeams`（名称搜索 + 分页 + 成员数/Credit
  聚合）与 `updateTeamType`；两者都是纯读/写既有表（`teams`/`team_members`/`credit_wallets`），
  未加迁移。
- **手动上分**：`apps/web/app/api/admin/teams/[id]/credit/route.ts` 直接复用 p14 的
  `getOrCreateTeamWallet` + `recordTransaction`（`packages/data/src/credits.ts`），与 F02
  用户手动上分应共用同一套仓储函数，未写平行的积分变更路径。
- **API**：
  - `GET /api/admin/teams?q=&page=&pageSize=` — 分页/搜索列表。
  - `PATCH /api/admin/teams/:id { teamType }` — 更新团队类型（`standard`|`enterprise`，非法值 400）。
  - `POST /api/admin/teams/:id/credit { amount, note }` — 手动增加 Credit（`amount<=0` 拒绝 400）。
  三者均走 `requireSysAdmin()`：未登录 401，非 SysAdmin 403。
- **随附小改动（非新范围，只是让 F01 的现有 e2e 断言跟上真实行为）**：
  `e2e/admin-005-view-admin-home.spec.ts` 里"团队管理模块导航"相关断言从"点进占位子页 + 带
  即将上线徽章"改为"点进真实 `/admin/teams` + 不带徽章"；未改该文件的其它断言（AI Store
  两个模块仍带徽章，因为 F04/F05 未建）。
- **不属于 F03 范围、未做**：F02 用户管理、F04/F05 AI Store 审核/精选；团队改名/删除/成员管理
  （已有 `uc-team-007`/team 自身设置覆盖，不在后台管理范围内）。

## 集成说明（供 coordinator 参考）
本 worktree 起始基线（`origin/harness/coord-wave3-remaining` 合并后）不含 F01 的实际代码
（`requireSysAdmin`/`admin/teams` 占位页等）——F01 真正落地在 `origin/harness/coord-dispatch-
wave2-admin-payment`（PR #145 已合并到该中间分支，但该分支尚未合并进 `main`）。为了复用 F01
的门控（而不是重新造一个），本会话额外执行了：

```bash
git merge origin/harness/coord-dispatch-wave2-admin-payment --no-edit
```

只产生一处冲突（`packages/data/src/index.ts` 的 barrel export 列表，双方都在追加新增导出行，
已两边合并保留）。这把 F01（admin 门控/首页）与 p14 F05（payment engine，属另一 owner
`wrk-payment-1`）的代码一并带入本分支——这些不是本 feature 的产出，PR diff 里请按文件归属区分。
建议 coordinator 尽快把 `harness/coord-dispatch-wave2-admin-payment` 合并进 `main`，避免后续
worker 重复踩到同样的"依赖分支未上主干"问题。

## push 用了 `--no-verify`（原因记录，供 review 核实）
`pnpm -w run verify:full`（pre-push hook）本地跑了一次全量 e2e（288 个用例，14.2 分钟），
结果 224 passed / 64 failed。**逐一核对后，64 个失败全部与本 feature 无关**：
- 目标 verification（`admin-002-manage-teams.spec.ts`，6/6）与所有既有 admin 相关 e2e
  （`admin-001`、`admin-005`，共 10/10）**全部通过**，见 `f03-02-playwright-admin-002.txt`。
- 64 个失败集中在 `board-*`/`canvas-*`/`room-*`/`team-invite-join`/`team-manage`/
  `team-007-general-settings`/`widget-*`/`collab-001` 等与团队管理无关的模块，且清一色是
  `apiRequestContext.post: connect ECONNREFUSED ::1:3000`。
- 根因定位：这些失败 spec 里手写了 `playwright.request.newContext({ baseURL:
  "http://localhost:3000" })`（例如 `team-manage.spec.ts:6`、`team-invite-join.spec.ts:6`、
  `board-create.spec.ts:6`），绕过了 `playwright.config.ts` 里读 `E2E_PORT` 的
  `baseURL` 配置，硬编码 3000。本 worktree 用 `scripts/init-worktree-env.sh` 分配的
  `E2E_PORT=60463`（避免和其他并行 worktree 抢 3000），这些 spec 因此连不上真实跑在
  60463 的 server → `ECONNREFUSED ::1:3000`（3000 端口在本 worktree 压根没有监听）。
  用 `grep -rl 'baseURL: "http://localhost:3000"' apps/web/e2e/` 可数出 33 个文件有此写法，
  全部是本会话之前就存在的代码（最早见于 `634f75d`，P5 F01），本次 diff 未新增/修改任何一个。
- 单独隔离重跑 `team-manage.spec.ts`/`team-invite-join.spec.ts`/`board-create.spec.ts`
  三个失败 spec（环境变量确认正确导出）复现同样的 `ECONNREFUSED ::1:3000`，且失败位置精确
  落在这几个文件里手写 `newContext` 的那一行，进一步确认是"硬编码端口 + 非默认 E2E_PORT
  worktree"的组合问题，不是本次代码改动引入的回归。
- 结论：符合"genuinely blocked by shared-machine port/resource contention, unrelated to
  your change"的 `--no-verify` 使用条件。已如实记录，未隐瞒或粉饰失败。
- 建议后续单独开一个 feature/task 修这 33 个 spec，把 `playwright.request.newContext({baseURL})`
  统一改成读 `test.use`/config 的 `baseURL`（或干脆用共享的 `page.request`），使 e2e 套件在
  非默认 `E2E_PORT` 的并行 worktree 下也能全量跑通——这对现有并行开发流程是个通用性修复，
  不应该绑在 F03 里做（范围纪律）。
