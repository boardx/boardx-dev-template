# Session Handoff — Sprint p11/02

## 当前状态

F02 的实现已从旧独立 worktree 迁移到最新基线 v2 worktree，并完成重新验证：

- Worktree: `/private/tmp/boardx-worktrees/issue-116-ai-store-f02-v2`
- Branch: `codex/issue-116-ai-store-f02-isolated-v2`
- 目标 issue: #116
- 基线: `origin/harness/coord-flip-passing-p9-p11-p13`
- 状态边界: `feature_list.json` 中 F01 保持 `passing`，F02 未手动改为 `passing`。

## 已验证命令

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @repo/data run migrate
pnpm --filter @repo/web exec playwright test e2e/ai-store-002-create-update-item.spec.ts
pnpm -w run verify:base
```

对应输出已在 v2 worktree 重新写入 `phases/phase-p11-ai-store/sprints/sprint-02/evidence/`。

## 关键改动

- `scripts/init-worktree-env.sh` 现在会写 `infra/.env`，让指定 compose 命令使用隔离 project/端口。
- `apps/web/playwright.config.ts` 会读取 `.env.local` 的 `E2E_PORT`，让指定 Playwright 命令使用隔离 dev server 端口。
- `packages/data/src/index.ts` 默认 DB 配置会读取仓库 env 文件；显式传入 env 的单测路径不受本地 env 污染。
- `packages/data/migrations/017_ai_store_item_config.sql` 添加 `ai_store_items.config`。
- `apps/web/app/(app)/ai-store/store-browser.tsx` 增加 Create/Authorized 创建与编辑 UI。
- `apps/web/app/api/ai-store/items/route.ts` 和 `[id]/route.ts` 增加 F02 API。

## 下一步

1. 由主流程决定是否运行 harness 状态门控，把 F02 从当前权威清单状态推进；不要手改为 `passing`。
2. 检查 diff 后提交/推送 v2 worktree 分支。
3. 后续 F03/F04/F05/F06 不在本轮范围内，当前实现只保留对应占位或不触碰。
