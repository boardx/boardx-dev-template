# 会话交接 — Sprint p15/01

## 当前已验证
- F01（Admin Panel 首页 + 身份门控 + 统计摘要 + 模块导航）：实现已完成，`e2e/admin-005-view-admin-home.spec.ts`
  全部 6 个用例通过；`e2e/admin-001-manage-users.spec.ts`（F02 既有原型，路径迁移到 `/admin/users`）
  4 个用例仍通过。`pnpm --filter @repo/data run migrate`（含新迁移 `016_admin_role.sql`）exit 0。
  单元测试 `@repo/auth`（15 pass）、`@repo/data`（14 pass）、typecheck（auth/data/web 三包）、
  `pnpm --filter @repo/web run lint` 均通过。
  **注意**：status 仍是 `in_progress`——本 worker 未运行 `pnpm harness verify`（按分工，仅 PR
  合并后由 coordinator 跑门控转 passing），故 `feature_list.json` 未改。

## 本轮改动
- 新迁移 `packages/data/migrations/016_admin_role.sql`：给 `users` 加 `platform_role`
  列（'user' | 'sysadmin'，与团队内 role 是两套体系）。
- `packages/auth/src/index.ts`：新增 `PlatformRole` / `isPlatformRole` / `isSysAdmin` 纯逻辑。
- `packages/data/src/auth.ts`：`User` 加 `platform_role` 字段，`getSessionUser` SELECT 带上该列；
  新增 `setPlatformRole()`（dev/e2e 用）。
- `packages/data/src/admin.ts`（新）：`countUsers`/`countTeams`/`getPlatformStats` —— 只聚合已建表的
  真实维度，不提供 AI Store 计数（p11 未建表）。
- `apps/web/lib/admin.ts`（新）：`requireSysAdmin()` 服务端门控，供 `/admin` 系列页面与 API 复用。
- `apps/web/app/api/admin/stats/route.ts`（新）：SysAdmin 门控 + 用户/团队真实计数 + AI Store 占位
  （`mock:true`）。
- `apps/web/app/api/dev/grant-sysadmin/route.ts`（新）：dev-only（生产 404）把用户提升 SysAdmin，
  供 e2e 覆盖 SysAdmin 正向路径。
- `apps/web/app/(app)/admin/page.tsx`：改写为 F01 的服务端门控首页（未登录跳登录、非 SysAdmin 见
  403、SysAdmin 见 `admin-home.tsx` 客户端组件：统计摘要 + 模块导航）。
- `apps/web/app/(app)/admin/admin-home.tsx`（新）：统计卡片（加载骨架/错误态）+ 四个模块导航卡片
  （用户管理可用；团队管理/AI Store 审核/AI Store 精选带"即将上线"徽章，指向占位子页）。
- **路由迁移**：F02 既有的用户管理原型页从 `/admin` 移到 `/admin/users`（`git mv`，内容未改，只加了
  一段说明注释）；同步把 `e2e/admin-001-manage-users.spec.ts` 里的 `/admin` 断言改成 `/admin/users`。
- 新增三个占位子页（各自门控 + `coming-soon.tsx` 占位组件）：`/admin/teams`、
  `/admin/ai-store/review`、`/admin/ai-store/featured`。
- 新 e2e：`apps/web/e2e/admin-005-view-admin-home.spec.ts`（F01 的目标 verification）。
- `apps/web/playwright.config.ts`：端口从硬编码 3000 改成 `E2E_PORT` 环境变量覆盖（默认仍 3000，
  未设置时行为不变）——本机同时有多个并行 worktree 各自占 3000/5432/6379，需要能各自换端口跑。

## 仍损坏或未验证
- 无已知 blocker。`init.sh` 基础验证未见新增失败（本轮验证的单元测试/typecheck/lint/e2e 均基于
  本次改动直接跑通，未观察到回归）。
- F02 的用户管理页（`/admin/users`）仍用它自己的 `ADMIN_GATE_OPEN` stub 网关，未接入本轮新增的
  真实 `platform_role` 判定——这是 F02 落地时才该做的事，故意没有在本轮改。
- F01 的统计摘要里 AI Store 项目数是占位（`mock:true`，值恒为 0）——依赖 p11 的
  `ai_store_items` 表，p11 仍在别处并行开发，尚未建表。

## 下一步最佳动作
- coordinator：review PR 后跑 `pnpm harness verify --sprint p15/01` 门控 F01 转 passing。
- 下一个 worker 接 F02/F03 时：可复用 `apps/web/lib/admin.ts` 的 `requireSysAdmin()` 做真门控
  （替换 F02 现有 stub），并复用 `/admin/users`、`/admin/teams`、`/admin/ai-store/{review,featured}`
  这几个已占好的路由 + `packages/auth` 的 `isSysAdmin`。
- F04/F05 仍 blocked-on p11（ai_store_items 表未建），不要在 p11 就绪前尝试解除 blocked。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p15/01`（由 coordinator 在 PR 合并后跑）
- 本轮手动验证用的调试命令（因端口冲突用了非默认端口，见
  `evidence/README.md`）：
  ```
  COMPOSE_PROJECT_NAME=admf01 PG_PORT=15550 REDIS_PORT=16550 docker compose -f infra/docker-compose.yml up -d
  DATABASE_URL="postgresql://boardx:boardx@localhost:15550/boardx" pnpm --filter @repo/data run migrate
  DATABASE_URL="postgresql://boardx:boardx@localhost:15550/boardx" REDIS_URL="redis://localhost:16550" E2E_PORT=3101 \
    pnpm --filter @repo/web exec playwright test e2e/admin-005-view-admin-home.spec.ts
  ```
