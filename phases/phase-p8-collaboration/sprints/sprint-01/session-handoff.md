# 会话交接 — Sprint p8/01

## 当前已验证
- **F01 passing**：WebSocket + Redis 广播骨架（不含 Yjs 语义）。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-transport-skeleton.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/01 --feature F01`（包含 `verify:base`）
  - 证据：`evidence/F01.verify.log`
- **F02 passing**：Board item 变更通过 F01 gateway 实时同步。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/data run migrate`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-realtime-sync.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/01 --feature F02`（包含 `verify:base`）
  - 证据：`evidence/F02.verify.log`

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
- F02 更新 `apps/web/components/board/board-canvas.tsx`：本地 add/move/edit/style/delete/undo/redo
  经 REST 成功落库后，读取最新 board items 并通过 collab gateway 广播 JSON snapshot；远端页面
  收到同 board snapshot 后即时合并到 React item state，原轮询保留为 fallback。
- F02 新增 `apps/web/app/api/collab/config/route.ts`：按当前请求 host 和 `COLLAB_WS_PORT` 返回
  浏览器可连接的 gateway WS URL。
- F02 新增 `apps/web/e2e/collab-realtime-sync.spec.ts`：覆盖协作者创建/移动/编辑/删除同步，
  以及 public viewer 只读观察 + 写 API 403。

## 仍损坏或未验证
- 在线头像/光标、awareness、跟随视角、断线重连指示仍未实现，留给 p8/02。
- F02 没有改写 `apps/web/lib/presence.ts` / `apps/web/lib/collab-bus.ts`；这些仍是现有在线/操作态
  临时机制，p8/02 需要分层替换或复用。
- gateway 仍未做 WS 层鉴权；当前安全边界是所有写操作仍必须先通过现有 REST API 权限门控，
  gateway 只广播已落库后的 snapshot。
- F02 用 F01 text frame 承载 JSON snapshot；尚未引入独立 binary Yjs provider 协议。
- pre-push `verify:full` 已过 `verify:base` 与 `next build`，但全量 e2e 在非协作区域
  `ai-store-001-browse-items.spec.ts:94` 分页用例与 `ai-store-003-subscribe-use-item.spec.ts:13`
  订阅流程失败；本轮按 issue-dev-loop 规则记录后跳过。

## 下一步最佳动作
- 开始 p8/02 F03：在线成员头像 + 实时光标。优先基于当前 gateway/config 与现有 presence API
  接出 awareness；不要回退到改 `active-features.json`。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/01`
- 调试:`COLLAB_WS_PORT=3001 REDIS_URL=redis://localhost:6379 node apps/web/server/collab-gateway.mjs`
