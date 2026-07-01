# 进度日志 — Sprint p15/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01（Admin Panel 首页 + 身份门控 + 统计摘要 + 模块导航）—— 实现完成、
  自测全绿，等待 PR review + coordinator 跑 `pnpm harness verify` 门控转 passing。
- 当前 blocker: 无。

## 会话记录
### 2026-07-01 09:25:46
- 本轮目标: （sprint 初始化，无实现记录）

### 2026-07-01（wrk-admin-1）
- 本轮目标: 实现 F01 —— SysAdmin 角色门控 + `/admin` 首页骨架 + 统计摘要（真实用户/团队计数 +
  AI Store 占位）+ 模块导航（用户管理可用，团队/AI Store 审核/精选为占位子页）。
- 已完成:
  - 新迁移 `016_admin_role.sql` 给 `users` 加 `platform_role` 平台角色列。
  - `packages/auth` 新增 `isSysAdmin`/`PlatformRole` 纯逻辑；`packages/data` 新增
    `admin.ts`（`countUsers`/`countTeams`/`getPlatformStats`）+ `setPlatformRole`。
  - `apps/web/lib/admin.ts` 的 `requireSysAdmin()` 服务端门控，供 `/admin` 首页与三个占位子页复用。
  - `/api/admin/stats`（SysAdmin 门控 + 真实聚合 + AI Store mock 占位）、
    `/api/dev/grant-sysadmin`（dev-only，e2e 用）。
  - `/admin` 首页（`admin-home.tsx`）：统计卡片 + 模块导航（骨架/错误态齐全）。
  - F02 既有用户管理原型页从 `/admin` 迁到 `/admin/users`（不改动逻辑，只搬路径 + 加说明注释），
    同步修 `admin-001-manage-users.spec.ts` 的路径断言。
  - 三个占位子页（`/admin/teams`、`/admin/ai-store/review`、`/admin/ai-store/featured`）。
  - 新 e2e `admin-005-view-admin-home.spec.ts`（feature_list.json 指定的目标 verification）。
  - `playwright.config.ts` 加 `E2E_PORT` 环境变量覆盖（默认仍 3000），解决本机多 worktree 并行时的
    端口冲突。
- 运行过的验证:
  - `pnpm --filter @repo/auth run typecheck / test`（15 pass）
  - `pnpm --filter @repo/data run typecheck / test`（14 pass）
  - `pnpm --filter @repo/web run typecheck`（pass）
  - `pnpm --filter @repo/web run lint`（design lint 全部通过）
  - `docker compose -f infra/docker-compose.yml up -d`（独立 project/端口，见 evidence/README.md）
  - `pnpm --filter @repo/data run migrate`（exit 0，含新迁移 016）
  - `pnpm --filter @repo/web exec playwright test e2e/admin-005-view-admin-home.spec.ts`（6/6 pass）
  - `pnpm --filter @repo/web exec playwright test e2e/admin-001-manage-users.spec.ts`（4/4 pass，
    确认 F02 原型未被路由迁移破坏）
  - 顺带跑了 `auth-login.spec.ts`/`home-shell.spec.ts`/`profile-edit.spec.ts` 做回归抽查，全绿
    （中途因本机资源紧张出现过一次偶发超时 flake，重跑即过，与本次改动无关）。
- 已记录证据: `phases/phase-p15-admin/sprints/sprint-01/evidence/`
  （`01-migrate.txt`、`02-playwright-admin-005.txt`、`f01-e2e-admin-005-and-admin-001.txt`、`README.md`）。
- 提交记录: 分支 `worker/wrk-admin-1-p15-f01-admin-shell`，PR 面向
  `harness/coord-dispatch-wave2-admin-payment`（见 PR 链接，`Closes #135`）。
- 已知风险或未解决问题:
  - AI Store 项目数仍是占位（`mock:true`），依赖 p11 的 `ai_store_items` 表（尚未建成）。
  - F02 页面（`/admin/users`）仍用它自己的 stub 网关，未切到本轮新增的真实 `platform_role`
    判定——留给 F02 owner 后续处理。
- 下一步最佳动作: coordinator review 通过后跑 `pnpm harness verify --sprint p15/01` 门控 F01
  转 passing；后续 F02-F05 owner 可复用 `requireSysAdmin()` + 已占好的路由骨架。
