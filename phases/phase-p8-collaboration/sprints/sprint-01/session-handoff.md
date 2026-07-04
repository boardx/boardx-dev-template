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
3. （建议项一并修复）单帧上限 `MAX_FRAME_BYTES=1MiB`，超限发 1009 关闭帧后断开；
   WS 错误帧回传通用文案而非 `err.message`（真实原因落服务端日志）；`/health`
   增加 `redis` 诊断字段（状态码仍 200，不影响 playwright webServer 就绪判定语义）。
- 新增 e2e 用例：未带 session cookie 的 upgrade 必须收到 HTTP 401（用 Node `http.request`
  直接读 upgrade 响应的真实状态码，不依赖浏览器 WebSocket 那种"握手失败只有笼统
  error/close 事件"的弱信号）；带有效 cookie 的 upgrade 必须收到 101。

### code-reviewer 二轮发现 + 修复（同一批次内闭环）
首轮修复被独立 code-reviewer agent 复核后，又抓到两个真实问题，一并修复：
1. **未捕获 socket 'error' 可崩掉整个网关进程**：upgrade 到鉴权完成之间有一次真实网络
   往返，期间客户端随时可能掉线；若这段时间内 socket 触发 `error` 而没有监听者，会
   是未捕获异常，直接砍掉进程（殃及所有 board）。修复：upgrade 回调第一行就无条件
   挂 `socket.on("error", () => {})`，任何后续 write 前先查 `socket.destroyed`。同时给
   `isAuthenticated` 的 fetch 加了 5s `AbortController` 超时，避免主 app 卡住时 socket
   被无限占着（slow-loris）。
2. **subscribe/unsubscribe 各自独立挂在 `redisReady` 上，理论上有乱序风险**：同一 board
   快速离开又加入时，两个 fire-and-forget 的 `.then` 谁先落地不是强保证。改成单一队列
   `enqueueRedisOp` 把所有订阅操作强制串行化，执行顺序跟 `addClient`/`removeClient`
   的同步调用顺序对齐。
- 顺带加了 `boardId` 字符集校验（`^[A-Za-z0-9_-]+$`），避免奇怪输入拼进 Redis channel 名。

### 明确记录、本轮不修的已知边界（避免被误读为"已解决"）
- **鉴权 ≠ 鉴权限（authz）**：现在只校验"是否登录"，不校验"该用户是否有权访问这个
  boardId"——任何登录用户可以连任意 boardId 的传输 channel。这是原 review(#290) 明确
  划定的范围（"权限模型细节留给 F02+"），不是本轮遗漏；F02/F03 引入 board 成员关系时
  必须补上这一层，否则是一个横向越权洞。
- Redis 连接中断后，网关不会自动重连+重新 SUBSCRIBE 已有 board 的 channel（`publisher`/
  `subscriber` 都只在启动时 connect 一次）；这属于更大的"Redis 客户端韧性"范畴，本轮
  作为已知限制记录，不在 F01 里展开。

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
