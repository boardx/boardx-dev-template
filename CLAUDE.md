# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> 上面导入的 `AGENTS.md` 是根路由文件，包含**不可违反的硬约束**（单 feature、状态门控、
> 完成定义、干净收尾等）——先读它。本文件补充 Claude Code 常用的命令速查与架构大图，
> 不重复 AGENTS.md 已有内容。

Claude Code 专属路径：Skills 在 `.claude/skills/`（软链指向 `.agents/skills/` 真身）；
Subagents 在 `.claude/agents/`（由 `pnpm harness gen-subagents` 从 `.harness/agents/*.yaml`
生成，**不要手改生成物**）；机器特定配置放 `CLAUDE.local.md`（已 gitignore）。

## 常用命令

```bash
./init.sh                          # 每个新会话先跑：装依赖 + 装 git hooks + 生成 subagent + verify:base
pnpm -w run verify:base            # typecheck + lint + test（提交前必须通过）
pnpm -w run verify:full            # verify:base + web 生产构建 + (有 docker 时) pg/redis + migrate + 全量 e2e
pnpm dev / build / test / lint / typecheck   # turbo 全仓任务
```

单包 / 单测：

```bash
pnpm --filter @repo/web run test                              # 单包 vitest
pnpm --filter @repo/data exec vitest run src/rooms.test.ts    # 单个测试文件
pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts  # 单个 e2e
pnpm --filter @repo/web run lint                              # = scripts/lint-design.sh（UI 设计门控）
```

本地服务与数据库：

```bash
docker compose -f infra/docker-compose.yml up -d   # Postgres + Redis（e2e / 全栈验证前提）
pnpm --filter @repo/data run migrate               # 跑 migrations（读 apps/web/.env.local）
pnpm --filter @repo/web run dev                    # Next.js dev server（:3000，可用 E2E_PORT 覆盖）
pnpm --filter @repo/workflow-worker start          # BullMQ worker（异步生成链路的 e2e 依赖它）
```

harness CLI（完整命令见 `.harness/scripts/cli.ts`）：`new-phase`、`new-sprint`、`verify`、
`sync`、`gen-subagents`、`claim`、`lock-*` / `module-lock-*`（coordinator/模块锁）、
`sweep-*`（清理）、`cycle-report`、`dep-graph`。

## 架构大图

**三个平面**（README）：代码平面 `apps/` + `packages/`、控制平面 `.harness/`（指令/模板/状态/脚本）、
交付平面 `phases/`（phase → sprint → feature 时间线）。
工具链：turbo + pnpm 9（corepack）+ Node 22（`.nvmrc`）+ TypeScript strict + vitest + Playwright。

**运行时（代码平面）**——被构建的是 BoardX 全栈产品：

- `apps/web` — Next.js 14 App Router。页面在 `app/(app)/**`，API 在 `app/api/**/route.ts`
  （`currentUser()` 鉴权，401/403/404 语义一致）。e2e 测试在 `apps/web/e2e/`。
- `apps/workflow-worker` — BullMQ worker，消费 `boardx.jobs`，处理后状态回写 Postgres。
  要求幂等；纯函数与 IO 边界分离。
- `apps/orchestrator` — 智能体编排器（CAP-AI 规划态，尚未实质落地，见 architecture.md）。
- `packages/data` — **唯一** Postgres 访问层：显式 `pg` + SQL，不用 ORM；schema 只经
  `migrations/NNN_*.sql` 演进；对外只暴露仓储函数，调用方不碰 Pool / 裸 SQL。
- `packages/queue` — BullMQ 封装；队列名只出自 `QUEUE_NAMES`，禁止 magic string。
- `packages/storage` — S3 兼容对象存储（本地 MinIO），只暴露 key 级操作，key 规范
  `kb/{scope}/{ownerId}/{fileId}/{filename}`。
- `packages/coord-service` — Cloudflare Workers + D1 的 agent 协调服务（认领的原子性靠
  `uq_active_claim` 唯一索引一次 INSERT 保证；测试用 `@cloudflare/vitest-pool-workers`）。
- 其余：`auth`、`ai`、`canvas`（fabric）、`collab`、`memory`、`tools`、`coord-dashboard`。

数据模型（users / teams / rooms / boards / board_items / room_chats …）与实体关系见
`.harness/instructions/architecture.md`——它是代码平面的设计契约。

**依赖规则**：包间只通过公开导出依赖，禁止深路径 import；web 里禁止裸 SQL / 硬编码队列名，
一律走 `@repo/data` / `@repo/queue`。

## 跨切面的坑（读多个文件才能发现的约定）

- **pg `bigint` 返回字符串**不是 number：跨类型 `!==` / `===` 比较会恒真/恒假致 bug，
  比较前用 `Number()` 或 `String()` 统一（同为 bigint 的字段间比较安全，都是字符串）。
- 用到 pg / bullmq 的 API route 必须 `export const runtime = "nodejs"`（不能跑 edge）。
- 权限判定优先走 `packages/data` 的 SQL 仓储函数（`canViewRoom` / `canViewBoard` 等），
  不在 app 层散判。
- **UI 三态强制**：每个页面必须有 loading skeleton（`data-testid="loading"`）、empty state
  （`data-testid="empty"`）、error state（`role="alert"`）；禁裸 `<button>` / `<input>`（用
  `@/components/ui/*`），禁 hex 硬编码；提交前 `pnpm --filter @repo/web run lint`（lint-design）
  必过。完整清单（U1-U8）见 `apps/web/AGENTS.md` 与 `.harness/instructions/uiux-standards.md`。
- **e2e 必须覆盖真实导航路径**：新增顶层页面至少要有一条从已有入口点击进入的场景，
  不能全部 `page.goto()` 直达（testing-standards.md 记录过"功能存在但无入口"的教训）。
- **git hooks（init.sh 安装）会拦你**：pre-commit 拒绝手改 `active-features.json`、
  非 pnpm 9 lockfile、>800 文件的提交；pre-push 跑 `turbo --affected` 轻量门控
  （跳过用 `git push --no-verify`）；reference-transaction 在共享主 checkout 拦非快进
  更新（并发会话保护，临时放行 `ALLOW_HISTORY_REWRITE=1`；多会话并行请用 git worktree）。
- 单测不连真实 DB / Redis；真实交互由 `harness verify` + docker 覆盖。多 worktree 并行跑
  e2e 时用 `scripts/init-worktree-env.sh` 分配独立端口（避免 Playwright 复用到别的
  worktree 的 dev server）。

## 按需深入

包级约束看各 `apps/*/AGENTS.md`、`packages/*/AGENTS.md`（渐进披露第 2 层）；
规范细节看 `.harness/instructions/`（coding / testing / uiux / observability / 多 agent 协调）；
重大决策看 `docs/adr/` 与各 phase 的 `adr/`。
