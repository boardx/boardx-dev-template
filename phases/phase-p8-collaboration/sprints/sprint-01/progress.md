# 进度日志 — Sprint p8/01

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-worktrees/issue-291-collab-yjs-sync`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: sprint p8/01 已完成；下一步进入 p8/02 F03（在线成员头像 + 实时光标）
- 当前 blocker: 无

## 会话记录
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

### 2026-07-04 04:18
- 本轮目标: 完成 F02（协作者之间的 board item 实时同步）。
- 已完成: F02 → passing（harness verify 门控通过）。`BoardCanvas` 在现有 REST 持久化后通过
  F01 的 WebSocket + Redis gateway 广播 board item snapshot，同 board 其它在线页面收到后即时
  合并到画布；保留原 1.5s 轮询作为降级/重连兜底。新增 `/api/collab/config` 给浏览器暴露当前
  worktree 的 collab gateway URL；新增 `e2e/collab-realtime-sync.spec.ts` 覆盖协作者创建/移动/
  编辑/删除同步，以及 public viewer 只读观察 + 写入 403。
- 运行过的验证: `pnpm --filter @repo/web exec tsc --noEmit`；
  `docker compose -f infra/docker-compose.yml up -d`；
  `pnpm --filter @repo/data run migrate`；
  `pnpm --filter @repo/web exec playwright test e2e/collab-realtime-sync.spec.ts`（2 passed）；
  `pnpm harness verify --sprint p8/01 --feature F02`（包含 `verify:base`，通过）。
  pre-push `verify:full` 已过 `verify:base`、Next production build、docker/migrate，随后在非 p8/collaboration 的
  `ai-store-001-browse-items.spec.ts:94` 分页用例和 `ai-store-003-subscribe-use-item.spec.ts:13`
  订阅流程失败；已按循环规则记录并跳过。
- 已记录证据: evidence/F02.verify.log
- 提交记录: 待提交
- 已知风险或未解决问题: repo-wide `verify:full` 仍被 ai-store e2e 阻塞；F02 未改动 `apps/web/lib/presence.ts` / `apps/web/lib/collab-bus.ts`；
  在线光标、awareness、跟随视角、断线重连指示仍留给 p8/02。当前实时同步用 gateway text
  frame 承载 JSON snapshot，未引入新的 binary/Yjs provider 协议；gateway 本身仍未做 WS 层鉴权，
  编辑权限仍由现有 REST API 门控。
- 下一步最佳动作: 开始 p8/02 F03（在线成员头像 + 实时光标），基于当前 item 同步通道补 awareness。
