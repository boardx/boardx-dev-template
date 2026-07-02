# 会话交接 — Sprint p11/04

## 当前已验证
- F03「订阅并使用项目」实现已完成并本地验证通过（不是 passing——状态转移需协调者跑 `pnpm harness verify`）：
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-003-subscribe-use-item.spec.ts` → 2/2 passed
  - F01/F02/F04/F05 回归 e2e 全绿（20/20 passed）
  - `pnpm -w run verify:base` → 45/45 successful, exit 0

## 本轮改动
- `packages/data/migrations/019_ai_store_subscriptions.sql`（新表 ai_store_subscriptions）
- `packages/data/src/aiStoreSubscriptions.ts`（新文件，订阅仓储层）
- `packages/data/src/index.ts`（新增一行 export）
- `apps/web/app/api/ai-store/items/[id]/subscribe/route.ts`（新文件，POST/DELETE/GET）
- `apps/web/app/api/ai-store/items/route.ts`（新增 `?subscribed=me` 分支）
- `apps/web/app/(app)/ai-store/store-browser.tsx`（Subscribe/Use 按钮 + Subscribe nav 视图）
- `apps/web/app/(app)/ava/page.tsx`（新增 agentItemId/toolItemId 查询参数处理）
- `apps/web/e2e/ai-store-003-subscribe-use-item.spec.ts`（新 e2e 规格）
- `apps/web/e2e/ai-store-001-browse-items.spec.ts`（修正一条被 F03 上线后行为变更影响的过期断言）

## 仍损坏或未验证
- `apps/web/e2e/ava-chat-basic.spec.ts` 的 "空态建议" 用例失败：过期 testid `"suggestion"`，实际是 `"suggested-action"`。**确认是 origin/main 既有缺陷**，与本次 F03 改动无关，未在本次修复（已 spawn_task 开独立任务）。
- 「使用模板」目前只是 `router.push('/boards?template=<id>')` 占位——仓库没有「按模板建板」的后端管线（POST /api/boards 目前强制挂 room），这块基础设施本身不存在，属于超出 F03 范围（use case 文档明确排除「目标工具内部执行细节」）。Agent / AI Tool / Image Tool 的「使用」入口是完整可用的（真实带入 AVA 新会话）。
- 本机 Docker 容器数量大（70+，多个 worktree 并行）时 postgres 会反复崩溃重启，属环境资源问题，不是代码缺陷；已在稳定窗口下反复验证通过。

## 下一步最佳动作
- 协调者 review PR「worker/wrk-store-1-p11-f03-subscribe」，确认后跑 `pnpm harness verify --sprint p11/04` 把 F03 转 passing。
- 不要在本 feature 范围内动 aiStore.ts 的既有函数（wrk-store-2 的 F04/F05 逻辑在里面，已验证共存无冲突）。
- 若要做「模板 Use = 真正建板」，需要先设计一个不挂 room 的「新建板」入口，作为独立 feature 排期，不要塞进 F03 收尾。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p11/04`
- 调试:
  - `docker compose -f infra/docker-compose.yml up -d && docker exec <project>-postgres-1 pg_isready -U boardx`（确认 DB 稳定后再跑 e2e，本机资源紧张时需要重试等待）
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-003-subscribe-use-item.spec.ts`
