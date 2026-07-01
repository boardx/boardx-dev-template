# 进度日志 — Sprint p10/01

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/agent-a149a3222fb0bb96c`（worker wrk-kb-1）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01 — 上传知识库文件（自动上传 + 类型/大小校验 + 处理状态）
- 当前 blocker: 无（功能已实现并本地全绿；`harness verify` 门控转移留给下一轮/CI，见下）

## 会话记录
### 2026-07-01 09:04:00
- 本轮目标: 实现 F01（CAP-FILE 地基：对象存储 + kb_files 表 + 上传管线 + 解析/切分/向量化 worker）。
- 已完成:
  - `infra/docker-compose.yml` 新增 `minio` 服务（S3 兼容对象存储，本地开发默认端口 9090/9091）。
  - 新包 `packages/storage`（CAP-FILE）：S3 client 封装（`putObject`/`getObjectStream`/`deleteObject`/`presignGetUrl`/`ensureBucket`），
    对象 key 规范 `kb/{scope}/{ownerId}/{fileId}/{fileName}`，上传校验纯函数 `validateKbUpload`（类型/大小，前后端共用）。
  - `packages/data/migrations/016_kb_files.sql` + `packages/data/src/kbFiles.ts`：`kb_files` 表
    （scope=personal/team/agent/tool + owner_user_id + team_id + status），仓储函数（create/get/list/setStatus/delete）。
  - `packages/queue`：新增 `QUEUE_NAMES.kbFileProcessing` 队列名常量。
  - `apps/workflow-worker`：新增 `kbFileJob.ts`（纯逻辑：objectKey 非空 → ready，否则 error）+ 接入 `main.ts` 消费
    `boardx.kb-file-processing` 队列，回写 `kb_files.status`（processing → ready/error）。真实解析/切分/向量化算法
    留给后续 RAG feature（F04），本 feature 只需把状态机跑通、不吞错误。
  - `apps/web/app/api/kb/files/route.ts`：真实 `POST /api/kb/files`（multipart）+ `GET`（按 scope+权限过滤列出）。
    服务端二次校验（不信任前端）；**先写对象存储成功后才落 kb_files 记录**（失败不产生半条记录）；写库后异步入队处理。
    删除了旧的桩化 `apps/web/app/api/knowledge-base/route.ts`（内存态、无真实存储/DB，属于 UI-prototyper 阶段产物）。
  - `apps/web/app/(app)/knowledge-base/page.tsx`：改为真实 multipart 上传（XHR，带真实上传进度事件），支持点击和拖拽两种入口；
    轮询刷新列表以观察 processing→ready 异步状态推进。
  - `apps/web/e2e/kb-001-upload-file.spec.ts`：重写为真实链路验收（不再是桩化元数据），覆盖：空态→上传→列表出现→
    最终 ready；类型/大小校验拒绝（不产生半条记录）；服务端二次校验绕过前端仍 400；未登录跳转登录。
- 运行过的验证:
  - `pnpm -w run verify:base` → 41/41 通过（typecheck+lint+test，含新增 storage/kbFiles/kbFileJob 单测）。
  - `docker compose -f infra/docker-compose.yml up -d` + `pnpm --filter @repo/data run migrate` → 016 迁移成功。
  - `pnpm --filter @repo/web exec playwright test e2e/kb-001-upload-file.spec.ts`（在本机独立 docker 命名空间 + 独立端口下）
    → **5/5 通过**，含 MinIO 对象落盘核实（`mc ls` 可见真实对象）+ `kb_files` 表状态推进到 `ready` 的 DB 核实。
- 已记录证据（`evidence/`）:
  - `verify-base.txt`（verify:base 全量输出）
  - `kb-001-e2e-pass.txt`（e2e 5/5 通过，独立端口/独立 docker 命名空间下）
  - `minio-objects.txt`（`mc ls` 输出，证明对象真实落盘 MinIO）
  - `kb_files-rows.json`（DB 里 kb_files 记录，status=ready，object_key 正确）
  - `kb-001-exact-command-port-collision.txt`（诚实记录：字面验证命令在本机因端口冲突失败的原始输出，见下「已知风险」）
- 提交记录: 见分支 `worker/wrk-kb-1-p10-f01-kb-upload` 的 PR（Closes #111）。
- 已知风险或未解决问题:
  - **本机端口冲突（环境问题，非代码缺陷）**：本机 3000/5432/6379 端口已被另一个不相关的 worktree
    （`boardx-dev-template-uiux-improvements`）的 `next dev` / 之前遗留的 `boardx_redis`/`boardx_postgres` 容器占用。
    字面验证命令 `pnpm --filter @repo/web exec playwright test e2e/kb-001-upload-file.spec.ts` 因
    `playwright.config.ts` 的 `reuseExistingServer:true` 复用了别的 worktree 的旧服务器/旧数据库，导致 4/5 用例失败
    （非本 feature 逻辑问题，是连错了服务器）。用独立 docker compose 命名空间（`COMPOSE_PROJECT_NAME`）+ 独立端口
    + 本地临时 playwright config 隔离跑，5/5 全过。CI / 干净环境下字面命令应可直接通过（端口不会被占用）。
    未对仓库共享的 `playwright.config.ts` 做任何改动（临时隔离 config 只在本地验证时用过，未纳入提交）。
  - `next dev` 冷启动首次编译 `/knowledge-base` 路由较慢，首个用例在服务器刚起时可能超出 10s 断言超时
    （预热一次后稳定通过）；与 `.harness/instructions/testing-standards.md` 提到的 CI timing flake 是同类问题，
    真实 CI 环境用 `reuseExistingServer:true` 时通常已预热，不受影响。
  - 真实的解析/切分/向量化算法（parse/chunk/vectorize）是桩化的（只跑状态机 processing→ready），
    真实算法留给 F04（RAG 检索）落地时实现，符合 F01 notes 的范围边界。
  - 下载/删除按钮在列表行里是纯 UI 占位（未接后端），因为下载=F02、删除=F03，不在本 feature 范围内。
- 下一步最佳动作: 等 review（rev-code / rev-e2e / rev-feature）过后由 coordinator 合并；下一个 worker 可在
  `@repo/storage` 基础上做 F02（列表/搜索/分页/下载）。
