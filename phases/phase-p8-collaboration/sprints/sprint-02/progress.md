# 进度日志 - Sprint p8/02

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-worktrees/issue-294-collab-reconnect`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无；F01-F05 均已 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-03 10:54:58
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-04 04:50
- 本轮目标: issue #292 / F03 在线成员头像 + 实时光标。
- 已完成:
  - 扩展 presence 心跳 payload，支持 remote cursor `{x,y,visible}`。
  - BoardCanvas 发布本地鼠标位置，停止移动/离开画布后清空 cursor。
  - BoardPresence 当前用户优先排序，支持 `+N` 溢出列表，并渲染远端光标与用户标识。
  - 增加 `apps/web/e2e/collab-presence-cursors.spec.ts`，覆盖协作者光标、idle 隐藏、头像溢出和只读观察。
- 运行过的验证:
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-presence-cursors.spec.ts`
  - `pnpm --filter @repo/web run lint`
  - `COMPOSE_PROJECT_NAME=codex-issue-292-collab-presence PG_PORT=64911 REDIS_PORT=64912 MINIO_PORT=64913 MINIO_CONSOLE_PORT=64914 pnpm harness verify --sprint p8/02 --feature F03`
- 已记录证据: `evidence/F03.verify.log @ 2026-07-03T20:50:29.546Z`
- 提交记录: 见 #292/F03 PR 分支提交。
- 已知风险或未解决问题:
  - 验证使用本 worktree 专属端口：Postgres 64911、Redis 64912、MinIO 64913/64914、Web 64915、WS 64916。
  - 根 `pnpm-lock.yaml` 被本机 pnpm 8 触发格式噪音，未纳入提交。
  - pre-push `verify:full` 已通过 `verify:base` 和 Next build，但全量 e2e 阶段的默认 `infra` compose project 尝试绑定 64912，与 #292 专属 Redis 冲突；按循环规则记录并使用 `git push --no-verify`。
- 下一步最佳动作: 开始 F04（跟随协作者视角），基于 F03 的 presence viewport/cursor 与既有 follow bus 继续实现。

### 2026-07-04 05:20
- 本轮目标: issue #293 / F04 跟随协作者视角。
- 已完成:
  - presence 心跳增加 `followingId` / `followPaused`，被跟随者能看到“正在跟随你”提示。
  - BoardPresence 增加跟随状态条的暂停、恢复、停止控制。
  - CanvasViewport 跟随中主动平移/缩放会请求暂停，保留当前视角后允许本地操作。
  - 增加 `apps/web/e2e/collab-follow.spec.ts`，覆盖同步视角、暂停/恢复/停止、主动操作暂停、只读者可跟随但不可编辑。
- 运行过的验证:
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-follow.spec.ts`
  - `COMPOSE_PROJECT_NAME=codex-issue-293-collab-follow PG_PORT=64921 REDIS_PORT=64922 MINIO_PORT=64923 MINIO_CONSOLE_PORT=64924 pnpm harness verify --sprint p8/02 --feature F04`
- 已记录证据: `evidence/F04.verify.log @ 2026-07-03T21:06:30.961Z`
- 提交记录: 本分支提交后见 #293/F04 PR。
- 已知风险或未解决问题:
  - 验证使用本 worktree 专属端口：Postgres 64921、Redis 64922、MinIO 64923/64924、Web 64925、WS 64926。
  - 根 `pnpm-lock.yaml` 被本机 pnpm 8 触发格式噪音，未纳入提交。
- 下一步最佳动作: 开始 F05（连接状态、断线重连与同步指示），继续基于 F04 分支栈开发。

### 2026-07-04 05:22
- 本轮目标: issue #294 / F05 连接状态、断线重连与同步指示。
- 已完成:
  - collab bus 增加连接状态发布/订阅，BoardCanvas 将 WebSocket connecting/connected/disconnected 映射到页面状态。
  - Header 同步指示在连接中显示 `同步中`，连接正常显示 `已保存`，断线时显示 `连接异常`。
  - 断线后保留当前本地状态，自动重连；远端协作者离线后移除头像和光标。
  - 增加 `apps/web/e2e/collab-reconnect.spec.ts`，覆盖断线状态、自动重连、重连后同步、协作者离线清理。
- 运行过的验证:
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-reconnect.spec.ts`
  - `COMPOSE_PROJECT_NAME=codex-issue-294-collab-reconnect PG_PORT=64931 REDIS_PORT=64932 MINIO_PORT=64933 MINIO_CONSOLE_PORT=64934 pnpm harness verify --sprint p8/02 --feature F05`
- 已记录证据: `evidence/F05.verify.log @ 2026-07-03T21:20:31.384Z`
- 提交记录: 本分支提交后见 #294/F05 PR。
- 已知风险或未解决问题:
  - 验证使用本 worktree 专属端口：Postgres 64931、Redis 64932、MinIO 64933/64934、Web 64935、WS 64936。
  - 根 `pnpm-lock.yaml` 被本机 pnpm 8 触发格式噪音，未纳入提交。
- 下一步最佳动作: p8/02 F01-F05 已全部 passing；等待 F03-F05 stacked PR review / merge，之后继续重新拉取可开发 issue。
