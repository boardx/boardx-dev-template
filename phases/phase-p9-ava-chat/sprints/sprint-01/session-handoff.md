# 会话交接 — Sprint p9/01

## 当前已验证
- F01 实现完成，5/5 e2e（`e2e/ava-chat-basic.spec.ts`）本地通过，`@repo/ai`/`@repo/data`/`@repo/web`
  的 test/typecheck/lint 全绿，全仓 `verify:base`（41/41）确认未破坏基础状态。
  **尚未** `passing`：worker 不可自行标记，需 review 通过 + `pnpm harness verify --sprint p9/01` 门控。

## 本轮改动
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
- 真实 LLM 供应商接入未做（本 feature notes 明确 sanctioned 用 stub/mock，属预期范围）。
- 团队切换时线程列表清空/重载（F02 范围，未做）。
- 移动端 list-first 布局只验证了 Chromium 桌面视口下的 DOM/类名逻辑，未做真机/真移动视口测试。
- 本地环境：同机多个并行 worktree 占用 3000/5432/6379 端口，导致本地跑 verification 命令时
  需要临时用隔离端口（未提交进 diff，跑完已还原 `apps/web/playwright.config.ts` 到与 main 一致）。
  这不代表命令本身有问题，是共享开发机的环境限制。

## 下一步最佳动作
- coordinator：review 本 PR（`Closes #100`），过 review 后合并，跑
  `pnpm harness verify --sprint p9/01` 门控 F01 转 `passing`。
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
