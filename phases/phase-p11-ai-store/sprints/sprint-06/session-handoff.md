# Session handoff — p11 F06（团队/项目审核与精选）

## 状态说明（重要）
- 本目录下只有 `progress.md` + `evidence/`（`sprint.md`/`active-features.json` 未生成）——
  这轮直接实现 F06 的代码/测试，未跑 `pnpm harness new-sprint`（claim 流程不在本轮范围）。
  `feature_list.json` 的 `status`/`owner`/`evidence` 字段未手动修改，也未自我标记 `passing`；
  状态推进留给 `pnpm harness verify` 门控。

## 本轮完成的工作
承接已有实现（`packages/data/src/aiStore.ts` 的
`listTeamPendingAiStoreItems`/`listTeamApprovedAiStoreItems`/`reviewTeamAiStoreItem`/
`setTeamAiStoreItemFeatured` 及三个既有路由中的两个）之外，本轮新增：

- `apps/web/app/api/teams/[id]/ai-store-featured/[itemId]/route.ts`
  — 之前缺失的精选切换路由。POST body `{ featured: boolean }`，团队管理角色
  （owner/admin，经 `canManageTeam`/`getMembership`）专属，调用
  `setTeamAiStoreItemFeatured`；不存在/非 published/跨团队一律 404。
- `apps/web/app/(app)/teams/[id]/ai-store-review/page.tsx`
  — 团队审核 + 精选页面（client component）。
  - `data-testid`：`team-ai-store-review-page`、`team-ai-store-forbidden`、
    `review-section`/`review-list`/`review-card-{id}`/`review-status-{id}`、
    `approve-{id}`/`reject-{id}`/`withdraw-{id}`、
    `featured-section`/`featured-list`/`featured-card-{id}`/`featured-badge-{id}`/
    `toggle-featured-{id}`、`confirm-modal`/`confirm-item-name`/
    `confirm-item-description`/`confirm-cancel`/`confirm-submit`、`action-message`。
  - 门控：GET 两个既有路由 401/403 时展示对应态（未登录跳 `/login`，非管理角色展示
    `team-ai-store-forbidden`，不渲染任何列表/操作）——即使直接访问 URL 也一样。
  - 审核通过/拒绝/撤回、精选切换均先弹确认弹窗（展示资源名称+描述），确认后才真正提交。
- `apps/web/app/(app)/teams/page.tsx`
  — 新增 `ai-store-review-entry` 区块（仅 `canManage` 为真时渲染），带
  `ai-store-review-link` 按钮跳转到 `/teams/{id}/ai-store-review`。非管理角色/未加入
  该团队时这个区块完全不渲染（不是仅置灰）。
- `apps/web/e2e/ai-store-006-approval-featured.spec.ts`（新增，5 个用例，真实
  Postgres + 真实 UI 点击，无 mock）：
  1. 未登录调用团队审核 API → 401。
  2. owner 提交团队项目审核 → 出现在 PENDING 队列 → 通过确认弹窗批准 → 发布 +
     移出队列 + 出现在精选列表 + 浏览接口确认 `status=published`。
  3. owner 拒绝审核项目 → 移出队列、不进精选 → 状态机校验（对已拒绝项目再调用
     `withdraw` 返回 404，因为只有 published 才能撤回）。
  4. owner 切换精选 on/off，UI 立即反映 `featured-badge`；对仍处 PENDING 的项目直接调用
     精选接口 → 404（精选只对已批准项目生效）。
  5. 非管理角色（默认邀请 role=member）团队页看不到 `ai-store-review-entry`；
     直接访问审核页 URL 展示 `team-ai-store-forbidden`；直接调用两个 GET API 均 403。

## 运行过的验证（均通过）
- `docker compose -f infra/docker-compose.yml up -d`
- `pnpm --filter @repo/data run migrate`
- `pnpm --filter @repo/web exec playwright test e2e/ai-store-006-approval-featured.spec.ts` — 5/5 passed
- `./init.sh`（内部跑 `pnpm -w run verify:base`：typecheck + lint + 单测）— 45/45 tasks passed，无回归
- `pnpm --filter @repo/web exec tsc --noEmit` 干净
- `pnpm --filter @repo/web run lint`（design lint）通过

证据日志：`phases/phase-p11-ai-store/sprints/sprint-06/evidence/F06.verify.log`
（`*.log` 被仓库 `.gitignore` 排除，未提交进 git，留在本 worktree 供复核；PR 描述里
也贴了同样的运行结果）。

## 提交 / PR
- 分支：`worker/wrk-store-2-p11-f06-review-featured`
- commit：`feat(ai-store): team review and featured toggle (P11 F06)`（3276e75）
- PR：见下方 PR 链接（`Closes #120`）

## 未做的事 / 已知边界（notes 范围内）
- 拒绝原因字段未实现——按 uc-ai-store-006 业务规则明确写明「拒绝原因不是本用例已确认
  页面行为」，与需求一致。
- 平台范围审核/官方精选（p15-F04/F05）未触碰；其占位页面
  `apps/web/app/(app)/admin/ai-store/{review,featured}/page.tsx` 保持原样。
- 未手动修改 `feature_list.json` 的 `status`/`owner`/`evidence`；没有自我标记
  `passing`；没有自行合并 PR。状态推进留给 `pnpm harness verify` 门控和人工合并。
- 未使用任何 hook 跳过标志（无 `--no-verify` 等）完成提交/推送。

## 下一步最佳动作
1. Review PR，确认团队审核 UI/路由/e2e 符合 uc-ai-store-006。
2. `pnpm harness new-sprint --phase 11 --id 06 ...`（或等价 claim 流程）补齐
   `sprint.md`/`active-features.json`。
3. `pnpm harness verify --sprint p11/06 --feature F06` 门控通过后由脚本推进
   `feature_list.json` 状态为 `passing`。
