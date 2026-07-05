# 进度日志 — Sprint p21/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 团队成员角色接口越权修复（owner 保护）— owner: wrk-platform-2，
  代码/测试已完成，`pnpm harness verify` 因本机 Docker 网络资源耗尽未能自动跑通门控（见下）。
- 当前 blocker: `pnpm harness verify --sprint p21/01 --feature F02` 卡在第一条命令
  `docker compose -f infra/docker-compose.yml up -d` —— 本机同时有大量并行 worker/worktree
  各自的 compose 网络，Docker 预定义地址池已耗尽（`all predefined address pools have been
  fully subnetted`），核实过不是本 worktree 专属网络名冲突，是 Docker daemon 级别资源上限，
  与 F02 代码改动无关。未采用 `docker network prune`/重启 daemon 等破坏性手段（会影响其它
  正在运行的 agent），改用 `docker run --network bridge` 起独立 postgres 容器完成等价的端到端
  验证（migrate + 新增 e2e + 既有 team e2e 全部真实通过，见 evidence/F02.verify.log）。
  待机器 Docker 资源压力下降后，重跑 `pnpm harness verify --sprint p21/01 --feature F02`
  应可自动升级 passing（代码已就绪，此 blocker 纯属环境资源问题）。

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
