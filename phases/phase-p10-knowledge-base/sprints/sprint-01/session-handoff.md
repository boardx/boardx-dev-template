# 会话交接 — Sprint p10/01

## 当前已验证
- F01（上传知识库文件）：实现完成，`pnpm -w run verify:base` 全绿（41/41）；
  e2e `kb-001-upload-file.spec.ts` 在隔离环境下 5/5 通过（真实 MinIO 对象 + 真实 `kb_files` 表状态推进到 `ready`）。
  status 仍是 `in_progress`——**未自行标 passing**，等 `pnpm harness verify` 门控转移（AGENTS.md 硬约束）。

## 本轮改动
- 新增 `packages/storage`（CAP-FILE：S3/MinIO 封装 + 上传校验纯函数）。
- `infra/docker-compose.yml` 新增 `minio` 服务。
- `packages/data`：新增 `016_kb_files.sql` 迁移 + `kbFiles.ts` 仓储。
- `packages/queue`：新增 `kbFileProcessing` 队列名。
- `apps/workflow-worker`：新增 kb 文件处理 worker 逻辑（`kbFileJob.ts` + 接入 `main.ts`）。
- `apps/web`：新 `api/kb/files/route.ts`（真实 multipart 上传）替换旧桩化 `api/knowledge-base/route.ts`（已删除）；
  `knowledge-base/page.tsx` 改真实上传（XHR 进度 + 拖拽）；重写 `e2e/kb-001-upload-file.spec.ts`。

## 仍损坏或未验证
- 本机（非 CI）跑字面验证命令时，3000/5432/6379 端口被另一个不相关 worktree 占用，导致
  `reuseExistingServer:true` 复用了别人的旧服务器/DB——**这是本机环境问题，不是代码问题**。
  证据见 `evidence/kb-001-exact-command-port-collision.txt`（那次失败的原始输出）vs
  `evidence/kb-001-e2e-pass.txt`（隔离端口下 5/5 通过）。CI/干净环境应直接可用标准命令。
- F04（RAG 检索）需要的真实解析/切分/向量化算法未实现（按 notes 属于范围外，故意留白）。
- 下载（F02）、删除（F03）按钮是纯 UI 占位，未接后端——按 feature 边界故意不做。

## 下一步最佳动作
- 等 code-reviewer / e2e-verifier / feature-evaluator 三个 reviewer 过 gate，coordinator 合并 PR
  （`worker/wrk-kb-1-p10-f01-kb-upload`，Closes #111）。
- 合并后跑 `pnpm harness verify --sprint p10/01` 门控转移 F01 → passing（不要手改 status）。
- 下一个 worker 可基于 `@repo/storage`/`kb_files` 表开 F02（列表/搜索/分页/下载，`presignGetUrl` 已就绪可直接用）。
- **不要**在 F01 未 passing 前动 F02/F03/F04 的实现（依赖 F01 先落地）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p10/01`
- 调试（本机端口冲突时的隔离验证方式）:
  ```bash
  export COMPOSE_PROJECT_NAME=p10f01
  export PG_PORT=15434 REDIS_PORT=16381 MINIO_PORT=19092 MINIO_CONSOLE_PORT=19093
  docker compose -f infra/docker-compose.yml up -d
  export DATABASE_URL=postgresql://boardx:boardx@localhost:15434/boardx
  export REDIS_URL=redis://localhost:16381
  export S3_ENDPOINT=http://localhost:19092 S3_ACCESS_KEY=boardx S3_SECRET_KEY=boardx123 S3_BUCKET=boardx-kb
  pnpm --filter @repo/data run migrate
  pnpm --filter @repo/workflow-worker run dev &   # 起 worker 消费 kb-file-processing 队列
  pnpm --filter @repo/web exec playwright test e2e/kb-001-upload-file.spec.ts
  ```
