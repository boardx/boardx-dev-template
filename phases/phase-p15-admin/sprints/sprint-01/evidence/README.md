# Evidence — F01（Admin Panel 首页 + 身份门控 + 统计摘要 + 模块导航）

## 运行环境说明
本机同时有多个并行 agent worktree 各自起 docker/next dev，默认端口
（5432/6379/3000）已被其他 worktree 占用。为不干扰其他 agent，本 feature 的验证
用了独立端口/项目名运行，行为与默认端口完全一致，只是端口不同：

```bash
COMPOSE_PROJECT_NAME=admf01 PG_PORT=15550 REDIS_PORT=16550 \
  docker compose -f infra/docker-compose.yml up -d

DATABASE_URL="postgresql://boardx:boardx@localhost:15550/boardx" \
  pnpm --filter @repo/data run migrate

DATABASE_URL="postgresql://boardx:boardx@localhost:15550/boardx" \
REDIS_URL="redis://localhost:16550" \
E2E_PORT=3101 \
  pnpm --filter @repo/web exec playwright test e2e/admin-005-view-admin-home.spec.ts
```

`E2E_PORT` 是本次给 `apps/web/playwright.config.ts` 新增的可选覆盖（默认仍是 3000，
未设置时行为不变），专门为解决多 worktree 并行开发时的端口冲突。

## 文件
- `01-migrate.txt` — `pnpm --filter @repo/data run migrate` 输出（含新增的
  `016_admin_role.sql`，本次运行前已应用，故显示"已应用，跳过"，为幂等证明）。
- `02-playwright-admin-005.txt` — 目标 verification 命令（`e2e/admin-005-view-admin-home.spec.ts`）
  的完整通过输出：6/6 passed。
- `f01-e2e-admin-005-and-admin-001.txt` — F01 新 spec 与 F02 既有 spec
  （`admin-001-manage-users.spec.ts`，验证 F01 的路由迁移未破坏 F02 原型）合并跑的输出：10/10 passed。

## 覆盖范围与占位说明（DoD 要求"明确说明"）
- **真实实现**：`users.platform_role`（新迁移 016）+ `packages/auth` 的 `isSysAdmin`/`PlatformRole`
  纯逻辑 + `apps/web/lib/admin.ts` 的 `requireSysAdmin()` 服务端门控（用于 `/admin` 首页 +
  三个占位子页）+ `/api/admin/stats`（用户数、团队数 = 真实聚合自 `users`/`teams` 表）。
- **占位/mock（已在 UI 与 API 响应中明确标注）**：
  - `/api/admin/stats` 的 `aiStoreItems.value` 恒为 0、`mock: true` —— AI Store 项目数依赖
    p11 的 `ai_store_items` 表，该表尚未建成（p11 仍在并行开发），前端渲染"占位"徽章。
  - 模块导航中的"团队管理""AI Store 审核""AI Store 精选"三个卡片带"即将上线"徽章，
    点击进入的是占位子页（`/admin/teams`、`/admin/ai-store/review`、`/admin/ai-store/featured`），
    只做 SysAdmin 门控 + 占位文案，不含 F03-F05 的业务逻辑（那是各自 owner 的后续 feature）。
  - `/admin/users`（F02 既有原型页，本次只做路由迁移）仍用它自己的 `ADMIN_GATE_OPEN` stub
    网关，尚未切到本次新增的真实 `platform_role` 判定 —— 那是 F02 落地时的工作范围。
- **不属于 F01 范围、未做**：F02-F05 的实际业务逻辑（用户/团队 CRUD、AI Store 审核/精选）。
