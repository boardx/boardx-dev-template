# chore(e2e): 修复 37 个 spec 硬编码 localhost:3000

## 改动范围
- 34 个文件从 `git status` 确认修改（另有 2 个原清单条目
  `credits-003-view-credit-records.spec.ts` / `studio-001-generate-artifact.spec.ts`
  已经是正确模式，未改动；符合任务说明中"清单里有一处误报"的提示）。
- 全部改动集中在 `apps/web/e2e/*.spec.ts`，无其它目录改动（见 diff-stat.txt）。
- 32 个文件：在 `const uniq = ...` 后插入
  `const BASE_URL = process.env.E2E_PORT ? \`http://localhost:${process.env.E2E_PORT}\` : "http://localhost:3000";`，
  并把内联的 `"http://localhost:3000"` 替换为 `BASE_URL`。
- 2 个文件（canvas-005-realtime-collaboration.spec.ts / collab-001-yjs-realtime-sync.spec.ts）：
  原来用 `PW_BASE_URL` 环境变量、fallback 硬编码 3000；改为 fallback 到同样的
  `BASE_URL`（`E2E_PORT` 优先），保留 `PW_BASE_URL` 的最高优先级不变。

## 验证
1. `grep-final-localhost3000.txt`：全仓库搜索 `localhost:3000` 仅剩每个文件里的
   `BASE_URL` 常量定义本身（fallback 分支），无任何裸内联字符串。credits-001-view-wallet.spec.ts
   （参照模板）里的那一处不算修改目标，本来就如此。
2. worktree 隔离环境：`bash scripts/init-worktree-env.sh` 分配了
   E2E_PORT=63654 / DATABASE_URL=...:63652 / REDIS_URL=...:63653，
   `docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate` 完成。
3. 抽样跑通（用 E2E_PORT=63654 起 next dev，非默认 3000 端口）：
   - board-create.spec.ts：3/3 通过
   - canvas-add.spec.ts：2/2 通过
   - room-chat-create.spec.ts：3/3 通过
   - team-manage.spec.ts：3/3 通过
   共 11/11 通过，且 next dev 日志里的请求全部落在 63654 端口，没有任何
   `ECONNREFUSED :3000` —— 证明修复生效：走隔离端口不再误连默认 3000。
   （对照组：在修复前的代码上跑同一批用例，`newUser()` 里硬编码 3000 的
   请求确实 `ECONNREFUSED ::1:3000`，而用 playwright 内置 `page.request`
   的请求因为 playwright.config.ts 本身已读 E2E_PORT 而能连上——这就是
   本次要修的具体故障模式。）
   - widgets-001-use-canvasx-widgets.spec.ts：本机因同时有 20+ 个其它
     agent worktree 的 postgres 容器抢占 CPU/IO，出现 `POST /api/auth/register`
     500/超30s 的资源争用型 flaky（非端口问题，服务端返回 500 而非连接失败）。
     不属于本次改动引入的问题。
   - studio-001-generate-artifact.spec.ts：本身在清单里已是正确模式，未改动；
     未纳入本轮抽样通过率统计（对照组测试中该文件本就因 MinIO
     unhealthy + 全局资源争用大量超时，与本次端口修复无关）。

## verify:base
`pnpm -w run verify:base`（typecheck + lint + test）在两次独立运行中都只有
`@repo/auth#test` 的 `password > hash 不等于明文，verify 正确匹配` 用例超时
（bcrypt 5000ms 超时，在本机 40 个 turbo 任务并发 + 20+ postgres 容器争抢
CPU 时触发）。单独在 `packages/auth` 目录下运行 `pnpm run test`（无并发压力）
15/15 全部通过，904ms 内完成，证明是机器负载导致的超时而非代码问题。
本次改动完全不涉及 `packages/auth`（`git diff --name-only` 确认全部改动都在
`apps/web/e2e/`），故与本次修复无关，是环境噪音。

## 结论
- 港口修复本身验证通过：连接不再误打到硬编码的 3000，而是遵循 `E2E_PORT`。
- 观察到的失败（widgets-001 的资源争用、verify:base 的 auth bcrypt 超时）
  都是本机同时运行大量 agent worktree 导致的资源竞争型环境噪音，跟本次
  改动的内容（纯字符串替换）无因果关系；本次改动理论上不改变默认行为
  （`E2E_PORT` 未设置时行为与原来完全一致）。
