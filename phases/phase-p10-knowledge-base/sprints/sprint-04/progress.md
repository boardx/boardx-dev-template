# 进度日志 — Sprint p10/04

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（worktree: worker/wrk-kb-1-p10-f04-rag-scope）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F04（AI 引用知识库上下文 — RAG 检索 + 作用域隔离），实现已完成、
  三条声明的 verification 命令均已跑绿，等待 `pnpm harness verify` 门控转 passing（不可自升）。
- 当前 blocker: 无。（本轮期间共享机器曾出现 postgres 容器 crash-loop / auth 包测试因
  CPU 抢占超时的瞬时抖动，已定位为宿主机负载问题、与本 feature 代码无关，见下方记录。）

## 会话记录
### 2026-07-02 08:40:47
- 本轮目标: 实现 p10-F04（RAG 检索 + 作用域隔离），写并跑通声明的 playwright 验证，落证据。
- 已完成:
  - `packages/data/src/kbFiles.ts`：新增 `retrieveKbFilesForQuery`（+`KbRetrievalHit` 类型）——
    按关键词对 `kb_files.name` 做 ILIKE 匹配的确定性检索占位（F01/F03 notes 已明确向量索引留
    给后续，本阶段无抽取正文内容可向量化）；作用域隔离口径与 `getAccessibleKbFile` 一致但更严格
    收窄到当前团队上下文（`teamId` 参数，而非用户所属的任意团队）；只检索 `status='ready'`。
  - `apps/web/app/api/ava/threads/[id]/messages/route.ts`：仅当 `toolIds` 含 `file-reader` 时才
    调用检索，命中文件名拼进最后一条用户消息内容（同附件文件名的 `[知识库引用: …]` 标记模式）。
  - `packages/ai/src/gateway.ts`：`buildStubReply` 识别该标记，在 stub 回复中显式列出「引用来源」；
    无命中/未启用工具时不产生该标记，不虚构引用。
  - 新增 e2e：`apps/web/e2e/kb-004-use-file-in-ai-context.spec.ts`（6 个用例：命中引用、未启用
    工具不引用、processing 文件不参与检索、无命中不虚构、跨用户 personal 隔离、跨团队上下文隔离）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/kb-004-use-file-in-ai-context.spec.ts` → 6 passed（多次重跑，最终稳定 3 连过）
  - 附加：`@repo/data`/`@repo/ai`/`@repo/web` typecheck、`@repo/ai` 单测、`@repo/web` lint（design lint）均通过。
  - `./init.sh` 两次在高并发共享机器负载（load avg 一度 100+）下于 `@repo/auth#test` 的
    bcrypt 5s 超时用例上失败；`pnpm --filter @repo/auth run test` 单独跑两次均 15/15 通过
    （945ms～3.9s），且本次改动未触碰 `packages/auth` 任何文件——判定为宿主机资源抢占导致的
    瞬时抖动，非本 feature 引入的回归。
- 已记录证据: `phases/phase-p10-knowledge-base/sprints/sprint-04/evidence/F04.verify.log`
- 提交记录: 见分支 `worker/wrk-kb-1-p10-f04-rag-scope` 的提交与对应 PR。
- 已知风险或未解决问题:
  - 检索是关键词/文件名匹配，非真实向量语义检索（与 F01/F03 既定 notes 一致，非本轮引入的缺口）。
  - 共享机器在高并发 worktree 场景下 postgres 容器偶发 crash-loop / broken pipe，建议后续
    评估给各 worktree 的 postgres 加内存/连接数限制，减少互相拖累。
- 下一步最佳动作: 等待 `pnpm harness verify --sprint p10/04` 门控 F04 转 passing；若后续要接
  真实向量检索，需先给 kb_files 增加抽取正文/embedding 存储（当前完全没有该字段）。
