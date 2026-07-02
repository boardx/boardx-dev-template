# 会话交接 — Sprint p15/03

## 当前已验证
- F02（用户管理）: **passing**。跑过：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/admin-001-manage-users.spec.ts`（9/9）
  - `pnpm harness verify --sprint p15/03`（含 `pnpm -w run verify:base` 45/45）

## 本轮改动
- `packages/data/src/auth.ts`: 新增 `listAdminUsers` / `updateAdminUser` / `deleteUser`。
- `apps/web/app/api/admin/users/route.ts`: GET/POST 改真实 DB + `requireSysAdmin()`。
- `apps/web/app/api/admin/users/[id]/route.ts`（新增）: PATCH/DELETE。
- `apps/web/app/api/admin/users/[id]/credit/route.ts`（新增）: 手动加个人 Credit（幂等 key +
  操作人审计 + note 裁剪，同 F03 团队上分模式）。
- `apps/web/app/(app)/admin/users/page.tsx`: 整页重写（原 stub-gated 原型）。
- `apps/web/e2e/admin-001-manage-users.spec.ts`: 重写为真实门控/真实数据覆盖。
- 未动 `admin/teams/*`（F03，已 merged，非本轮范围）。

## 仍损坏或未验证
- 无代码层面的已知问题。
- **环境/基础设施观测**（超出 F02 范围，未修改共享脚本）：
  1. 本机同时跑 50+ worktree 的 docker 容器，CPU 总需求经常 > 200%（仅 8 核）。本 worktree
     的 postgres 容器在压测式重复跑 e2e 时会出现 `57P03 database system is in recovery
     mode` 崩溃重启（broken pipe 级联终止）。单次 verify 跑（非 repeat-each 压测）在 DB
     稳定时能确定性通过，`pnpm harness verify --sprint p15/03` 最终已跑通并门控 F02 为
     passing。若下一轮重跑验证遇到同样的 57P03，等几十秒到几分钟（DB 自动恢复）后重跑
     一次即可，不是代码回归。
  2. `scripts/init-worktree-env.sh` 只分配 PG_PORT/REDIS_PORT/E2E_PORT，未分配
     MINIO_PORT/MINIO_CONSOLE_PORT，导致 `docker compose up -d` 在 MinIO 默认端口
     (9090/9091) 被其它 worktree 占用时整体返回非 0（即使当前 feature 不需要 MinIO）。
     本轮临时在 `.env` / `infra/.env`（均已 gitignore）里手动加了空闲端口绕过，未改脚本。
  3. `docker compose`（v2.17.3）只传 `-f infra/docker-compose.yml` 时不会从 cwd 自动读取
     `.env`（它去 compose 文件所在目录 `infra/` 找），跟 `scripts/init-worktree-env.sh` 只写
     根 `.env` 的假设不一致。本轮临时把 `.env` 复制了一份到 `infra/.env` 绕过。
  这两点建议后续由 coordinator 或专门 task 去修 `scripts/init-worktree-env.sh`
  （分配 MinIO 端口 + 同时写 `infra/.env`），避免下一个 worker 重复踩坑。

## 下一步最佳动作
- F02 已 passing，本 sprint（p15/03）完成，无需继续本 feature。
- 下一轮如继续 P15 阶段：F04/F05（AI Store 审核/精选页）当前 `blocked`（owner: null），
  不在本 sprint 范围，不要动。
- 不要碰 `apps/web/app/(app)/admin/teams/*` 或 `apps/web/app/api/admin/teams/*`（F03，
  wrk-admin-2 已完成并 merged）。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p15/03`
  （需要先 export DATABASE_URL/REDIS_URL/E2E_PORT，取值见 `apps/web/.env.local`；
  harness 的 `sh()` 是裸 spawnSync，不会自动加载 `.env.local`）
- 调试: `pnpm --filter @repo/web exec playwright test e2e/admin-001-manage-users.spec.ts --trace on`，
  失败后 `pnpm --filter @repo/web exec playwright show-trace <trace.zip 路径>` 看具体 DOM/网络时序。
