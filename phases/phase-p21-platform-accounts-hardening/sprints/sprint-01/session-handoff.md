# 会话交接 — Sprint p21/01

## 本轮新增: F03 (wrk-codex-auth-1)
- Issue #375 使用隔离 worktree `/private/tmp/boardx-worktrees/issue-375-p21-auth-f03`, 分支 `worker/wrk-codex-auth-1-p21-f03-confirm-email`。
- 已恢复并保留 confirm-email DB token 实现和 auth-005 e2e 覆盖。
- 之前同一 worktree 已通过: docker compose up、data migrate、web `tsc --noEmit`、auth register/login/change-password/reset-password/confirm-email 五组 Playwright, 共 14 passed。
- 当前阻塞: /private/tmp 被清理后重建 worktree, fresh dependency install 遇到 npm registry DNS ENOTFOUND; 尚未能在恢复后的 worktree 补跑 `pnpm harness verify --sprint p21/01 --feature F03`。
- 下一步: 网络可用后先安装依赖/补跑 harness verify, 由 harness 自动推进 F03 到 passing, 再提交/push/开 PR。

## 当前已验证
- F01、F02 均已由 coord-main 补跑真实 `pnpm harness verify` 转 passing（F02 的 Docker 网络
  环境阻塞已在资源恢复后解除，非代码回归）。以下是两个 owner 各自留下的详细记录：
- F02（团队成员角色接口越权修复，owner: wrk-platform-2）代码 + 测试已完成并手工/等价验证通过，
  **含 code-reviewer 复审发现并修复的第二轮回归缺口**：
  - `pnpm --filter @repo/web exec playwright test e2e/team-010-owner-protection.spec.ts` → 6 passed
    （新增"admin PATCH member 成 owner 被拒"用例）
  - `pnpm --filter @repo/web exec playwright test e2e/team-manage.spec.ts` → 3 passed（回归）
  - team-003/007/create/invite-join/switch + admin-002 → 27 passed（第一轮已验证，本轮未涉及
    这几个 spec 覆盖的路径，未重复全量重跑）
  - `pnpm --filter @repo/web run typecheck` / `pnpm --filter @repo/data run typecheck` → PASS
  - `./init.sh` → 45/45 tasks successful
  - 详见 `sprints/sprint-01/evidence/F02.verify.log`
- **未达成**：`pnpm harness verify --sprint p21/01 --feature F02` 两轮都未能跑通门控（同一个
  Docker 环境问题），`feature_list.json` 里 F02 仍是 `in_progress`（未自行改成 passing，遵守
  硬约束）。

## 本轮改动（两轮累计）
- `apps/web/app/api/teams/[id]/members/[userId]/route.ts`：
  - 第一轮：PATCH/DELETE 增加"目标当前是不是 owner"校验，是 owner 一律 403。
  - **第二轮（code review 修复）**：PATCH 增加"请求把角色设为 owner"校验，同样 403——第一轮
    遗漏了这条，导致 admin 能凭空 PATCH 出一个新 owner，绕过第一轮保护实现团队接管。
- `packages/data/src/teams.ts`：
  - 第一轮：`updateMemberRole`/`removeMember` 加 `AND role <> 'owner'`。
  - **第二轮**：`updateMemberRole` 补上对称条件 `AND $3 <> 'owner'`。
- `apps/web/app/api/teams/[id]/invites/route.ts`：签发邀请 role=owner 强制降级为 member（第一轮）。
- `apps/web/e2e/team-010-owner-protection.spec.ts`：第一轮 5 用例，第二轮补了第 6 个用例覆盖
  "PATCH 造第二个 owner"场景。
- 未改动 `team_invites` 表结构、未动 team 域其它无关代码（遵守范围纪律）。

## 仍损坏或未验证
- **环境问题（非代码问题）**：本机 Docker 预定义地址池已被大量并行 worker/worktree 的 compose
  网络耗尽（`all predefined address pools have been fully subnetted`），`docker compose -f
  infra/docker-compose.yml up -d` 在"创建 compose 网络"这一步就失败，导致 `pnpm harness
  verify` 无法自动跑通 F02 的第一条 verification 命令。已确认：
  - 不是本 worktree 专属网络名冲突（用 scripts/init-worktree-env.sh 分配的独占 project name
    重跑，甚至单独起 postgres，同样失败）。
  - 核实时刻没有可安全清理的孤儿网络（`docker network inspect` 逐个核对，全部有容器挂载），
    所以没有跑 `docker network prune`；也没有重启 Docker daemon（会打断其它 agent 的数据库
    连接）。
  - 用 `docker run --network bridge ...pgvector/pgvector:pg16` 复用默认 bridge 网络（不新建
    compose 网络）完成了等价的端到端验证，migrate + 全部相关 e2e 真实跑通。
- 这个环境问题不是 F02 专属，任何这段时间在本机跑 `docker compose up -d` 的 agent 都可能遇到，
  值得报给 coordinator 关注（是否需要错峰跑 e2e，或考虑给 default-address-pools 扩容——但扩容
  需要重启 daemon，需协调所有并行 agent 后再做，不是单个 worker 能决定的）。

## 下一步最佳动作
- 机器 Docker 资源压力下降后（其它 worktree 陆续收尾），随便哪个 agent 重跑一次
  `pnpm harness verify --sprint p21/01 --feature F02` 即可完成门控升级 passing——**不需要再
  改代码**，本次改动（含两轮修复）已经完整且经过手工验证。
- PR #394 已开（Closes #374），已推了第二轮修复到同一分支，需要 rev-security 重新审查
  （安全类修复，registry.yaml 的 required_for 列表要求）——**特别请审查这次的对称性修复是否
  已经堵全**：PATCH/DELETE 两条路径 + 数据层是否还有其它"只挡目标当前状态、不挡请求要设成的
  状态"的类似缺口（这正是第二轮要修的那种模式）。审查通过后交 coordinator 合并，worker 不
  自行合并。
- 不要动：`team_invites` 表结构（已知技术债，明确不在本 feature 范围）、
  `/api/invite/[token]` 死路由清理（同样明确不在本 feature 范围）。

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
- 调试:若 `docker compose up -d` 遇到地址池耗尽，先用
  `docker network inspect <name> --format '{{len .Containers}}'` 逐个确认有没有 0 容器的孤儿
  网络再考虑 prune；绕过方式：
  `docker run -d --name <tmp> --network bridge -e POSTGRES_USER=boardx -e POSTGRES_PASSWORD=boardx -e POSTGRES_DB=boardx -p $PG_PORT:5432 pgvector/pgvector:pg16`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/auth-social-prod-gate.spec.ts --headed`（本地看生产 gate 行为；需要先 `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate`）
