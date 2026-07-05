# 进度日志 — Sprint p21/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next（本轮 worktree: agent-ad908e8c84eba9ceb）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02（团队成员角色接口越权修复，owner wrk-platform-2，未在本轮处理）
- 当前 blocker: 无（F01 已 passing）

## 会话记录
### 2026-07-04 19:59:51
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-05（wrk-platform-1，F01）
- 本轮目标：实现 issue #373（F01 社交登录后门修正）——给
  `apps/web/app/api/auth/social/route.ts` 加生产环境 gate，修正
  phase-04 F05 记录的失实描述，补 e2e 回归测试。
- 已完成：
  1. `apps/web/app/api/auth/social/route.ts` 的 POST 入口最前面加
     `NODE_ENV === "production"` 时返回 404 的 gate（对齐
     `apps/web/app/api/dev/reset-token/route.ts:10-12` 写法），非生产环境
     demo 登录桩行为不变。
  2. `phases/phase-04-identity-and-spaces/feature_list.json` 里 id=="F05"
     的 `user_visible_behavior`/`verification`/`notes` 三个字段改为如实
     描述真实行为（demo 登录桩 + 生产环境 gate），不再声称"501 占位"；
     未改动该记录以外的其它字段/其它 F0X 记录。
  3. 新增 `apps/web/e2e/auth-social-prod-gate.spec.ts`：因共享 Playwright
     webServer 用 `next dev` 跑（强制 development 模式，同进程内无法运行期
     切到 production），该 spec 在 `beforeAll` 里自建一个独立端口的
     `next start`（production）实例验证生产环境下请求被拒绝，跑完即关闭，
     不影响共享 dev server。
- 运行过的验证（均通过，exit code 0）：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/auth-social-prod-gate.spec.ts`（2 passed）
  - `pnpm --filter @repo/web exec playwright test e2e/auth-003-social-login.spec.ts`（6 passed，非生产环境 demo 登录行为未被破坏）
  - `pnpm harness verify --sprint p21/01 --feature F01`（含 `verify:base`）→ 门控转 passing
- 已记录证据：
  `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F01.verify.log`
- 提交记录：分支 `worker/wrk-platform-1-p21-f01-social-gate`，PR 见
  session-handoff.md。
- 已知风险或未解决问题：无新增风险；F02/F03/F04/F05/F06 仍未处理。
- 下一步最佳动作：F02（wrk-platform-2 owner，team 越权修复）、F05/F06
  （wave1，其它 owner）按各自 owner 继续推进；F01 已 passing，无需再动
  `apps/web/app/api/auth/social/route.ts` 或 phase-04 F05 记录。
