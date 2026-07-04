# 会话交接 — Sprint p8/02

## 当前已验证
- **F05 passing（sprint p8/02 收尾，phase p8-collaboration 全部 5 个 feature 完成）**：
  连接状态、断线重连与同步指示。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-reconnect.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/02 --feature F05`（含 verify:base）
  - 证据：`evidence/F05.verify.log`
- **F04 passing**：跟随协作者视角（暂停/恢复/停止 + 被跟随提示）。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-follow.spec.ts`
  - harness 门控：`pnpm harness verify --sprint p8/02 --feature F04`（含 verify:base）
  - 证据：`evidence/F04.verify.log`
  - 原实现（PR #343）审计结论是"质量已达标，无阻断项"，本轮只是 rebase 到新的
    F02(#365)/F03(#367) 之上——presence.tsx 里 F03 引入的 cursor 渲染块跟 F04 新增的
    followingId/followPaused/followers 等内容在同一文件里有交叠，手动合并（而不是
    直接 apply patch）、逐处核对无遗漏。功能代码本身未做改动。
- **F03 passing**：在线成员头像 + 实时光标。
  - 验证命令：`docker compose -f infra/docker-compose.yml up -d`
  - 验证命令：`pnpm --filter @repo/data run migrate`
  - 验证命令：`pnpm --filter @repo/web exec playwright test e2e/collab-presence-cursors.spec.ts`
  - 单测：`pnpm --filter @repo/web run test -- collab-bus`（4 用例）
  - harness 门控：`pnpm harness verify --sprint p8/02 --feature F03`（含 verify:base）
  - 证据：`evidence/F03.verify.log`

## 本轮改动（coord-collab，2026-07-04，rebase 自原 PR #342 + 修复坐标 bug）

### 背景
原实现（PR #342，wrk-codex-collab-1）build 在已废弃的 F02 快照方案（PR #335）之上，
且 review 发现一个真实正确性 bug：光标坐标广播的是发送方的原始 `clientX/clientY`
（屏幕像素），接收端用 `position:fixed` 原样渲染——双方窗口尺寸或画布 pan/zoom
不同时，光标位置会跟真实指向对不上。身份伪造风险方面原实现是对的（identity 由
服务端 `currentUser()` 派生，不信任请求体），未改动。

本轮：把 #342 的 presence/cursor 部分（`presence.tsx`/`presence/route.ts`/
`collab-bus.ts`/`lib/presence.ts`/e2e）单独抽出（这部分不依赖 F02 的快照方案，
只是 build 在同一条 stack 上），rebase 到新的 F02 实现（#365）之上，再修坐标 bug。

### 坐标转换修复
- `apps/web/lib/collab-bus.ts` 新增 `screenToBoardPoint`/`boardPointToScreen`/
  `viewportContainerRect`：转换公式跟 `canvas-viewport.tsx` 的
  `translate(tx,ty) scale(scale)`（transformOrigin: 0 0）严格对应。
  - 发布光标前（`board-canvas.tsx` 的 `publishLocalCursor`）：屏幕坐标 → 画布逻辑坐标。
  - 渲染他人光标前（`presence.tsx`）：画布逻辑坐标 → **观察者自己**的屏幕坐标
    （用观察者自己的 pan/zoom，不是发送方的）。
  - 纯数学（`screenToBoardPoint`/`boardPointToScreen`）跟 DOM 查询
    （`viewportContainerRect`）分开——前者不碰 `document`，调用方（本来就在浏览器里
    跑）负责传入容器矩形。这样单测不需要 jsdom（仓库目前没有这个依赖，也没有引入
    的必要）。
- 新增 `apps/web/lib/collab-bus.test.ts`（4 用例）：验证 scale=1 时互为逆运算、
  接收端 scale 变化会改变渲染位置（这条断言在旧实现下会失败——旧实现完全不看
  接收端自己的视口）、双方 pan/zoom 都不同时仍能还原成同一个逻辑点、容器矩形
  拿不到时优雅退化。**这是本轮唯一验证坐标数学本身的地方**：曾经尝试过在 e2e 里
  用"B 缩放后光标位置应该变化"做端到端断言，数学上完全正确（debug log 反复确认
  `boardPointToScreen` 算出的新旧值确实不同），但在这台并发跑着几十个 worktree
  的机器上有实测的 ~1/3 概率因为 1.5s presence 心跳 + React 重渲染的时序余量不够
  而超时——换成直接测转换函数本身，快、确定、不依赖真实浏览器渲染时序。
- 其余 presence/cursor 逻辑（心跳携带 cursor 字段、闲置 2500ms 自动隐藏、
  溢出列表、只读访问者可观察不可编辑）沿用原实现，未改动。

## F05 本轮改动（coord-collab，2026-07-04，重新设计而非 rebase）

### 背景
原实现（PR #344）build 在已废弃的 F02/F03/F04 快照链上，且首轮 review 抓到真实
bug：重连是固定 1.5s 无限重试、无退避，也不区分"鉴权失败(该停)"与"网络抖动
(该重试)"——F01 现在会在 session 失效时对 upgrade 返回 401，一个 session 过期
的客户端会陷入每 1.5s 重试一次、每次都被拒绝的死循环。`window.__boardCollabWs`
也无条件挂到 window 上。本轮不是简单 rebase，是在新的 F02 WS 效果基础上重新
设计 reconnect 状态机。

### 实现
- `apps/web/components/board/board-canvas.tsx` 的 WS `useEffect` 改造：
  - **指数退避**：close/error 后 1s→2s→4s...封顶 30s 重试，连上一次就把退避
    计数器复位（不是旧版固定 1.5s 无限重试）。
  - **鉴权失败识别**：浏览器原生 WebSocket 拿不到握手失败的真实 HTTP 状态码
    （401 也只是笼统的 error/close），所以每次重连前先探一下现成的
    `/api/auth/session`——没登录就发布 `disconnected` 后直接停止自动重连（重试
    一个必然被拒绝的连接没有意义，需要用户重新登录）；探测本身失败（网络问题）
    则当作暂时性抖动，照常走退避重试。
  - `window.__boardCollabWs` 改为仅 `process.env.NODE_ENV !== "production"` 时
    暴露（e2e 靠它模拟断线；生产环境不再让任意脚本能读到/关闭这个内部连接）。
- `apps/web/lib/collab-bus.ts` 新增 `publishConnectionState`/`subscribeConnectionState`
  （`CollabConnectionState = "connecting"|"connected"|"disconnected"`），
  `presence.tsx` 订阅并映射进 Header 同步指示：`disconnected→offline`，
  `connecting`(或原有的 syncing)`→saving`，其余`→synced`。
- `apps/web/components/board/sync-status.tsx`：offline 态文案改成"连接异常"
  （原来是"离线"，跟 issue 的 UI 契约用词对齐）。
- 新增 `apps/web/e2e/collab-reconnect.spec.ts`（2 用例）：
  1. 断连后 Header 显示"连接异常"，指数退避重连后恢复"已同步"且继续正常同步；
     协作者离线后头像/光标从对方画布移除。
  2. **服务端登出 + 断连**：验证不会自动恢复成 synced（观察窗口覆盖至少两轮
     退避），证明鉴权失败后确实停止了自动重连，不是理论上停了实际还在打。

## 仍损坏或未验证
- dev 模式下偶尔仍能看到 F02 引入的 "Yjs was already imported" 警告；截至本轮
  未观察到对应的功能故障（详见 p8/01 的 session-handoff.md）。
- 光标坐标转换假设 `canvas-viewport` 元素挂载在标准布局下；如果未来某个页面把
  canvas 包进 iframe/shadow DOM，`document.querySelector` 会失效——目前退化为
  原样透传（不崩溃，但坐标会错），不是本轮场景，先记录。
- Redis 断线后网关不会自动重连+重新订阅（F01 的已知限制，见 p8/01 session-handoff）；
  客户端侧的重连退避解决的是"WS 连接本身"的韧性，不是"网关到 Redis"这段的韧性——
  两者是独立的失败面，F05 只覆盖前者。
- 这台机器同时跑着几十个 worktree，playwright webServer 首次启动偶发 120s 超时
  （已实测遇到一次，重跑即过，跟本轮改动无关）；e2e 稳定性以单次干净通过 + 多轮
  复测为准，不代表在资源紧张时不会碰到基础设施层面的超时。

## Phase p8-collaboration 收尾
F01-F05 全部 passing。整条 stack 是这次会话从零 review、发现并修复多个真实 bug
（F01 的 WS 零鉴权/Redis 全局 channel/进程崩溃风险，F02 的"根本没用 Yjs"+ CRDT
结构不同源导致合并失败 + 网关信封解析 bug，F03 的光标坐标未做画布空间转换，
F05 的重连风暴风险）后重新实现/rebase 出来的：
- #332(F01) → #365(F02，重做非 rebase) → #367(F03，rebase+修 bug) →
  #368(F04，纯 rebase) → 本次 F05 PR（重做非 rebase）。
- 全部走 harness verify 门控转 passing，全部转交 coord-main 复核合并，本会话
  未自行合并任何 PR。
- 原实现者 wrk-codex-collab-1（codex）的 PR #332/#335/#342/#343/#344 均已在
  对应位置留言说明替代关系并建议关闭；#343（F04）明确标注"实现质量本身是好的，
  仅因 base 链需要替换"。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/02`
- 调试:`pnpm --filter @repo/web run test -- collab-bus`（坐标转换单测，最快的反馈回路）
