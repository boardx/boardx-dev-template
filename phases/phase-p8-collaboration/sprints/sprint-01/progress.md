# 进度日志 — Sprint p8/01

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-worktrees/issue-290-collab-transport`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 / Yjs 实时同步组件变更
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
