# 会话交接 — Sprint p15/04

## 当前已验证
- F04（AI Store 平台审核页）实现完成，自测通过，**尚未 passing**（本 worker 无权限自己标记，
  等 `pnpm harness verify --sprint p15/04` 门控）：
  - `pnpm --filter @repo/web exec playwright test e2e/admin-003-ai-store-approval.spec.ts`
    最终 8/8 通过（一次稳健跑：7 passed + 1 flaky-but-passed，flaky 原因是环境 DB 抖动，
    非代码逻辑问题，详见下方"仍损坏或未验证"）
  - `pnpm --filter @repo/data run typecheck`、`pnpm --filter @repo/web run typecheck`：通过
  - `pnpm --filter @repo/data run lint`、`pnpm --filter @repo/web run lint`：通过
  - `pnpm --filter @repo/web run test`：16/16 通过
  - `pnpm --filter @repo/auth run test`（隔离单跑）：15/15 通过

## 本轮改动
- `packages/data/src/aiStore.ts`: 新增 `listPlatformReviewItems`（平台审核队列列表：
  scope=platform 且 status ∈ {pending, approved}，支持状态筛选/搜索/分页）、
  `setAiStoreItemReviewStatus`（审核状态转移，乐观锁 `UPDATE ... WHERE status = 期望前置状态`，
  幂等重放不报错，前置状态不符返回 undefined 供调用方转 409）。
- `apps/web/app/api/admin/ai-store/route.ts`（新增）: GET 审核列表 API，`requireSysAdmin()` 门控。
- `apps/web/app/api/admin/ai-store/[id]/review/route.ts`（新增）: POST 审核状态切换 API
  （action=approve/reject/revoke），同一套门控 + 乐观锁 + 409 并发处理。
- `apps/web/app/(app)/admin/ai-store/review/page.tsx`: 从 F01 的 `ComingSoon` 占位整页重写为
  真实审核页（状态 Tab、搜索、列表、批准/拒绝/撤回、确认弹窗、loading/empty 态），
  视觉/交互对齐 F02（用户管理）/F03（团队管理）既有规范。
- `apps/web/e2e/admin-003-ai-store-approval.spec.ts`（新增）: 8 个测试用例，见 progress.md。
- 未触碰 F01（admin shell）、F02（用户管理）、F03（团队管理，`admin/teams/*`）、F05（AI Store
  精选页，`admin/ai-store/featured/*`，仍是 blocked 占位）范围。

## 仍损坏或未验证
- 无代码层面的已知问题（typecheck/lint/单测/e2e 全绿）。
- **环境/基础设施观测（与 sprint-03 记录的同一个已知问题，本轮再次遇到，仍未修复共享脚本）**：
  1. 本机同时运行 70+ 个 worktree 的 docker 容器（峰值 75 个容器，load average 一度
     23-39，机器仅 8 核）。本 worktree 独占的 postgres 容器在长跑 e2e/turbo 全量测试期间
     反复出现 `57P03 the database system is in recovery mode`（`Broken pipe` 级联终止 →
     自动恢复的 crash-loop，一次需要手动 `docker restart <容器>` 才打断循环）。
     不是 F04 代码回归——DB 处于稳定窗口时测试确定性通过（本轮验证：e2e 8/8、
     typecheck/lint 全绿、单元测试 31/31）。
  2. `pnpm -w run verify:base` 头两次整体跑都撞见 `@repo/auth` 的 bcrypt 计时测试
     （`password > hash 不等于明文，verify 正确匹配`）因主机 CPU 争用在 5000ms 内跑不完而
     超时失败；隔离单跑 `pnpm --filter @repo/auth run test` 确认 15/15 通过（981ms，远低于
     超时线）。这是 pre-existing 的计时脆弱测试，与本轮改动无关（本 worker 完全没碰
     `packages/auth`）。第三次整体跑的最终结果见下方"命令"小节及 evidence。
  3. 建议协调者跑 `pnpm harness verify --sprint p15/04` 前，先确认
     `docker inspect --format='{{.State.Health.Status}}' <本 worktree>-postgres-1`
     为 `healthy` 且稳定几秒，且当前机器 load 不是历史峰值窗口，避免误判代码回归。

## 下一步最佳动作
- F04 已实现 + 自测通过，PR 已开（Closes #138），标签已转 `status:in-review`。
- 下一轮/协调者：跑 `pnpm harness verify --sprint p15/04` 门控转 passing（若撞见环境层面的
  DB crash-loop，等恢复或 `docker restart` 后重试，不代表代码有问题）。
- F05（AI Store 精选页，`admin/ai-store/featured/*`）仍是 blocked 占位（F01 遗留的
  `ComingSoon`），不在本 sprint 范围，不要动。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p15/04`
  （需要先 export DATABASE_URL/REDIS_URL/E2E_PORT，取值见 `apps/web/.env.local`；
  harness 的 `sh()` 是裸 spawnSync，不会自动加载 `.env.local`）
- 调试: `pnpm --filter @repo/web exec playwright test e2e/admin-003-ai-store-approval.spec.ts --trace on`，
  失败后 `pnpm --filter @repo/web exec playwright show-trace <trace.zip 路径>` 看具体 DOM/网络时序。
  若怀疑是环境 DB crash-loop 而非代码问题，先跑
  `docker inspect --format='{{.State.Health.Status}}' <本 worktree>-postgres-1`
  确认健康状态，必要时 `docker restart` 该容器打断循环后重试。
