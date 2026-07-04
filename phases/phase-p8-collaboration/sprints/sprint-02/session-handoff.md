# 会话交接 — Sprint p8/02

## 当前已验证
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

## 仍损坏或未验证
- dev 模式下偶尔仍能看到 F02 引入的 "Yjs was already imported" 警告；截至本轮
  未观察到对应的功能故障（详见 p8/01 的 session-handoff.md）。
- 光标坐标转换假设 `canvas-viewport` 元素挂载在标准布局下；如果未来某个页面把
  canvas 包进 iframe/shadow DOM，`document.querySelector` 会失效——目前退化为
  原样透传（不崩溃，但坐标会错），不是本轮场景，先记录。

## 下一步最佳动作
- F05（重连状态，issue #294）：需要重连退避 + 区分"鉴权失败(该停)"与"网络抖动
  (该重试)"，rebase 到本次的 F04 PR 之上再做（reconnect 状态机需要重新设计，
  详见 p8/01 F01 review 里对 #344 的审计结论）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p8/02`
- 调试:`pnpm --filter @repo/web run test -- collab-bus`（坐标转换单测，最快的反馈回路）
