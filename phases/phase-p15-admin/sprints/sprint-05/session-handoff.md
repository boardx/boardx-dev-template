# 会话交接 — Sprint p15/05

## 当前已验证
- F05（AI Store 官方精选页）实现完成，自测通过，**尚未 passing**（本 worker 无权限自己标记，
  等 `pnpm harness verify --sprint p15/05` 门控）：
  - e2e: `pnpm --filter @repo/web exec playwright test e2e/admin-004-featured-ai-store.spec.ts`
    9/9 一次性干净通过，无重试、无 flaky。
  - `pnpm --filter @repo/data run typecheck` + `pnpm --filter @repo/web run typecheck`：均通过。
  - `pnpm --filter @repo/data run lint` + `pnpm --filter @repo/web run lint`：均通过。
  - `pnpm -w run verify:base`：45/45 全部通过，无回归。

## 本轮改动
- `packages/data/src/aiStore.ts`: 新增 `listFeaturedCandidateItems`（精选候选列表：
  scope=platform 且 status=approved，支持 featured/搜索/分页筛选）、`setAiStoreItemFeatured`
  （精选切换，`UPDATE ... WHERE scope='platform' AND status='approved'` 原子校验+写入，
  幂等重放不报错，未命中——非 platform/非 approved——返回 undefined 供调用方转 409）。
- `apps/web/app/api/admin/ai-store/featured/route.ts`（新增）: GET 精选候选列表 API，
  `requireSysAdmin()` 门控。
- `apps/web/app/api/admin/ai-store/[id]/featured/route.ts`（新增）: POST 精选切换 API
  （featured: boolean），同一套门控 + 原子校验 + 409 处理。
- `apps/web/app/(app)/admin/ai-store/featured/page.tsx`: 从 F01 的 `ComingSoon` 占位整页
  重写为真实精选页，**复用 F04 审核页的资源管理布局**（notes 明确要求）：标题区、
  Tab（精选/未精选筛选，替代 F04 的 pending/approved 状态 Tab）、搜索筛选区、列表、
  loading/empty 态；卡片操作从 F04 的批准/拒绝/撤回按钮改为单一星标切换按钮。
- `apps/web/e2e/admin-004-featured-ai-store.spec.ts`（新增）: 9 个测试用例，见 progress.md。
- 未触碰 F01（admin shell）、F02（用户管理）、F03（团队管理）、F04（审核页，
  `admin/ai-store/review/*`）范围。

## 仍损坏或未验证
- 无代码层面的已知问题（typecheck/lint/e2e/verify:base 全绿）。
- **分支基础注意事项**：本 PR 的 diff 基于 `origin/harness/coord-flip-p15-f04`
  （PR #217：F04 门控翻 passing + F05 认领派发），而非纯 `origin/main`——因为发现 main
  上 F05 仍是 `blocked/owner:null`（F04 尚未 passing）。若 #217 尚未合并 main 时本 PR
  先被处理，`phases/phase-p15-admin/feature_list.json` 里 F04/F05 的 status/sprint/owner/evidence
  字段可能与本 PR 的假设不一致，需要人工核对合并顺序（建议先合 #217 再合本 PR）。

## 下一步最佳动作
- F05 已实现 + 自测通过，PR 待开（对 `main`）。
- 下一轮/协调者：确认 #217 已落地 main 后，跑 `pnpm harness verify --sprint p15/05`
  门控转 passing。
- F05 范围内的 `admin/ai-store/featured/*` 已是真实实现，不再是占位；不要再改动 F01-F04
  涉及的文件（`admin/ai-store/review/*`、用户管理、团队管理）。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p15/05`
  （需要先 export DATABASE_URL/REDIS_URL/E2E_PORT，取值见 `.env`；
  harness 的 `sh()` 是裸 spawnSync，不会自动加载 `.env`）
- 调试: `pnpm --filter @repo/web exec playwright test e2e/admin-004-featured-ai-store.spec.ts --trace on`，
  失败后 `pnpm --filter @repo/web exec playwright show-trace <trace.zip 路径>` 看具体 DOM/网络时序。
