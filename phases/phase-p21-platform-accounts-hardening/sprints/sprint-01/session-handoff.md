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
- F01、F02 均已由 coord-main 补跑真实 `pnpm harness verify` 转 passing（F02 的 Docker 网络
  环境阻塞已在资源恢复后解除，非代码回归）。
- **F02**（团队成员角色接口越权修复，owner: wrk-platform-2）代码 + 测试早已完成，**含
  code-reviewer 复审发现并修复的第二轮回归缺口**（`team-010-owner-protection.spec.ts` → 6
  passed，新增"admin PATCH member 成 owner 被拒"用例；`team-manage.spec.ts` → 3 passed）。
  2026-07-05 本轮会话在新 worktree 上，本机 Docker 资源空闲，`pnpm harness verify --sprint
  p21/01 --feature F02` 一次性跑通全部 5 条 verification + 基础验证 → **门控通过，F02 =
  passing**（此前两轮受阻于 docker 地址池耗尽，未改任何代码，只是让脚本如实登记已完成状态）。
- **F04**（Team F06-F09 证据补齐 + F13 状态拆分回填，owner: wrk-platform-2，issue #376）：
  `pnpm harness verify --sprint p21/01 --feature F04` 门控通过 → **F04 = passing**。

## 本轮改动（F04 正式范围）
- `phases/phase-04-identity-and-spaces/feature_list.json`：
  - F06/F07/F08/F09 的 `evidence` 字段改为指向本轮真实重跑并落盘的日志（原 2026-06-29 的
    evidence 引用文件从未存在于仓库，`sprint-02/evidence/` 此前只有空 `.gitkeep`）。
  - F13（原 `[DEFERRED] 团队设置/Home/Memory/AI Store`，覆盖 uc-team-007/008/009/010）拆分：
    - 收窄为仅 uc-team-009（团队 Memory），继续 `not_started` + DEFERRED（`team_memories`
      表确实不存在，`packages/memory` 是 harness 自身会话记忆基础设施，与团队 Memory 无关）。
    - 新增 **F15**：uc-team-007（团队改名/描述/删除），标记 `passing`，指向
      `e2e/team-007-general-settings.spec.ts`（5 用例全过）。commit `f603f45` 早已实现
      （`apps/web/app/(app)/teams/page.tsx` General 设置区 + PATCH/DELETE
      `/api/teams/[id]`），只是从未回填 feature_list.json。
    - 新增 **F16**：uc-team-008（Team Home 统计壳）+ uc-team-010（团队 AI Store 入口），
      标记 `not_started`（不是 passing，也不再是过时的 DEFERRED）——AI/AI Store 底层平面已
      具备条件（p9-ava-chat 10/11 passing、p11-ai-store 5/6 passing，团队维度审核精选页面
      `teams/[id]/ai-store-review/page.tsx` 已真实存在），但 Team Home 页面本身、团队维度的
      Store Explore/Subscribe 页面尚未实现，留待后续排期，**本 feature 未实现这两个页面**。
- 新增 evidence 文件（均已 git add）：
  `phases/phase-04-identity-and-spaces/sprints/sprint-02/evidence/F06.verify.log`、
  `F07.verify.log`、`F08.verify.log`、`F09.verify.log`、`F15.verify.log`；
  `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F04.verify.log`。
- 未新增/修改任何业务代码——本 feature 定义就是"重新验证 + 状态回填"，不要求重新实现。

## 顺带核实（未改动）
- `apps/web/app/api/invite/[token]/route.ts`：gap-report 怀疑的疑似死 STUB 路由。核实后仍被
  `apps/web/app/invite/[token]/page.tsx` 引用（GET 解析邀请信息 + POST 接受邀请），是一个真实
  UI 页面的后端支撑，**不是死路由**，按指示"不确定就跳过"未删除。

## 仍未解决/需要 coordinator 关注
- **重复 PR 风险**：PR #399（`worker/wrk-platform-2-p21-f02-refix-onto-main`，Closes #374）
  此前已经把 F02 的代码+evidence+`feature_list.json` 状态更新一并打包在同一个 PR 里，但截至
  本轮会话仍是 **OPEN 未合并**。本轮会话是在独立干净 worktree 上重新从 origin/main 出发，
  跑通了 verify 让 F02 状态落到本地并随 F04 一起提交/开 PR。这意味着 main 上可能会有两个
  PR 都尝试把 F02.status 改成 passing（内容应该一致，因为都是重跑同一批已经存在于 main 上的
  代码/测试，但字面 diff 可能不完全相同，如 evidence 时间戳）。建议 coordinator：
  1. 确认 PR #399 与本 PR 里 F02 相关的 diff 是否冲突；
  2. 只保留一个 PR 落地 F02 状态更新，关闭另一个重复部分（不影响各自 PR 里 F04 相关的
     独立内容）。
- F13/F15/F16 的拆分是本轮新引入的 feature id 分配（phase-04 之前最大编号是 F14），如果同一
  时间还有其它 agent 在改 phase-04 的 feature_list.json，需要 coordinator 核对是否有 id 冲突。

## 下一步最佳动作
- 走 PR review（建议至少一轮 rev-code 确认 F13→F15/F16 拆分逻辑合理、evidence 路径真实存在
  于 git 历史），通过后交 coordinator 合并，worker 不自行合并。
- coordinator 处理上述"F02 重复 PR"的收尾（关闭其中一个、避免 main 上产生冲突的 evidence
  时间戳/状态写入顺序问题）。
- F16（Team Home + 团队 AI Store 入口）已经从 DEFERRED 解除为 not_started，可以在后续 sprint
  正常排期实现，不再需要"等待 AI 平面就绪"的前置检查。

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
- 验证:`pnpm harness verify --sprint p21/01 --feature F03`（本 feature）。
- 本轮 worktree 独立端口: `bash scripts/init-worktree-env.sh`（每个 worktree 各自分配，
  不与其它并行 agent 冲突，含 docker 子网动态分配，避免地址池耗尽）。
- 调试: `bash scripts/init-worktree-env.sh && docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate`
  然后 `pnpm --filter @repo/web exec playwright test e2e/auth-005-confirm-email.spec.ts` 单独跑 confirm-email 测试。
- 调试:`pnpm --filter @repo/web exec playwright test e2e/auth-social-prod-gate.spec.ts --headed`（本地看生产 gate 行为；需要先 `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate`）
- F05（Billing F04「额度不足触发」如实改写，wrk-payment-1）：**已跑 `pnpm harness verify --sprint p21/01
  --feature F05` 门控通过，status = passing**（脚本自动写入，未手改）。日志见
  `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F05.verify.log`（harness
  脚本自动生成，含三条 verification 命令的真实输出 + base verify 完整日志）。
  verification 第二条命令按 feature-evaluator 反馈改为 `-g '静态常驻展示'` 精确只跑本 feature
  自己的 test，避免撞上既存无关失败（见下）。

## 本轮改动
- `phases/phase-p14-credits-billing/feature_list.json`：F04 条目的 title/user_visible_behavior/notes
  改为如实描述现状（AVA「AI credits」横幅是无条件常驻的静态 UI，不由 402 额度不足触发），并补充
  单一货币(USD)/不支持退款/不支持自动续费管理的范围收窄说明。
- `apps/web/e2e/billing-001-upgrade-plan.spec.ts`：仅改一条 test 的名字 + 加注释，去掉「触发」这个
  误导性措辞，断言逻辑未动。
- 未碰 `apps/web/app/(app)/ava/page.tsx` 等运行时代码（按任务硬约束，本 feature 是文档/描述层修正，
  不实现路径 A 的「402 自动触发弹窗」新行为）。

## 仍损坏或未验证
- `billing-001-upgrade-plan.spec.ts` 的「用户菜单可打开计划弹窗；credits 模式进入购买 Credit 流程」
  这条 test 失败（`credit-pack-list` 元素找不到）。**已确认是既存 bug，未修改代码的基线上同样复现**，
  与 F05 无关，未在本次修复，已 spawn_task 登记（task_8bfb199b）。下一轮如有 owner 接手，建议单独
  开 feature 处理 buy-credits-dialog 的这个真实功能 bug。
- F01-F04（除本轮的 F04 描述修正外）/F06 均仍是各自 owner 的待办，未在本次会话内处理。

## 下一步最佳动作
- F05 已 passing，无需再改；等待 rev-security（billing 域涉及升级弹窗触发条件，registry.yaml
  建议过一次）review 通过后由 coordinator 合并 PR #391。
- coordinator 的立项 PR #389 合并后，本分支应 `git fetch origin main && git rebase origin/main`
  把 diff 收窄到只剩本 feature 的改动（去掉 cherry-pick 进来的整套 p21 scaffold），coordinator
  已知情正在处理，如果 #389 迟迟不合并可以自行 rebase。
- 下一轮可继续处理 p21 的 F01/F02（wave0 安全类，优先级更高）或 F03/F04/F06（wave1，无 owner 冲突）。
- 不要在本 feature 分支上顺手实现路径 A（402 自动触发弹窗）——那是明确排除的范围，需要新开 feature。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p21/01`
- 调试:`bash scripts/init-worktree-env.sh && docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate && cd apps/web && pnpm exec playwright test e2e/billing-001-upgrade-plan.spec.ts`
