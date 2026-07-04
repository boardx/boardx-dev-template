# 会话交接 — Sprint p8/01

## 当前已验证
- **F01 passing**：WebSocket + Redis 广播骨架（不含 Yjs 语义）。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-transport-skeleton.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/01 --feature F01`（包含 `verify:base`）
  - 证据：`evidence/F01.verify.log`
- **F02（Yjs 实时同步组件变更）本轮重做，待 harness verify 门控**：原实现（PR #335）
  没有真正的 Yjs/CRDT（详见下方"背景"），本轮 coord-collab 在 F01 修复完的基础上重新
  实现。验证命令与证据见下方"F02 本轮改动"小节。

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

### 第三轮修复：board 归属授权（review 阻断，2026-07-04）
第二轮修复（a10ec97）明确把"只校验登录、不校验 board 归属"记录为已知边界、留给
F02+——但后续 review 裁决**不接受这个骨架期妥协**（参考先例 #327：这类骨架层的
授权缺口一旦被上层 feature 接上真实内容，后果不是"看到别人光标"，而是任意登录
用户能读写别人 board 的真实文档；现在修的成本是加一次 membership 校验，等 F02-F05
建完再回头修，成本是重新设计整条数据流）。而且原 e2e 测试**把这个越权行为固化成了
通过用例**（两个完全无关的独立用户，凭空捏造一个从不落库的 boardId，断言能互相
收发）——这是本轮修复前必须先看到并承认的真实疏漏，不是"按原计划推进"。

修复：
- 新增 `apps/web/app/api/collab/authorize/route.ts`：`GET ?boardId=`，复用
  `currentUser()` + 仓库里其它 board 路由统一用的 `getBoardAccessRole(boardId, userId)`
  （`packages/data/src/board.ts`）。未登录 401；登录但对该 board 无权限（非
  owner/编辑者/可见 viewer）403；有权限 200。
- `collab-gateway.mjs` 的 `isAuthenticated` 改名/改造为 `authorizeUpgrade(req, boardId)`，
  改调这个新端点（一次 HTTP 往返同时校验登录态+board 归属，不再是两次独立检查）；
  按端点返回的 401/403 分别回对应状态码给客户端，不再统一 401。
- 重写 `collab-transport-skeleton.spec.ts`：不再用凭空捏造、从不落库的 boardId；
  改成建真实 room+board，测试用户要么是 owner 要么被邀请为合法成员。新增**负向
  用例**：已登录但不是该 board 成员 → upgrade 必须 403（这条用例在旧实现下会
  失败，是本次修复的直接回归保护）。

### 已知边界（本轮仍不展开，属于更大范畴）
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

## F02 本轮改动（coord-collab 重做，2026-07-04）

### 背景：为什么重做而不是修 PR #335
PR #335（原实现，wrk-codex-collab-1）没有用 Yjs——是"每次变更 REST 写入 → 重新
GET 全部 items → 广播完整数组，接收端整体替换"的全量快照 last-writer-wins，且
`feature_list.json` 在 base 链仍 changes-requested 时就被自行标成 `passing`。这不是
局部 bug，是没有实现 issue 要求的东西（`packages/collab`、per-board Yjs doc、字段级
patch）。coord-collab review 意见见 PR #335 评论；本轮基于修复完的 F01 分支重新实现，
不是在 #335 上打补丁。

### 实现
- 新增 `packages/collab`（`yjs` 作为真实生产依赖，放在这个包自己的 `dependencies`
  里——仓库里其它包（queue 用 bullmq、storage 用 @aws-sdk）也是"业务型第三方依赖放
  对应包"的先例，符合惯例，不是破例）：
  - 每个 item 是顶层 `items` Y.Map 里一条记录，value 是嵌套 Y.Map（字段级：x/y/w/h/
    text/type/color）——两人同时改同一 item 的不同字段会正确合并，同字段并发修改
    是 Yjs 内置 LWW（不是字符级 OT，符合 issue notes"字段级 patch"的粒度）。
  - `seedItems`/`upsertItem`/`removeItem`/`readItems`/`syncItemsIntoDoc`：REST ↔ doc
    的双向同步原语；`encodeUpdate`/`decodeUpdate`/`applyEncodedUpdate`/`encodeFullState`：
    浏览器安全的 base64 编解码（不依赖 Buffer）+ 增量/全量 update 的 Yjs 包装。
  - `packages/collab/src/index.test.ts`（6 个用例）：验证两个独立 doc 通过 update
    广播收敛、字段级并发合并、删除广播、`syncItemsIntoDoc` 幂等不产生反馈环。
    **这组测试在开发过程中真的抓到一个设计缺陷**：如果两个客户端各自独立从 REST
    `seedItems` 出同一个 item，会各自造出结构上互不相识的 Y.Map 实例，之后的字段级
    增量 update 会因为对方找不到共同祖先而静默丢失、永远不生效。修复：新客户端加入
    时先广播 `y-sync-request`，等已在线的客户端回一份 `encodeFullState`（完整状态）
    applied 进来，才 `seedItems` 补上"还没被任何在线客户端带入 doc"的纯新增项——
    保证多个客户端操作的是同一批结构实例，不是"看起来一样但互不相识"的复制品。
- `apps/web/app/api/collab/config/route.ts`：新端点，返回 `{ wsUrl }`（`COLLAB_WS_PORT`
  拼出来），客户端用它找到 F01 的 collab-gateway。不做鉴权——URL 本身不敏感，真正的
  鉴权门槛在 gateway 的 upgrade 握手（F01 的 `isAuthenticated`）。
- `apps/web/components/board/board-canvas.tsx`：
  - 新增 `docRef`（本 board 的 Yjs doc）+ WS 连接（复用 F01 gateway，走
    `/api/collab/ws?boardId=...`，浏览器会自动带上 session cookie，跨端口同域名下
    cookie 不区分端口）。连上后先发 `y-sync-request` 问房间里有没有已在线的人，
    800ms 内有回应就 `applyEncodedUpdate` 合并对方的完整状态，没有就当自己是第一个、
    直接从 REST 结果 `seedItems`。
  - **本地 items 状态完全没有大改**：所有既有的 `addNote`/`onDragMove`/`setColor`/
    撤销重做等操作，一个字都没动，仍然是原来的 `setItems` 调用。新增的是一个单一
    择点的 `useEffect(() => syncItemsIntoDoc(doc, items), [items])`——不管 items 变化
    来自用户操作、旧的 REST 轮询兜底、还是本文件自己从 doc reconcile 回来的，都会
    镜像进 doc（`syncItemsIntoDoc` 对没有真变化的字段是幂等的，不会造成广播反馈环）。
    这个"单一收敛点"设计是刻意的：改动面小、回归风险低，不需要把 F02 的字段级 patch
    语义手动塞进十几个既有的鼠标/键盘事件处理函数里。
  - `mergeRemoteItems(prev, latest, editingId, dragIds)`：远端变更合并回 React state 时，
    正在被本地编辑/拖拽的那一条保留本地版本（不被打断）；`editingId` 转回 `null` 的
    瞬间会强制拿 doc 当前真实状态 reconcile 一次——这是相对旧方案"编辑中收到的变更
    要等到下一次远端事件才可能显示、否则永久不显示"的修复点。
  - 保留了原有的 1.5s REST 轮询兜底（`uc-canvas-005`）完全不变，作为 WS 层如果哪里
    没覆盖到的安全网，双保险。
- `apps/web/e2e/collab-realtime-sync.spec.ts`：沿用 PR #335 已经写好的两个用例（创建/
  移动/编辑/删除同步、只读访问者），新增第三个用例专门验证"一个便签编辑中不阻塞
  另一个便签的实时同步"——用 1.2s 的紧凑超时（明显短于轮询的 1.5s 周期），确保这条
  用例测的是 Yjs/WS 路径本身，不是被轮询兜底悄悄救回来的假阳性。

### 开发过程中抓到的第二个真实 bug（不是设计缺陷，是纯代码 bug）
F01 的 collab-gateway 转发其它客户端消息时会包一层自己的信封：
`{ type: "message", boardId, data: "<发送方原始文本>", fromClientId, via }`
（`connected` 这类网关自己直接发的消息不走这层）。第一版 board-canvas.tsx 的 WS
message handler 只 `JSON.parse`了一层，拿信封的 `type`（恒为 `"message"`）去匹配
`"y-update"`/`"y-sync-request"` 等业务类型，永远匹配不上——**这个 bug 一度被同文件
里原有的 1.5s REST 轮询完全掩盖**：所有依赖跨客户端同步的用例都"意外通过"，因为
真正干活的是轮询，不是 Yjs。是"一个便签编辑中不阻塞另一个"这个新用例（利用轮询在
编辑期间会被 `!editingId` 挡住这一点）第一次让这个 bug 现出原形。教训记在这里供
以后碰同一个网关协议的人参考：**收到的每条消息都要先判断 `outer.type === "message"`
再 `JSON.parse(outer.data)` 取真正的业务 payload，不能只解一层。**

### 已知非阻断项（记录，不在本轮展开）
- dev 模式下偶尔能看到 Next 输出一行 `Yjs was already imported. This breaks
  constructor checks...`（yjs 官方已知的重复导入警告）。连续跑了两轮共 9/9 次 e2e
  全部稳定通过，未观察到与之对应的实际功能故障；怀疑是 Next.js dev 模式对
  `"use client"` 组件做 server/client 两套图遍历时的编译期噪音，不是真的运行时
  双实例互相调用。留意：如果之后出现难以解释的 Yjs 内部状态异常，先怀疑这里。
- Join-sync 只是"问房间里有没有人，有就同步，没有就算了"，不是完整的 Yjs sync
  protocol（不做 state vector 差量比对）。多人房间下第一个已连接的人回应即可，
  够用；真要接多实例网关水平扩展、或允许"断线很久之后回来要精确补齐"这类更强
  的持久化/重放语义，需要另开一个 feature，不在 F02 范围内。
- `mergeRemoteItems` 的"正在编辑/拖拽"保护粒度是整条 item，不是单个字段——如果
  A 在编辑某 item 的文本，同时 B 改了同一个 item 的颜色，B 的颜色变更要等 A
  编辑结束才会显示在 A 屏幕上（不会丢，只是延迟）。真正的字段级实时预览需要更
  细粒度的 UI 层改造，超出本 feature 范围。

## 下一步最佳动作
- F02 已重做完成，按顺序推进 F03（presence 光标坐标转换 bug）→ F04（rebase 验证，
  质量已达标）→ F05（重连退避 + 鉴权失败识别）。这三个都 build 在 F02 之上，需要
  先 rebase 到本次的新实现（旧的 #342/#343/#344 分支是 build 在 PR #335 的快照方案
  之上的，rebase 时注意 board-canvas.tsx 是共享热点）。
- 不要在后续 feature 里重写现有 `apps/web/lib/presence.ts` / `apps/web/lib/collab-bus.ts`
  的 UI 语义；它们是现有页面内/presence 临时机制，替换时机应随 F03-F05 分层推进。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/01`
- 调试:`COLLAB_WS_PORT=3001 REDIS_URL=redis://localhost:6379 node apps/web/server/collab-gateway.mjs`
- F02 单测:`pnpm --filter @repo/collab test`
