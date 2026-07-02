# 进度日志 — Sprint p15/03

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/agent-ac8302aef2a499ed3`（worker wrk-admin-1）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（F02 是本 sprint 唯一 feature，已 passing）
- 当前 blocker: 无（F02 已通过 harness verify 门控）

## 会话记录
### 2026-07-01 19:03:16
- 本轮目标: 落地 F02（用户管理：列表/搜索/分页/增删改 + 手动上分），把此前存在的
  stub-gated 原型（`ADMIN_GATE_OPEN` 环境变量网关 + 内存样例数据）升级为真实 DB + 真实
  `requireSysAdmin()` 门控。
- 已完成:
  - `packages/data/src/auth.ts`: 新增 `listAdminUsers`（分页/搜索，聚合 team_count + 个人
    credit_balance）、`updateAdminUser`（改姓名/平台角色）、`deleteUser`。
  - `apps/web/app/api/admin/users/route.ts`: GET/POST 改为走 `requireSysAdmin()` + 真实 DB
    （原 stub `isAdmin()`/内存样例数据整体替换）。
  - `apps/web/app/api/admin/users/[id]/route.ts`（新增）: PATCH 编辑资料/角色，DELETE 删除。
  - `apps/web/app/api/admin/users/[id]/credit/route.ts`（新增）: 手动增加个人 Credit，复用
    F03（团队上分）同款幂等 key + 操作人审计 + note 200 字裁剪的加固模式，仅 wallet scope
    换成 personal。
  - `apps/web/app/(app)/admin/users/page.tsx`: 整页重写，对齐 F03 团队管理页的视觉/交互
    规范（搜索栏、分页、创建表单、编辑/删除/手动上分弹窗，data-testid 全覆盖）。
  - `apps/web/e2e/admin-001-manage-users.spec.ts`: 重写为真实门控 + 真实数据的端到端覆盖
    （未登录/非 SysAdmin 越权、列表搜索、创建、编辑、删除确认、手动上分、上分幂等）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/admin-001-manage-users.spec.ts`（9/9 通过）
  - `pnpm harness verify --sprint p15/03` → F02 门控通过（含 require_base_pass 的
    `pnpm -w run verify:base`，45/45 任务通过）
- 已记录证据:
  - `phases/phase-p15-admin/sprints/sprint-03/evidence/F02.verify.log`（harness verify 权威产出）
  - `phases/phase-p15-admin/sprints/sprint-03/evidence/f02-verification.log`（补充：单独跑
    verification 数组三条命令的完整输出）
- 提交记录: 见分支 `worker/wrk-admin-1-p15-f02-user-management`（PR Closes #136）
- 已知风险或未解决问题:
  - **共享机器资源争用（已知问题）**: 本 worktree 独占的 postgres 容器在本轮多次出现
    `57P03 the database system is in recovery mode` 崩溃重启（`server process terminated
    by signal 13: Broken pipe` → 级联终止 → 自动恢复），与本机同时运行 50+ 个其它
    worktree/worker 的 docker 容器（`docker stats` 观测到总 CPU 需求 ~180-200%，仅 8 核）
    强相关，不是 F02 代码逻辑问题——DB 稳定时单次 e2e 全量跑通过率高（多次验证），压测式
    重复跑（`--repeat-each`）下更容易撞见 DB 崩溃窗口。`pnpm harness verify` 最终成功跑通
    并把 F02 门控为 passing，即证明"我方验证在 DB 稳定时确定性通过"。
  - `scripts/init-worktree-env.sh` 目前只分配 pg/redis/web 三个端口，未覆盖 MinIO
    （`MINIO_PORT`/`MINIO_CONSOLE_PORT`），导致多个 worktree 并行时 `docker compose up -d`
    可能因 9090/9091 端口冲突而整体返回非 0（即使 F02 实际只需要 pg/redis）。本轮手动在
    worktree 的 `.env`/`infra/.env` 里补了空闲端口作为临时解决，未改脚本本身（超出 F02
    范围，已用 spawn_task 标记供后续单独修复）。
  - 同理，`docker compose`（v2.17.3）在只传 `-f infra/docker-compose.yml` 时不会从 cwd 自动
    加载 `.env`（会去 compose 文件所在目录 `infra/` 找），本轮临时把 `.env` 也复制了一份到
    `infra/.env`（已 gitignore，不影响其它 worktree）。
- 下一步最佳动作: F02 已 passing，本 sprint 完成。下一轮如需继续 P15 阶段，看
  `phases/phase-p15-admin/feature_list.json` 里 F04/F05（AI Store 审核/精选页，当前
  `blocked`，不在本 sprint 范围）。

### 2026-07-02 — issue #173 / F02 security follow-up
- 本轮目标: 在隔离 worktree `/private/tmp/boardx-worktrees/issue-173-admin-credit-security`
  修复 #173 指出的手动上分安全问题：同一 `Idempotency-Key` 并发请求不可双重入账，且单次
  手动上分金额必须有服务端上限。F02 在权威 `feature_list.json` 中已是 `passing`，本轮未重新
  claim、未手改 status。
- 已完成:
  - `packages/data/migrations/019_credit_transaction_idempotency.sql`: 为带 `idem:` 的
    `credit_transactions (wallet_id, label)` 增加部分唯一索引，避免影响普通重复 label。
  - `packages/data/src/credits.ts`: 新增 `recordTransactionIdempotent`，在事务内先抢唯一流水；
    只有插入成功者才更新钱包余额，冲突请求返回既有流水，不再触碰余额。
  - `apps/web/app/api/admin/users/[id]/credit/route.ts`: 带 idempotency key 的上分改走事务型
    幂等记账；单次金额上限设为 `100_000`，超限返回 400。
  - `apps/web/e2e/admin-001-manage-users.spec.ts`: 补充超限 400 和 8 个同 key 并发请求最终只
    入账一次的端到端断言。
- 运行过的验证:
  - `pnpm --filter @repo/data run typecheck` → 0
  - `pnpm --filter @repo/web run typecheck` → 0
  - `pnpm -w run verify:base` → 0（45/45 tasks successful）
  - `pnpm harness verify --sprint p15/03 --feature F02` → 0，但因 F02 已 `passing`，harness
    输出“F02 已 passing，跳过（不可逆）”，未执行新增 e2e。
- 未完成/阻塞的验证:
  - `docker compose -f infra/docker-compose.yml up -d` → 1，Docker daemon 不可连接：
    `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`。
  - `pnpm --filter @repo/data run migrate` → 1，Postgres 端口 `50404` 未监听：
    `ECONNREFUSED ::1/127.0.0.1:50404`。
  - `pnpm --filter @repo/web exec playwright test e2e/admin-001-manage-users.spec.ts` → 1，Next
    服务可启动，但用例依赖 DB，`/api/dev/grant-sysadmin` 等路径因同一 Postgres
    `ECONNREFUSED :50404` 返回 500；14 个用例中 1 个未登录跳转通过，其余 13 个 DB 依赖用例失败。
- 已记录证据:
  - `phases/phase-p15-admin/sprints/sprint-03/evidence/f02-05-admin-credit-security-followup.txt`
- 已知风险或未解决问题:
  - 当前机器 Docker daemon 不可用，本轮无法实际应用新增迁移或完成新增并发 e2e。代码层静态验证
    和基础验证已通过；需要 Docker/Postgres 恢复后重跑迁移与目标 e2e。
