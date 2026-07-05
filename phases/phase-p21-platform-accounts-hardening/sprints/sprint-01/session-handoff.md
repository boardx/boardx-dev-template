# 会话交接 — Sprint p21/01

## 当前已验证
- **F01（社交登录后门修正，owner wrk-platform-1）：已 passing。**
  `pnpm harness verify --sprint p21/01 --feature F01` 全部 5 条 verification
  通过（docker up / migrate / 新增 e2e prod-gate spec / 既有 auth-003
  social-login spec / evidence log 落盘），并跑了 `verify:base` 门控。
  证据：`phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F01.verify.log`。
- F02/F03/F04/F05/F06：未在本轮处理，状态维持各自 owner claim 时的原值。

## 本轮改动
- `apps/web/app/api/auth/social/route.ts`：POST 入口加
  `NODE_ENV === "production"` 生产环境 gate（404 拒绝），修复此前无保护的
  免密登录后门。非生产环境 demo 登录行为不变。
- `phases/phase-04-identity-and-spaces/feature_list.json`：只改
  `id=="F05"` 记录的 `user_visible_behavior`/`verification`/`notes` 三个
  字段，改为如实描述真实行为，不再声称"501 占位"；未改其它记录。
- 新增 `apps/web/e2e/auth-social-prod-gate.spec.ts`：自建独立 `next start`
  (production) 实例验证生产环境 gate 生效，不影响共享 dev webServer。
- PR：**https://github.com/boardx/boardx-dev-template/pull/393**（分支
  `worker/wrk-platform-1-p21-f01-social-gate`，`Closes #373`，已标注
  安全类修复需要 rev-security 审查，未自行合并）。

## 仍损坏或未验证
- 无新增风险。F02（team owner 越权修复，wrk-platform-2）、
  F05/F06（wave1）仍未处理，按各自 owner 独立推进。

## 下一步最佳动作
- 下一轮：等 PR #393 过 rev-security 审查后由 coord-main 合并；不要在
  PR 未合并前再改 `apps/web/app/api/auth/social/route.ts` 或 phase-04
  F05 记录，避免冲突。
- F02 由 wrk-platform-2 继续；F03/F04/F05/F06 owner 未定或各自进行中，
  不在本 sprint session 范围内重复认领。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p21/01`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/auth-social-prod-gate.spec.ts --headed`（本地看生产 gate 行为；需要先 `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate`）
