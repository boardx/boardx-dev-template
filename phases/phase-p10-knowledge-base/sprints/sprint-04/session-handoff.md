# 会话交接 — Sprint p10/04

## 当前已验证
- F04（AI 引用知识库上下文 — RAG 检索 + 作用域隔离）：实现完成，声明的 3 条 verification
  命令（docker compose up -d / data migrate / playwright kb-004 spec）全部跑绿，evidence 已落盘
  在 `phases/phase-p10-knowledge-base/sprints/sprint-04/evidence/F04.verify.log`。**尚未** passing——
  状态转移只能靠 `pnpm harness verify`，本会话未自行改 feature_list.json。

## 本轮改动
- `packages/data/src/kbFiles.ts`：新增 `retrieveKbFilesForQuery` + `KbRetrievalHit`（关键词/文件名
  匹配的确定性检索占位，作用域隔离 personal/agent/tool 限 owner、team 限当前团队上下文成员，
  只查 `status='ready'`）。
- `apps/web/app/api/ava/threads/[id]/messages/route.ts`：`file-reader` 工具启用时调用检索，命中
  文件名拼进消息上下文标记（`[知识库引用: …]`）。
- `packages/ai/src/gateway.ts`：stub provider 识别该标记，在回复里列出「引用来源」；无命中不虚构。
- 新增 `apps/web/e2e/kb-004-use-file-in-ai-context.spec.ts`（6 用例，含跨用户/跨团队隔离）。

## 仍损坏或未验证
- 无已知代码问题。共享机器在本会话期间出现过 postgres 容器 crash-loop 和 `@repo/auth#test`
  在高并发 turbo 全量跑下的 5s bcrypt 超时抖动——均确认与本次改动无关（`@repo/auth` 单独跑
  15/15 通过两次；本次 diff 未碰 `packages/auth`）。若下一轮 `pnpm harness verify` 仍撞见类似
  抖动，建议先单独重跑一次失败的具体 task 判断是否真实回归，而非直接判 fail。
- 检索仍是关键词匹配，非真实向量检索——这是 F01/F03 既定范围边界，不是本轮缺口。

## 下一步最佳动作
- 下一轮触发 `pnpm harness verify --sprint p10/04` 走门控转 F04 passing。
- 不要动：`packages/data/src/kbFiles.ts` 里 F01-F03 已有的函数（getAccessibleKbFile 等）、
  `packages/ai/src/gateway.ts` 里附件引用（F08）相关的既有标记逻辑——本轮只新增、未改动这些。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p10/04`
- 调试:
  - `docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/kb-004-use-file-in-ai-context.spec.ts`
  - 若怀疑共享机器抖动：`uptime` 看 load average；`docker logs <worktree>-postgres-1 --tail 50`
    看是否 FATAL/recovery loop；单独 `pnpm --filter <pkg> run test` 复核是否真回归。
