# 进度日志 — Sprint p21/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next（本轮 worktree: agent-ad908e8c84eba9ceb）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- F01（社交登录后门 gate）、F02（团队角色越权修复，含 code review 复审后的第二轮修复）均已由
  coord-main 补跑真实 `pnpm harness verify` 转 passing（F02 曾因 Docker 网络资源环境问题短暂
  受阻，非代码回归，已在资源恢复后重新跑通）。
- F04（Team F06-F09 证据补齐 + F13 状态拆分回填）：2026-07-05 由 wrk-platform-2 门控通过 →
  **F04 = passing**。
- 当前最高优先级未完成功能: F05（billing F04 文档如实改写，owner wrk-payment-1，进行中）。
- 当前 blocker: 无。

## 会话记录
### 2026-07-05 00:20 (wrk-platform-2)
- 本轮目标: 修复 issue #374 — team 域成员角色接口越权（PATCH/DELETE members/[userId] 只校验
  操作者角色，不校验目标是不是 owner；admin 可越权降级/移除 owner；invites 路由也未禁止签发
  owner 角色邀请）。
- 已完成:
  1. `apps/web/app/api/teams/[id]/members/[userId]/route.ts` PATCH/DELETE 增加目标角色
     校验，目标是 owner 时一律 403（对齐 room 域 `rooms/[id]/members/[userId]/route.ts`
     已有的 target-owner 保护写法）。
  2. `packages/data/src/teams.ts` 的 `updateMemberRole`/`removeMember` 数据层加
     `AND role <> 'owner'` SQL 级兜底，防止未来其它调用方绕过路由层。
  3. `apps/web/app/api/teams/[id]/invites/route.ts` 签发邀请时 role=owner 强制降级为 member。
  4. 新增 `apps/web/e2e/team-010-owner-protection.spec.ts`：覆盖 admin 降级/移除 owner 被拒、
     admin 签发 owner 邀请被拒、以及合法路径（owner 操作任意成员/admin 操作普通成员）不受影响。
- 运行过的验证:
  - `./init.sh` → 45/45 tasks successful（基础验证通过）。
  - `docker run --network bridge ...pgvector/pgvector:pg16`（等价替代 `docker compose up -d`，
    原因见上方 blocker 说明）+ `pnpm --filter @repo/data run migrate` → exit 0。
  - `pnpm --filter @repo/web exec playwright test e2e/team-010-owner-protection.spec.ts` → 5 passed。
  - `pnpm --filter @repo/web exec playwright test e2e/team-manage.spec.ts` → 3 passed（回归）。
  - 额外回归：team-003/team-007/team-create/team-invite-join/team-switch/admin-002 → 27 passed。
  - `pnpm --filter @repo/web run typecheck` / `pnpm --filter @repo/data run typecheck` → 均 PASS。
  - `pnpm harness verify --sprint p21/01 --feature F02` → 在 docker compose 网络创建这一步失败
    （环境资源耗尽，非代码回归，详见 blocker）。
- 已记录证据: `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F02.verify.log`
  （含环境问题说明 + 等价验证的完整命令输出）。
- 提交记录:
  - `fix(p21/F02): 修复团队成员角色接口越权（owner 保护）`
  - `docs(p21/F02): 补全 verify log — 记录 harness verify 的 docker 网络环境限制`
  - 分支 `worker/wrk-platform-2-p21-f02-team-owner-protection`，已开 PR，Closes #374。
- 已知风险或未解决问题:
  - F02 的 `pnpm harness verify` 未能在本次会话中自动跑通门控（纯 Docker 资源环境问题），
    `feature_list.json` 里 F02 仍是 `in_progress`，未被自己改成 `passing`（遵守"状态不能自己
    改"约束）。需要机器 Docker 资源压力下降后由任意 agent 重跑一次 verify 命令完成门控。
  - 本 feature 是安全类修复，PR 需要过 rev-security 审查后才能合并。
- 下一步最佳动作:
  - 等本机 Docker 网络资源压力下降（其它 worktree 陆续收尾释放网络）后，重跑
    `pnpm harness verify --sprint p21/01 --feature F02`，预期直接通过并升级 passing
    （代码不需要再改）。
  - rev-security 审查 PR；通过后由 coordinator 合并，不要自行合并。

### 2026-07-05 01:10 (wrk-platform-2) — code review 复审修复
- 本轮目标: 修复 code-reviewer 复审抓出的残留漏洞——PATCH 路由只校验了"目标当前是不是 owner"，
  没校验"要把角色改成什么"，`isTeamRole("owner")` 为 true 导致 admin 仍可以
  `PATCH .../members/:anyMemberId {role:"owner"}` 把任意普通成员提升为第二个 owner，等价的
  团队接管路径换了个入口（invites 堵了，改角色这条路还开着）；且一旦造出新 owner，此前加的
  "目标是 owner 时拒绝修改/移除"保护反而会保护它不被降级/移除，接管更彻底。
- 已完成:
  1. `apps/web/app/api/teams/[id]/members/[userId]/route.ts` PATCH 增加
     `if (role === "owner") return 403`，对齐 room 域白名单写法思路。
  2. `packages/data/src/teams.ts` 的 `updateMemberRole` SQL 加对称条件 `AND $3 <> 'owner'`。
  3. `apps/web/e2e/team-010-owner-protection.spec.ts` 新增用例"admin 尝试把普通 member
     PATCH 成 role:owner → 403，不产出第二个 owner"，现在 6 个用例。
- 运行过的验证:
  - `pnpm --filter @repo/web run typecheck` / `pnpm --filter @repo/data run typecheck` → PASS。
  - `docker run --network bridge ...pgvector/pgvector:pg16` + migrate → exit 0（同上一轮的
    等价替代方式，环境问题未变）。
  - `pnpm --filter @repo/web exec playwright test e2e/team-010-owner-protection.spec.ts
    e2e/team-manage.spec.ts` → 9 passed（含新用例）。
  - `./init.sh` → 45/45 tasks successful。
  - `pnpm harness verify --sprint p21/01 --feature F02` → 再次卡在 docker compose 网络创建
    这一步（环境问题依旧，与上一轮一致，非本轮改动引入）。
- 已记录证据: evidence/F02.verify.log 已重写，包含本轮修订记录 + 完整验证链条。
- 提交记录:
  - `fix(p21/F02): 修复 PATCH 造第二个 owner 的回归缺口（code review 发现）`
  - 推到同一分支 `worker/wrk-platform-2-p21-f02-team-owner-protection`，未开新 PR，
    已在 PR #394 下评论说明修复内容。
- 已知风险或未解决问题: 同上一轮——`pnpm harness verify` 仍受 Docker 网络资源环境问题阻塞，
  feature 状态维持 `in_progress`。
- 下一步最佳动作:
  - rev-security 复审这次的对称性修复是否已经堵全（PATCH/DELETE + 数据层是否还有其它
    "只挡当前状态、不挡目标状态"的类似缺口）。
  - 其余同上一轮：等 Docker 资源压力下降后重跑 harness verify；不要自行合并 PR。

### 2026-07-05 09:2x (wrk-platform-2) — F02 门控补跑 + F04 认领（issue #376）
- 背景：进入本轮会话时发现 PR #399（"替代误合并的 #394"）虽然已在 main 上落地了 F02 的代码/
  evidence（commit `c3a449d`，`docker compose`/`migrate`/两个 e2e 均已随该 commit 落盘证据），
  但 feature_list.json 的 F02.status 仍卡在 `in_progress`（owner: wrk-platform-2）——PR #399
  本身还开着未合并。由于 harness `claim` 命令对同一 owner 强制"最多一个 in_progress"，
  这个历史遗留状态挡住了本轮要认领的 F04。
- 已完成（F02，非本 feature 范围内的顺带核实，未改代码）:
  - `bash scripts/init-worktree-env.sh` 分配独立 docker 网络/端口后，`pnpm harness verify
    --sprint p21/01 --feature F02` 一次性跑通全部 5 条 verification + 基础验证 → 门控自动把
    F02 标记 `passing`。证据：`evidence/F02.verify.log`（本轮重写，639 行差异）。
  - 这一步只是让脚本把已经真实完成的状态如实登记，未修改任何 F02 相关代码。
- 已完成（F04 — 本 feature 正式范围）:
  1. `pnpm harness claim --phase p21 --feature F04 --owner wrk-platform-2`（F02 转 passing 后
     解除单 owner 限制，认领成功）。
  2. 重新执行 phase-04 area=="team" 且 status=="passing" 的 F06/F07/F08/F09 各自的
     verification 命令（team-create/team-switch/team-invite-join/team-manage 四个 e2e
     套件），全部真实通过（共 10 个用例），真实日志写入
     `phases/phase-04-identity-and-spaces/sprints/sprint-02/evidence/F0{6,7,8,9}.verify.log`
     并更新 feature_list.json 对应 evidence 字段的时间戳与来源说明。
  3. 核实 uc-team-007（commit f603f45，`apps/web/app/(app)/teams/page.tsx` General 设置区 +
     PATCH/DELETE `/api/teams/[id]`）实现仍在，`e2e/team-007-general-settings.spec.ts` 5 个
     用例全过 → 从原 F13 拆出新记录 **F15**（passing），证据
     `sprint-02/evidence/F15.verify.log`。
  4. 核实 uc-team-008/010 依赖的 AI/AI Store 平面现状：p9-ava-chat 10/11 passing、
     p11-ai-store 5/6 passing（含团队维度的 F06 审核精选），团队维度的
     `teams/[id]/ai-store-review/page.tsx` 已真实存在 → 从原 F13 拆出新记录 **F16**
     （not_started，解除过时 DEFERRED 标记，留待后续排期，本 feature 不实现其页面）。
  5. uc-team-009（团队 Memory）核实 `packages/memory` 是 harness 自身会话记忆基础设施，
     `apps/web` 无任何 import，`team_memories` 表确实不存在 → **F13 收窄为仅 uc-team-009**，
     继续 DEFERRED。
  6. 顺带核实 `apps/web/app/api/invite/[token]/route.ts`：仍被 `apps/web/app/invite/[token]/
     page.tsx` 引用（GET 解析邀请 + POST 接受邀请），非死路由，按指示不确定即跳过，未删除。
- 运行过的验证:
  - `pnpm harness verify --sprint p21/01 --feature F02` → 门控通过，F02 = passing。
  - `pnpm --filter @repo/web exec playwright test e2e/team-create.spec.ts` → 2 passed（F06）。
  - `pnpm --filter @repo/web exec playwright test e2e/team-switch.spec.ts` → 2 passed（F07）。
  - `pnpm --filter @repo/web exec playwright test e2e/team-invite-join.spec.ts` → 3 passed（F08）。
  - `pnpm --filter @repo/web exec playwright test e2e/team-manage.spec.ts` → 3 passed（F09）。
  - `pnpm --filter @repo/web exec playwright test e2e/team-007-general-settings.spec.ts`
    → 5 passed（F15）。
  - `pnpm harness verify --sprint p21/01 --feature F04` → 门控通过，F04 = passing
    （含 require_base_pass=true 的 `pnpm -w run verify:base` 全绿）。
- 已记录证据: `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/
  F04.verify.log`；phase-04 侧新增/更新的 evidence 见上文各条。
- 提交记录:
  - `fix(p21/F04): 补齐 team F06-F09 evidence + F13 状态拆分回填(uc-007→F15, uc-008/010→F16)`
  - 分支 `worker/wrk-platform-2-p21-f04-team-evidence`（从干净 `origin/main` 起步），
    已开 PR，Closes #376，base = main。
- 已知风险或未解决问题: 无（F02/F04 均已 passing，`init.sh` 基础验证未受影响）。
- 下一步最佳动作:
  - PR 走 review（本 feature 非安全类，但涉及 phase-04 历史 feature_list 状态回填，建议至少
    过一轮 rev-code 确认拆分逻辑合理）；不要自行合并。
  - 关注 PR #399（F02 的另一支重复 PR）：本轮已经通过 `pnpm harness verify` 把 main 上的
    F02 状态正式登记为 passing，PR #399 可能与本次改动在 F02 evidence 字段上产生冲突，
    建议 coordinator 核实后关闭其中一个重复 PR。

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
