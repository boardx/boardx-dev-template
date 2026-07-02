# 会话交接 — Sprint p9/01

## 当前已验证
- F01 已在 `feature_list.json` 中为 `passing`。本 worktree 是 issue #153 安全补丁，不修改 feature 状态。
- 安全补丁验证通过：
  - `pnpm --filter @repo/web exec vitest run 'app/api/ava/threads/[id]/route.test.ts'` — 4/4 passed。
  - `pnpm --filter @repo/web run typecheck` — passed。
  - `pnpm --filter @repo/web run test` — 5 files / 16 tests passed。
  - `pnpm --filter @repo/data run typecheck` / `pnpm --filter @repo/data run test` — passed。
  - `pnpm -w run verify:base` — turbo 45/45 successful。
  - `docker compose -f infra/docker-compose.yml up -d`、`pnpm --filter @repo/data run migrate`、`pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts` 在普通 sandbox 下分别被 Docker socket / tsx IPC pipe / Next listen 权限拦截；升级权限重跑均通过（Playwright 5/5 passed）。

## 本轮改动
- Issue #153: `GET /api/ava/threads/:id` 与 `POST /api/ava/threads/:id/messages` 的属主校验现在同时要求 `thread.team_id === currentTeamId()`；个人上下文只匹配 `thread.team_id IS NULL`。
- 新增 `apps/web/app/api/ava/threads/[id]/route.test.ts`，用 route-level unit test 覆盖同一用户跨 team / team 到个人上下文不可读取、不可追加消息，和 null 对 null 可读取。
- `apps/web/vitest.config.ts` 增加 `@` alias，支持 app route handler 单测导入 `@/lib/session`。

## 历史 F01 改动
- 新增 `packages/ai`（CAP-AI：LiteLLM 风格网关 `gateway.ts` + LangGraph 风格最小图 `graph.ts`，
  stub provider 含确定性失败触发词 `FORCE_FAIL_MARKER`）。
- 新增 `packages/data/src/avaChat.ts` + 迁移 `packages/data/migrations/016_ava_chat.sql`
  （`ava_threads`/`ava_messages`，team_id/user_id/thread_id 组织）。
- 新增 API：`/api/ava/threads`（GET/POST）、`/api/ava/threads/:id`（GET）、
  `/api/ava/threads/:id/messages`（POST，SSE 流式：event user/token/done/error）。
- 重写 `/ava` 页面（桌面双栏常驻 / 移动 list-first + 返回入口，空态建议、Markdown/代码块渲染）。
- `apps/web/lib/session.ts` 加 `currentTeamId()`。
- 删除旧 in-memory 原型（`/api/ava/route.ts`、旧 `/ava/page.tsx`、旧
  `e2e/ava-001-start-chat.spec.ts`）——被本 feature 的 REST/SSE 契约取代。
- 新 e2e：`apps/web/e2e/ava-chat-basic.spec.ts`。

## 仍损坏或未验证
- 本次未新增真实 DB 的跨团队 e2e；已有 route 单测是 issue #153 的直接回归测试，现有 AVA e2e 验证主流程不回归。
- 普通 sandbox 下 Docker/Next/tsx 本地 socket 相关命令会失败；需要升级权限运行，详见 evidence `issue-153-ava-team-context-security.log`。
- 真实 LLM 供应商接入未做（本 feature notes 明确 sanctioned 用 stub/mock，属预期范围）。
- 团队切换时线程列表清空/重载（F02 范围，未做）。
- 移动端 list-first 布局只验证了 Chromium 桌面视口下的 DOM/类名逻辑，未做真机/真移动视口测试。
- 本地环境：同机多个并行 worktree 占用 3000/5432/6379 端口，导致本地跑 verification 命令时
  需要临时用隔离端口（未提交进 diff，跑完已还原 `apps/web/playwright.config.ts` 到与 main 一致）。
  这不代表命令本身有问题，是共享开发机的环境限制。

## 下一步最佳动作
- reviewer：review issue #153 安全补丁，重点确认所有单线程详情/消息追加路径都先校验当前团队上下文。
- 下一个 worker：F01 合并后可开始 F02（线程列表 CRUD：按日期分组/重命名/删除/团队隔离），
  直接复用本 feature 建立的 `ava_threads`/`ava_messages` 表和 `/api/ava/threads` 系列路由。
  不要动 `packages/ai` 的 gateway/graph 接口签名（F06 Deep Research 会在其上扩展多节点图）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/01`
- 调试:
  ```bash
  PG_PORT=15490 REDIS_PORT=16390 COMPOSE_PROJECT_NAME=avaf01 docker compose -f infra/docker-compose.yml up -d
  DATABASE_URL=postgresql://boardx:boardx@localhost:15490/boardx pnpm --filter @repo/data run migrate
  DATABASE_URL=postgresql://boardx:boardx@localhost:15490/boardx REDIS_URL=redis://localhost:16390 \
    pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts
  ```
