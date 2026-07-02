# 进度日志 — Sprint p9/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（本次在 worktree .claude/worktrees/agent-af30bb5709423de82 中开发，分支 worker/wrk-ava-1-p9-f01-ava-chat-shell）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 — 聊天线程列表 CRUD（F01 已 passing；本 worktree 只处理 issue #153 安全补丁）
- 当前 blocker: 无（功能层面）。环境层面：普通 sandbox 不能直接访问 Docker socket / Next dev 监听端口 / tsx IPC pipe；本次相关 Docker、migrate、Playwright 命令均用升级权限重跑通过。

## 会话记录
### 2026-07-02 (wrk-codex-ava-sec-1 / issue #153)
- 本轮目标: 修复 p9-F01 AVA 线程详情与发消息接口缺少团队上下文隔离的问题。同一用户在 team A 创建的线程，切到 team B 或个人上下文后，不得凭 threadId 读取详情或追加消息。
- 已完成:
  - `apps/web/app/api/ava/threads/[id]/route.ts` 的 owner check 增加 `thread.team_id === currentTeamId()`，保留 null 对 null 的个人上下文访问。
  - `apps/web/app/api/ava/threads/[id]/messages/route.ts` 使用同一校验，在解析 body / 插入消息前拒绝跨团队上下文访问。
  - 新增 route 单测 `apps/web/app/api/ava/threads/[id]/route.test.ts`，覆盖同用户 team A 线程在 team B / 个人上下文不可读取、不可追加消息，以及个人线程 null 对 null 可读取。
  - `apps/web/vitest.config.ts` 增加 `@` alias，使 app route handler 可被 Vitest 直接导入测试。
- 运行过的验证:
  - `pnpm --filter @repo/web exec vitest run 'app/api/ava/threads/[id]/route.test.ts'` — 4/4 passed。
  - `pnpm --filter @repo/web run typecheck` — passed。
  - `pnpm --filter @repo/web run test` — 5 files / 16 tests passed。
  - `pnpm --filter @repo/data run typecheck` — passed。
  - `pnpm --filter @repo/data run test` — 6 files / 31 tests passed。
  - `pnpm -w run verify:base` — turbo 45/45 successful。
  - `docker compose -f infra/docker-compose.yml up -d` — sandbox 内 Docker socket 权限失败；升级权限重跑后 postgres/redis/minio started。
  - `pnpm --filter @repo/data run migrate` — sandbox 内 tsx IPC pipe 权限失败；升级权限重跑后迁移全部通过。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts` — sandbox 内 Next dev 监听端口权限失败；升级权限重跑后 5/5 passed。
- 已记录证据: `phases/phase-p9-ava-chat/sprints/sprint-01/evidence/issue-153-ava-team-context-security.log`
- 提交记录: 待本会话提交。
- 已知风险或未解决问题:
  - 本次没有新增真实 DB 的跨团队 e2e；安全回归由 route unit test 精确覆盖，现有 AVA e2e 验证 F01 主流程未回归。
  - 普通 sandbox 下 Docker/Next/tsx 本地 socket 相关命令会被权限拦截，需要升级权限才能跑。
- 下一步最佳动作:
  - review 本安全补丁分支，重点看两个 route 是否所有读写路径都在 team check 后才继续。

### 2026-07-01 (wrk-ava-1)
- 本轮目标: 实现 F01（AVA 聊天壳地基）：/ava 页面、线程 CRUD 最小集（列表+创建+详情）、
  发消息 + SSE 流式回复、Markdown/代码块渲染、DB 持久化、生成失败保留态。
- 已完成:
  - 新建 `packages/ai`（CAP-AI 地基）：`gateway.ts`（LiteLLM 风格网关，`ChatGateway` + `stubProvider`，
    按 modelId 前缀路由；含确定性失败触发词 `FORCE_FAIL_MARKER` 供 e2e 用）+ `graph.ts`
    （LangGraph 风格最小单节点图 `runChatGraph`/`makeGenerateNode`，为 F06 Deep Research 多节点图预留扩展点）。
  - 新建 `packages/data/src/avaChat.ts`：`ava_threads`/`ava_messages` 仓储（team_id/user_id/thread_id
    组织，team_id 可空=个人上下文），迁移 `packages/data/migrations/016_ava_chat.sql`。
  - 新 API：`POST/GET /api/ava/threads`、`GET /api/ava/threads/:id`、
    `POST /api/ava/threads/:id/messages`（SSE：event: user/token/done/error）。
  - 新页面 `apps/web/app/(app)/ava/page.tsx`：桌面双栏常驻、移动端 list-first + 返回入口；
    空态建议、composer、Markdown/代码块渲染（`markdown-message.tsx`，未依赖 Tailwind typography 插件）。
  - 删除旧 in-memory 原型：`apps/web/app/api/ava/route.ts`、旧 `apps/web/app/(app)/ava/page.tsx`、
    旧 `apps/web/e2e/ava-001-start-chat.spec.ts`（API 契约已被 F01 的 REST/SSE 契约取代）。
  - `apps/web/lib/session.ts` 新增 `currentTeamId()`（复用既有 `CURRENT_TEAM_COOKIE` 约定）。
  - 新增 `apps/web/e2e/ava-chat-basic.spec.ts`（5 个 case：主流程+Markdown/代码块渲染、未登录跳转、
    空消息 400、生成失败保留输入、未登录发消息 401）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（本地用隔离端口 PG_PORT=15490/REDIS_PORT=16390/
    COMPOSE_PROJECT_NAME=avaf01 避免与同机其它并行 worktree 冲突）
  - `pnpm --filter @repo/data run migrate` — 含新迁移 016_ava_chat.sql，全部 exit 0。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts` — 5/5 passed。
  - `pnpm --filter @repo/ai run test`（10/10）、`pnpm --filter @repo/data run test`（19/19，含新
    `avaChat.test.ts`）、`pnpm --filter @repo/ai run typecheck`、`pnpm --filter @repo/data run typecheck`、
    `pnpm --filter @repo/web run typecheck`、`pnpm --filter @repo/web run lint`（design lint）— 全部通过。
  - `pnpm -w exec turbo run typecheck lint test --concurrency=1`（避开同机多 worktree 并发导致的 CPU
    争抢 flake）— 41/41 successful，确认未破坏 `init.sh` 基础验证。
- 已记录证据: `phases/phase-p9-ava-chat/sprints/sprint-01/evidence/`
  - `f01-verification-run.log`（docker up + migrate + 目标 e2e spec 输出）
  - `f01-unit-typecheck-lint.log`（@repo/ai、@repo/data、@repo/web 的 test/typecheck/lint）
  - `f01-verify-base-full.log`（全仓 `turbo run typecheck lint test` 41/41）
- 提交记录: 分支 `worker/wrk-ava-1-p9-f01-ava-chat-shell`，PR 待 push 后由本会话报告 URL（`Closes #100`）。
- 已知风险或未解决问题:
  - `packages/ai` 目前只注册 stub provider（确定性回显 + Markdown/代码块示例），未接入任何真实
    LLM 供应商；真实供应商接入是后续工作（本 feature notes 明确 sanctioned 用 mock/stub）。
  - 团队上下文（`currentTeamId()`）目前只读现有 `CURRENT_TEAM_COOKIE`，无团队时线程为
    `team_id IS NULL` 的个人上下文；未验证「切换团队清空/加载线程」（那是 F02 的范围）。
  - 移动端 list-first 的分栏切换是本 feature 首次引入的模式（此前无强先例可循），已用 Tailwind
    响应式类实现并保留 `back-to-list` data-testid，但未做真机测试，只验证了 Chromium 桌面视口下的
    DOM/类名切换逻辑正确。
  - 本地复现 verification 命令时，因同机有多个并行 agent worktree 占用 3000/5432/6379 端口，
    需要临时改本地未提交的端口配置；这是环境限制，不代表 verification 命令本身有问题（见上）。
- 下一步最佳动作:
  - coordinator/reviewer：review PR，通过后合并到 main，再跑 `pnpm harness verify --sprint p9/01`
    门控 F01 转 `passing`。
  - 下一个 worker 可在 F01 合并后开始 F02（线程列表 CRUD：分组/重命名/删除/团队隔离），
    复用本 feature 建的 `ava_threads`/`ava_messages` 表与 API 结构。
