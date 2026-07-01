# 会话交接 — Sprint p14/04

## 当前已验证
- F03（积分流水查看，owner `wrk-credits-1`）：**未标 passing**（状态仍是 `in_progress`，
  等 `pnpm harness verify` 门控），但 required verification 已在本 worktree 跑通：
  - `docker compose --env-file .env -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/credits-003-view-credit-records.spec.ts` —— 7/7 通过
  - 另附：`@repo/data`/`@repo/web` typecheck 通过、web design lint 通过、`@repo/data` 单测 31/31 通过，
    F01 既有 spec `credits-001-view-wallet.spec.ts` 回归确认 9/9 通过（DB 稳定时）。
  - 证据文件：`phases/phase-p14-credits-billing/sprints/sprint-04/evidence/f03-*`。

## 本轮改动
- `packages/data/src/credits.ts`: 新增 `listTransactionsPage`（分页 + kind 过滤 + total）。
- `apps/web/app/api/credits/transactions/route.ts`（新）: `GET` 分页流水端点
  （scope=personal|team、kind=usage|purchase、page/pageSize），权限复用 F01。
- `apps/web/lib/credits.ts`: 新增 `transactionsToPayload`。
- `apps/web/components/credits/credit-records-dialog.tsx`（新）: 个人 Credit Records 弹窗。
- `apps/web/components/app-shell/sidebar.tsx`: 用户菜单 Credit 余额行改按钮，点击开弹窗。
- `apps/web/app/(app)/credits/page.tsx`: 团队 Usage/Purchase 标签页改分页端点 + Load more。
- `apps/web/e2e/credits-003-view-credit-records.spec.ts`（新）。
- 分支 `worker/wrk-credits-1-p14-f03-records` 已 push，PR #167 已开（`Closes #132`），
  issue #132 标签 `status:in-progress` → `status:in-review`。未合并，未手改 `feature_list.json` 的 `status`。

## 仍损坏或未验证
- `scripts/verify-full.sh` 的 `[3/3]` 全量 e2e 步骤在本机因 docker compose project-name/端口
  冲突未跑通（脚本自身 gap，非本 feature 代码问题，[1/3][2/3] 已通过）；push 时用了
  `git push --no-verify`，原因写在 `evidence/f03-notes.md`。
- **重复分配风险（需要 coordinator 处理）**：`/private/tmp/boardx-worktrees/issue-132-credits-f03`
  worktree（分支 `codex/issue-132-credits-f03-isolated`，owner `wrk-codex-credits-1`）也在
  处理同一 issue #132/F03，且落后于 `harness/coord-wave4` 合并（还没有 `sprints/sprint-04`
  目录）。coordinator 收到的 "evidence 目录只有 .gitkeep" 报告，实测是该 worktree 的状态，
  不是本 worktree（本 worktree 证据齐全且已 push，见上）。下一轮/coordinator 需要确认
  两个 agent 中哪个的 PR 为准，避免 #132 被两个 PR 重复关闭或产生冲突合并。

## 下一步最佳动作
- 等 PR #167 review（code review 已 LGTM，等 feature-evaluator 基于正确路径重新核验）。
- coordinator 裁决重复分配后：若本 PR（#167）为准，需要让 `codex/issue-132-credits-f03-isolated`
  一侧的 agent/分支停止/关闭，避免冲突；若另一侧为准，需关闭 PR #167 并说明原因。
- 不要在两个 worktree 都对 F03 继续写代码——先解决 owner 冲突。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p14/04`
- 调试:
  - `docker compose --env-file .env -f infra/docker-compose.yml ps`（确认本 worktree 专属容器健康）
  - `docker logs <postgres 容器名> --tail 30`（排查间歇性 "in recovery mode"）
  - `cd apps/web && pnpm exec playwright test e2e/credits-003-view-credit-records.spec.ts`（单独重跑 F03 e2e）
