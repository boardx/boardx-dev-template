# 会话交接 — Sprint p8/01

## 当前已验证
- **F01 passing**：WebSocket + Redis 广播骨架（不含 Yjs 语义）。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-transport-skeleton.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/01 --feature F01`（包含 `verify:base`）
  - 证据：`evidence/F01.verify.log`

## 本轮改动
- 新增 `apps/web/server/collab-gateway.mjs`：轻量 WebSocket sidecar，路径
  `/api/collab/ws?boardId=...`，消息发布到 Redis pub/sub channel
  `boardx:collab:transport`，订阅后广播给同 board 的本机连接。
- 新增 `apps/web/e2e/collab-transport-skeleton.spec.ts`：两个 browser context 直连 WS，
  验证 A 发 B 收、断线重连后仍能收发，且收到消息带 `via: "redis"`。
- 更新 `apps/web/playwright.config.ts`：Playwright 同时启动 Next dev 与 collab gateway；
  gateway 端口来自 `COLLAB_WS_PORT`。
- 更新 `scripts/init-worktree-env.sh`：每个 worktree 分配独立 `COLLAB_WS_PORT`，避免并发
  e2e/gateway 端口冲突；修复 echo 中 `$compose_env` 与中文括号相邻导致的 unbound variable。

## 仍损坏或未验证
- F01 明确不做 Yjs/CRDT 语义、awareness、在线光标、跟随视角、权限模型、消息持久化。
- gateway 目前是 p8 传输骨架 sidecar；F02 需要决定是否抽到 `packages/collab` 并接入
  Yjs doc/provider。
- pre-push `verify:full` 已过 `verify:base` 与 `next build`，但全量 e2e 在非协作区域
  `ai-store-001-browse-items.spec.ts:94` 分页用例失败；本轮按 issue-dev-loop 规则记录后跳过。

## 下一步最佳动作
- 开始 F02：基于 F01 的 WS+Redis 骨架实现 Yjs 实时同步组件变更。
- 不要在 F02 里重写现有 `apps/web/lib/presence.ts` / `apps/web/lib/collab-bus.ts` 的 UI 语义；
  它们是现有页面内/presence 临时机制，替换时机应随 F02-F05 分层推进。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/01`
- 调试:`COLLAB_WS_PORT=3001 REDIS_URL=redis://localhost:6379 node apps/web/server/collab-gateway.mjs`
