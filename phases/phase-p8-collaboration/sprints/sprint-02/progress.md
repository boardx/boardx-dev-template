# 进度日志 — Sprint p8/02

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next（本轮 worktree: wrk-collab-claude-1-p8-f04-follow）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F05（重连状态：退避 + 鉴权失败识别）
- 当前 blocker: 无

## 会话记录
### 2026-07-04 (owner: coord-collab / wrk-collab-claude-1) — F04
- 本轮目标: F04（跟随协作者视角）—— 原实现（PR #343）审计结论质量已达标、无
  阻断项，只需 rebase 到新的 F02(#365)/F03(#367) 之上。
- 已完成:
  - isolate 出 #343 相对其原 base(#342) 的 diff，`canvas-viewport.tsx`/
    `collab-bus.ts`/`lib/presence.ts`/`presence/route.ts`/e2e 均可直接 apply；
    `presence.tsx` 因跟 F03 引入的 cursor 渲染块在同一文件有交叠，手动合并
    （逐处核对：followingId/followPaused 状态、pauseFollow/resumeFollow、
    followed-by-banner、following-banner 的暂停/恢复按钮）。
  - 功能代码本身未做任何改动——纯 rebase，不重复造轮子。
- 运行过的验证:
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-follow.spec.ts` →
    1 passed，连续跑 3 轮 3/3 稳定
  - `pnpm -w run verify:base` → 49/49
  - `pnpm harness verify --sprint p8/02 --feature F04` → 门控通过，F04 = passing
- 已记录证据: evidence/F04.verify.log
- 提交记录: 分支 worker/wrk-collab-claude-1-p8-f04-follow（base 是
  worker/wrk-collab-claude-1-p8-f03-presence-cursors）
- 已知风险或未解决问题: 无新增（继承 F02/F03 的已知边界，见对应 session-handoff）。
- 下一步最佳动作: F05（重连状态）——需要重新设计 reconnect 状态机（退避 + 区分
  鉴权失败/网络抖动），不是简单 rebase。

### 2026-07-04 (owner: coord-collab / wrk-collab-claude-1) — F03
- 本轮目标: F03（在线成员头像 + 实时光标）—— rebase 自原 PR #342，修复 review
  抓到的光标坐标转换 bug。
- 已完成:
  - 从原 PR #342（build 在已废弃的 F02 快照方案上）isolate 出 presence/cursor
    相关的 diff（不含 F02 部分），apply 到新的 F02 实现（#365）之上。
  - 修复坐标 bug：新增 `screenToBoardPoint`/`boardPointToScreen`（`lib/collab-bus.ts`），
    发布光标前转成画布逻辑坐标，渲染他人光标前用观察者自己的 pan/zoom 转回屏幕坐标。
  - 新增 `apps/web/lib/collab-bus.test.ts`（4 用例）直接测坐标数学，替代最初尝试的
    一个 e2e 缩放断言——那个断言数学上正确但在这台高并发机器上约 1/3 概率因心跳+
    重渲染时序余量不够而 flaky，改成不依赖真实浏览器渲染时序的单测更快更稳。
- 运行过的验证:
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web run test -- collab-bus`（4 passed）
  - `pnpm --filter @repo/web exec playwright test e2e/collab-presence-cursors.spec.ts`
    → 2 passed，连续跑 3 轮共 6/6 稳定
  - `pnpm -w run verify:base` → 49/49
  - `pnpm harness verify --sprint p8/02 --feature F03` → 门控通过，F03 = passing
- 已记录证据: evidence/F03.verify.log
- 提交记录: 分支 worker/wrk-collab-claude-1-p8-f03-presence-cursors（base 是
  worker/wrk-collab-claude-1-p8-f02-yjs-sync）
- 已知风险或未解决问题: 见 session-handoff.md「仍损坏或未验证」。
- 下一步最佳动作: F04（跟随控制）rebase 验证（原实现质量已达标，无阻断项）；
  之后 F05（重连退避 + 鉴权失败识别）。
