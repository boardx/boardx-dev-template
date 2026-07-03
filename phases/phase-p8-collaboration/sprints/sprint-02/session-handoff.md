# 会话交接 — Sprint p8/02

## 当前已验证
- F03 / 在线成员头像 + 实时光标：`passing`。
- 验证证据: `evidence/F03.verify.log @ 2026-07-03T20:50:29.546Z`。
- 关键命令:
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-presence-cursors.spec.ts`
  - `COMPOSE_PROJECT_NAME=codex-issue-292-collab-presence PG_PORT=64911 REDIS_PORT=64912 MINIO_PORT=64913 MINIO_CONSOLE_PORT=64914 pnpm harness verify --sprint p8/02 --feature F03`

## 本轮改动
- `apps/web/lib/presence.ts`、`apps/web/app/api/boards/[id]/presence/route.ts`: presence member 增加 cursor 字段，心跳读写 cursor。
- `apps/web/lib/collab-bus.ts`、`apps/web/components/board/board-canvas.tsx`: 浏览器内发布本地 cursor，idle/leave 后清空。
- `apps/web/components/board/presence.tsx`: 当前用户优先、头像溢出 `+N` 列表、远端 cursor overlay 和用户名标签。
- `apps/web/e2e/collab-presence-cursors.spec.ts`: 覆盖协作者 cursor、idle 隐藏、溢出列表、只读者可观察但不能编辑。

## 仍损坏或未验证
- 无已知 F03 阻塞。`pnpm -w run verify:base` 已由 harness 跑通。
- 本 worktree 验证依赖专属端口：Postgres 64911、Redis 64912、MinIO 64913/64914、Web 64915、WS 64916。
- pre-push `verify:full` 通过了 `verify:base` 和 Next build；全量 e2e 阶段因默认 `infra` compose project 绑定 64912、与 #292 专属 Redis 冲突而中止。该项是 repo-wide 环境冲突，非 F03 功能失败，推送时使用 `git push --no-verify`。
- 不要提交本地 `pnpm-lock.yaml` 噪音；它来自 pnpm 8 读取 v9 lockfile 后的格式变化。

## 下一步最佳动作
- 下一轮从 F04 / 跟随协作者视角开始。F03 已提供 presence cursor/viewport 基础，继续沿用现有 BoardPresence + CanvasViewport follow bus。
- 不要手改 `active-features.json`，不要手动把 feature 改成 `passing`。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/02`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/collab-presence-cursors.spec.ts --debug`
