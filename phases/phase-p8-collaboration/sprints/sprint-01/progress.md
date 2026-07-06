# 进度日志 — Sprint p8/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next（本轮 worktree: wrk-collab-claude-1-p8-f02-yjs-sync）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F03（presence 光标坐标转换）
- 当前 blocker: 无（F02 已重做完成，待 harness verify 门控）

## 会话记录
### 2026-07-04 16:xx (owner: coord-collab / wrk-collab-claude-1)
- 本轮目标: F02（Yjs 实时同步组件变更）—— 原 PR #335 未真正实现 Yjs，重做。
- 已完成:
  - 新增 `packages/collab`（真实 `yjs` 依赖）：每 item 是字段级嵌套 Y.Map，
    `seedItems`/`upsertItem`/`removeItem`/`readItems`/`syncItemsIntoDoc` + base64
    编解码 + `encodeFullState`（加入房间时的完整状态同步，非增量 sync protocol）。
  - `packages/collab/src/index.test.ts`（6 用例）过程中抓到一个真实设计缺陷并修复：
    两个客户端各自独立 seedItems 出同一个 item 会造出结构不同源的 Y.Map，后续
    增量 update 互相合并不进去——修复为"加入时先问在线的人要完整状态"。
  - `apps/web/app/api/collab/config/route.ts`（新端点，下发 WS URL）。
  - `apps/web/components/board/board-canvas.tsx`：接入 Yjs doc + WS，单一收敛点
    `useEffect([items]) -> syncItemsIntoDoc` 把本地状态镜像进 doc，不改动任何既有
    鼠标/键盘事件处理函数；`mergeRemoteItems` 保护正在编辑/拖拽的 item 不被远端覆盖，
    `editingId` 清空瞬间强制 reconcile 一次（修复"编辑中变更可能延迟到下一次远端
    事件才显示"）。保留原有 1.5s REST 轮询兜底不变。
  - `apps/web/e2e/collab-realtime-sync.spec.ts`：沿用 PR #335 已写好的 2 个用例
    （创建/移动/编辑/删除同步、只读访问者），新增第 3 个用例（编辑中不阻塞其它
    item 同步），用 1.2s 紧凑超时排除"其实是轮询兜底救回来的假阳性"。
  - **过程中抓到第二个真实 bug**：F01 gateway 转发消息会包一层自己的信封
    `{type:"message", data:"<原始文本>", ...}`，第一版 WS message handler 只解了
    一层，导致所有业务消息类型永远匹配不上——被同文件里的 1.5s REST 轮询完全
    掩盖，直到新增的"编辑中不阻塞"用例（利用轮询期间会被 editingId 挡住）才
    第一次暴露。已修复为"先判断 outer.type==='message' 再解一层拿业务 payload"。
- 运行过的验证:
  - `pnpm --filter @repo/collab run typecheck` + `pnpm --filter @repo/collab test`（6 passed）
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web exec playwright test e2e/collab-realtime-sync.spec.ts`
    → 3 passed，连续跑 3 轮共 9/9 稳定（排查过 dev 模式下的 "Yjs was already
    imported" 警告，未观察到对应的功能故障，记为已知非阻断噪音）
  - `pnpm -w run verify:base` → 49/49 通过
- 已记录证据: evidence/F02.verify.log
- 提交记录: 分支 worker/wrk-collab-claude-1-p8-f02-yjs-sync（本次改动基于修复后的
  F01 tip 重新分支，非 stack 在原 PR #335 之上）
- 已知风险或未解决问题: 见 session-handoff.md「已知非阻断项」——join-sync 非完整
  sync protocol；编辑/拖拽保护粒度是整条 item 不是单字段；Yjs 重复导入警告待观察。
- 下一步最佳动作: F03（presence 光标坐标转换 bug）→ F04（rebase 验证）→ F05（重连
  退避 + 鉴权失败识别）；F03-F05 需要 rebase 到本次的新 F02 实现（原分支是 build 在
  PR #335 快照方案之上的）。

### 2026-07-04 03:50
- 本轮目标: 完成 F01（WebSocket + Redis 广播骨架，不含 Yjs 语义）。
- 已完成: F01 → passing（harness verify 门控通过）。新增 `apps/web/server/collab-gateway.mjs`
  作为轻量 WS sidecar，使用 Redis pub/sub channel `boardx:collab:transport` 做跨客户端广播；
  Playwright webServer 现在同时启动 Next dev 与 collab gateway。`scripts/init-worktree-env.sh`
  新增 `COLLAB_WS_PORT`，并修复原有 `${compose_env}` echo 在 zsh/bash 下的非 ASCII 相邻解析问题。
- 运行过的验证: `node --check apps/web/server/collab-gateway.mjs`；
  `docker compose -f infra/docker-compose.yml up -d`；
  `pnpm --filter @repo/web exec playwright test e2e/collab-transport-skeleton.spec.ts`（2 passed）；
  `pnpm harness verify --sprint p8/01 --feature F01`（包含 `verify:base`，通过）。
  pre-push `verify:full` 已过 `verify:base` 与 `next build`，随后在非 p8/collaboration 的
  `ai-store-001-browse-items.spec.ts` 分页用例失败，已按循环规则记录并跳过。
- 已记录证据: evidence/F01.verify.log
- 提交记录: 待提交
- 已知风险或未解决问题: F01 只验证裸传输层；未做 Yjs/CRDT、awareness、权限模型或消息持久化。
- 下一步最佳动作: F02 在该 WS+Redis 传输骨架上实现 Yjs 实时同步组件变更。
