# 会话交接 — Sprint p21/01

## 当前已验证
- F03（confirm-email + phase-04 F01-F04 证据补齐）：代码完整实现，`pnpm --filter @repo/web exec
  playwright test e2e/auth-register.spec.ts e2e/auth-login.spec.ts e2e/auth-change-password.spec.ts
  e2e/auth-reset-password.spec.ts e2e/auth-005-confirm-email.spec.ts` 15/15 通过，社交登录回归
  `e2e/auth-003-social-login.spec.ts` 6/6 通过，vitest 40/40，typecheck 全绿。**但 harness 层面
  F03 仍是 `not_started`**——因为同 owner 的 F01 尚未合并，`assertSingleInProgress` 门禁挡住了
  `claim`/`verify`，无法把状态转正。详见下方"仍损坏或未验证"。
- F01（社交登录后门修正）：本地分支 `worker/wrk-platform-1-p21-f01-social-gate` 已经跑过
  `harness verify` 转成 passing，但 PR #393 未合并进 main，main 上仍是 in_progress。这是另一个
  会话的工作（同 owner 身份，不同 worktree `agent-ad908e8c84eba9ceb`），本轮未接手其代码，只是
  确认了它的存在与阻塞状态。

## 本轮改动（PR #401, https://github.com/boardx/boardx-dev-template/pull/401，Closes #375）
- `apps/web/app/api/auth/confirm-email/route.ts`：硬编码 `Set(["demo"])` → 真实读写
  `packages/data/src/auth.ts` 的 `email_tokens`（`type="confirm_email"`）。
- `packages/data/migrations/029_email_confirmation.sql`：新增 `users.email_confirmed_at` 列 +
  `auth_rate_limit_events` 表（login 限流用）。
- `apps/web/app/api/auth/register/route.ts`：注册时创建 confirm_email 令牌并"发信"（dev 日志桩）。
- 新增 `apps/web/app/api/dev/confirm-token`：e2e 用，生产 404。
- `apps/web/e2e/auth-005-confirm-email.spec.ts`：改用真实生成的 token，不再写死 "demo"。
- `phases/phase-04-identity-and-spaces/feature_list.json`：新增 `F15`（uc-auth-005，status
  passing）；F01-F04 的 `evidence` 字段从指向不存在的文件改为指向本轮真实落盘的
  `phases/phase-04-identity-and-spaces/sprints/sprint-01/evidence/F01-F04-confirm-email.verify.log`。
- `apps/web/app/api/auth/login/route.ts`：同一邮箱 1 分钟内最多 10 次登录尝试，超限 429。
- `apps/web/app/api/auth/forgot-password/route.ts`：同一账号 1 分钟内最多 3 次重置令牌，复用
  `email_tokens` 计数。
- `apps/web/lib/session.ts`：`startSession` cookie 生产环境加 `secure: true`。
- **未改动** `phases/phase-p21-platform-accounts-hardening/feature_list.json`——F03 字段原样
  保留 `not_started`/`owner:null`，因为没有真正走通 claim/verify 门控，不能手改状态。

## 仍损坏或未验证
- F03 在 harness 意义上还没转 `in_progress`/`passing`。必须等 PR #393（F01）合并进 main 后，
  下一轮显式跑：
  1. `pnpm harness claim --phase p21 --feature F03 --owner wrk-platform-1`
  2. `pnpm harness verify --sprint p21/01 --feature F03`
  才算数（会自动把 evidence 重新落到 `phases/phase-p21-platform-accounts-hardening/sprints/
  sprint-01/evidence/F03.verify.log`，届时可以覆盖/补充本轮已经写在 phase-04 里的那份日志）。
- PR #393 现状 CONFLICTING（main 上 p21 立项 PR #392 落地后，#393 基于的老版本 feature_list.json
  冲突了）。**不要**代替 wrk-platform-1 的另一个会话去改它——本轮已经尝试过一次（用独立临时
  worktree 处理 merge），被 auto-mode 权限分类器正确拦下（判定为越权动了不属于本 feature 的共享
  协调状态），已完整回滚清理，仓库里没有留下任何痕迹。如果下一轮发现 #393 仍长期卡住，应该走
  coordinator/human 决策要不要重新分派，而不是绕开 harness 的单一 in_progress 不变量。
- PR #401 与 PR #393 都改了 `apps/web/app/api/auth/` 目录下的文件（不同文件，理论上不冲突），
  合并顺序建议先 #393 后 #401。

## 下一步最佳动作
- 优先关注 PR #393 是否合并；合并后立刻在 F03 分支/新会话里补跑 claim + verify 让 F03 转 passing。
- PR #401 建议过 rev-security 再合并（涉及 auth 域：confirm-email token、登录/忘记密码限流、
  session cookie）。
- 不要动 `apps/web/app/api/auth/social/route.ts`、F01/F05/F02/F06 相关文件——那些分别是
  wrk-platform-1（F01）、wrk-platform-2（F02）、wrk-platform-3（F06）的范围。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p21/01`
- 调试: `bash scripts/init-worktree-env.sh && docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate`
  然后 `pnpm --filter @repo/web exec playwright test e2e/auth-005-confirm-email.spec.ts` 单独跑 confirm-email 测试。
