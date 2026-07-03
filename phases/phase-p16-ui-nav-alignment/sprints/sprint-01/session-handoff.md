# 会话交接 — Sprint p16/01

## 当前已验证
- F01「全局导航接线：Ava / Surveys / Admin 入口」（issue #220，owner wrk-claude-1）：
  实现完成，e2e `nav-001-global-entry-points.spec.ts` 4/4 通过（真实点击路径，非
  `page.goto()` 直达）。**未标 passing**——按 harness 硬约束，状态转移只能由
  `pnpm harness verify` 门控完成，本会话只跑了 feature 自己的验证命令 + `verify:base`
  （轻量门控策略，未跑 `verify:full`）。PR 待 review。

## 本轮改动
- `apps/web/lib/session.ts`：`PublicUser` 新增 `isSysAdmin: boolean`，`toPublicUser` 复用
  `@repo/auth` 的 `isSysAdmin(platform_role)`（与 `lib/admin.ts` requireSysAdmin 同一套
  判定逻辑，前端只透传不重新实现鉴权）。
- `apps/web/components/app-shell/sidebar.tsx`：`RAIL_ITEMS` 新增 Ava（`/ava`）、Surveys
  （`/surveys`）两个入口；新增 Admin 入口（`/admin`），只在 `user?.isSysAdmin` 为真时渲染
  （不是禁用态，非 SysAdmin 用户 DOM 里完全没有这个节点）。全部入口加
  `data-testid="rail-nav-<label>"`。
- 新增 `apps/web/e2e/nav-001-global-entry-points.spec.ts`：4 个用例覆盖真实点击路径。

## 仍损坏或未验证
- `pnpm -w run verify:base` 里 `@repo/auth#test` 偶发超时（bcrypt hash 测试 5s 超时），
  **仅在 turbo 全量并行跑时出现，单独跑 `pnpm --filter @repo/auth run test` 100% 通过**
  （15/15，evidence/auth-test-isolated-pass.log）。本次改动未触碰 `packages/auth` 任何
  文件，确认是这台机器多 worktree 并发导致的资源竞争型环境问题，不是回归。建议后续单独
  开 issue 给这个 bcrypt 测试放宽 timeout。
- AI Store 入口未提升到 sidebar（feature notes 标注为可选，本次跳过，不影响 F01 核心验收）。
- 未跑 `verify:full`（按任务指示的轻量门控策略，只跑了本 feature 的 e2e + verify:base）。

## 下一步最佳动作
- 下一轮：等 PR #220 对应 PR review 通过 + `pnpm harness verify --sprint p16/01` 门控跑完，
  由 harness 把 F01 标 passing（不要手改 feature_list.json / active-features.json）。
- 不要动：`apps/web/lib/admin.ts`（requireSysAdmin 的唯一权威实现，本次未改，勿重复实现）。

## 命令
- 启动:`pnpm -w run dev`（或本会话方式：`cd apps/web && npx next dev -p <E2E_PORT或3000>`，
  先确认 `apps/web/.env.local` 的 DATABASE_URL/REDIS_URL 指向本 worktree 自己的 docker compose 端口）
- 验证:`pnpm harness verify --sprint p16/01`
- 调试:`cd apps/web && pnpm exec playwright test e2e/nav-001-global-entry-points.spec.ts`
  （需要先 `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d`
  + `pnpm --filter @repo/data run migrate`）
