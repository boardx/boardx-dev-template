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
  - **重要发现（影响所有 worker，非本 feature 专属）——`git push` 的 pre-push hook（`pnpm verify:full`）
    在本次多 agent 并行会话里不可靠**：`scripts/verify-full.sh` 的 `docker compose -f infra/docker-compose.yml up -d`
    用的是**默认 compose project 名（`infra`）且不支持 `COMPOSE_PROJECT_NAME` 隔离**；本机同时有多个 worker
    在各自 worktree 里跑同一份 `infra/docker-compose.yml`（观察到其它 worker 已经用
    `credits-p14-*`/`admf01-*`/`avaf01-*`/`boardxtmpl-*`/`feedback65-*` 等自定义 project 名规避冲突，
    说明这是已知痛点）。实测：我的 `verify:full` 跑到一半，`infra-postgres-1`/`infra-redis-1` 被另一个
    worker 的并发 `docker compose up -d` **原地重建成了空库**（`select count(*) from kb_files` 报
    `relation "kb_files" does not exist`），导致我的 e2e 在跑到一半时数据库被换成另一个全新空库，
    kb-001 两个用例假失败（`file-status-*` 元素消失 + 服务端二次校验返回 404 而非 400，见
    `evidence/kb-001-exact-command-port-collision.txt` 的姊妹现象）。同批还有 11 个与 kb 完全无关的用例
    （auth-login/auth-reset-password/ava-001/board-list-search/board-menu-001/canvas-007/profile-edit/
    profile-settings/widgets-001/widgets-004 ×2）一起失败，性质相同（多 agent 抢同一 docker 资源），
    不是我引入的回归。**`apps/web/e2e/kb-001-upload-file.spec.ts` 本身在隔离环境下稳定 5/5 通过**
    （见 `evidence/kb-001-e2e-pass.txt`，独立跑了 3 次全过）。`verify-full.sh` 另有一个独立 gap：
    未启动 `apps/workflow-worker`，任何依赖异步 job 回写状态的 e2e（如本 spec 等 ready）在纯按此脚本跑
    时即使数据库没被抢也会因无 worker 消费队列而卡在 processing，需要脚本自己起 worker 才闭环
    （见 `.harness/instructions/testing-standards.md` 里"CAP-WORKFLOW"一节本就要求手动起 worker，
    `verify-full.sh` 目前没自动化这一步）。
    **未对 `scripts/verify-full.sh`/`playwright.config.ts` 做任何改动**（怕影响其他并行 worker），
    只如实记录，建议 coordinator 后续统一给 `verify-full.sh` 加 `COMPOSE_PROJECT_NAME` 隔离 +
    自动起停 `workflow-worker`，作为独立的 harness 基础设施改进项，不在本 F01 范围内。
- 下一步最佳动作: 等 review（rev-code / rev-e2e / rev-feature）过后由 coordinator 合并；下一个 worker 可在
  `@repo/storage` 基础上做 F02（列表/搜索/分页/下载）。coordinator 可考虑把上述 pre-push hook 隔离问题
  列为独立的 harness 基础设施 issue（影响所有并行 worker，不只本 feature）。
