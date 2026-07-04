# 会话交接 — Sprint p8/01

## 当前已验证
- **F01 passing**：WebSocket + Redis 广播骨架（不含 Yjs 语义）。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-transport-skeleton.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/01 --feature F01`（包含 `verify:base`）
  - 证据：`evidence/F01.verify.log`

## 本轮改动
- 新增 `apps/web/server/collab-gateway.mjs`：轻量 WebSocket sidecar，路径
  `/api/collab/ws?boardId=...`，消息发布到 per-board Redis pub/sub channel
  `boardx:collab:board:{boardId}`，订阅后广播给同 board 的本机连接。
- 新增 `apps/web/e2e/collab-transport-skeleton.spec.ts`：两个 browser context 直连 WS，
  验证 A 发 B 收、断线重连后仍能收发，且收到消息带 `via: "redis"`。
- 更新 `apps/web/playwright.config.ts`：Playwright 同时启动 Next dev 与 collab gateway；
  gateway 端口来自 `COLLAB_WS_PORT`。
- 更新 `scripts/init-worktree-env.sh`：每个 worktree 分配独立 `COLLAB_WS_PORT`，避免并发
  e2e/gateway 端口冲突；修复 echo 中 `$compose_env` 与中文括号相邻导致的 unbound variable。

### coord-collab 收尾修复（review 阻断项，2026-07-04）
首轮 review 判定两项高危阻断（详见 issue #290 评论），本轮由 coord-collab 直接实现并推送：
1. **WS 连接零鉴权 → 补 session cookie 校验**：`isAuthenticated()` 在 upgrade 时把
   `req.headers.cookie` 转发给 `GET /api/auth/session`（已有的会话真相来源），
   `user` 为空则 401 拒绝握手。网关不直连 DB（保持零新增依赖的风格），复用主 app
   现成的 session 校验。`WEB_ORIGIN` 走 `COLLAB_WEB_ORIGIN`/`E2E_PORT`/`PORT` 环境变量。
2. **Redis 单一全局 channel → per-board channel**：`channelFor(boardId)` 生成
   `boardx:collab:board:{boardId}`；`addClient`/`removeClient` 在某 board 第一个/最后一个
   本地连接时动态 SUBSCRIBE/UNSUBSCRIBE，而不是启动时订阅一个全局 channel 再靠应用层
   `boardId` 比对过滤——现在每个实例只收自己真正有客户端的 board 流量，Redis 自己做
   隔离与扇出裁剪。`RedisSubscriber` 新增 `unsubscribe()`。
3. （建议项一并修复）单帧上限 `MAX_FRAME_BYTES=1MiB`，超限直接断开连接；WS 错误帧
   回传通用文案而非 `err.message`；`/health` 增加 `redis` 诊断字段（状态码仍 200，
   不影响 playwright webServer 就绪判定语义）。
- 新增 e2e 用例：未带 session cookie 的连接必须被拒绝（不会收到 `connected`）。

## 仍损坏或未验证
- F01 明确不做 Yjs/CRDT 语义、awareness、在线光标、跟随视角、权限模型、消息持久化。
- gateway 目前是 p8 传输骨架 sidecar；F02 需要决定是否抽到 `packages/collab` 并接入
  Yjs doc/provider。
- pre-push `verify:full` 已过 `verify:base` 与 `next build`，但全量 e2e 在非协作区域
  `ai-store-001-browse-items.spec.ts:94` 分页用例失败；本轮按 issue-dev-loop 规则记录后跳过。
- **重要（读给 F02 的人）：本传输层不保证 at-least-once。** 客户端断线期间发布到 Redis
  的消息不会被排队或在重连后补发——网关只把"当前在线的本机连接"接进 broadcast，
  断线那段时间的消息直接丢失。F02（Yjs 同步）必须自带和解机制（如重连后拉一次
  权威快照/全量 state），不能假设这条通道会替你补齐错过的增量。

## 下一步最佳动作
- 开始 F02：基于 F01 的 WS+Redis 骨架实现 Yjs 实时同步组件变更。
- 不要在 F02 里重写现有 `apps/web/lib/presence.ts` / `apps/web/lib/collab-bus.ts` 的 UI 语义；
  它们是现有页面内/presence 临时机制，替换时机应随 F02-F05 分层推进。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/01`
- 调试:`COLLAB_WS_PORT=3001 REDIS_URL=redis://localhost:6379 node apps/web/server/collab-gateway.mjs`
