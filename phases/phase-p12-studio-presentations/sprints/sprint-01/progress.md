# 进度日志 — Sprint p12/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（worktree: agent-a4ad9667ab850dbea）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01 已实现并本地验证通过，等待 `pnpm harness verify` 门控转 passing
- 当前 blocker: 无（F01 本身）；发现两个与本 feature 无关的既有基础设施小问题，已 spawn 独立任务记录，不阻塞本 PR

## 会话记录
### 2026-07-01 13:29:12
- 本轮目标: 实现 F01（Studio 面板 + 音频概览/信息图生成，结果入聊天），owner wrk-studio-1
- 已完成:
  - `packages/data`：新增 `017_studio_artifacts.sql` 迁移 + `src/studio.ts` 仓储
  - `packages/queue`：新增 `studioGeneration` 队列名
  - `packages/ai`：新增 `studioGenerator.ts`（sanctioned mock 生成器，含 FORCE_FAIL 测试触发词）
  - `packages/storage`：新增 `buildStudioObjectKey`
  - `apps/workflow-worker`：新增 `studioJob.ts` 处理器，`main.ts` 注册消费
  - `apps/web`：5 个 Studio API 路由（generate/sources/artifacts/retry/download）；
    新组件 `components/studio/studio-panel.tsx`；改造 `rooms/[id]/chats/[chatId]/page.tsx`
    把 `pane-studio` 占位换成真实面板 + 聊天内结果卡片
  - 重写 `apps/web/e2e/studio-001-generate-artifact.spec.ts`（原文件测的是不相关的早期独立
    `/studio` 页面桩，与 F01 房间聊天集成验收不符，按真实验收标准重写）
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d` ✓
  - `pnpm --filter @repo/data run migrate` ✓（含新 017 迁移）
  - `pnpm --filter @repo/web exec playwright test e2e/studio-001-generate-artifact.spec.ts` ✓ 9/9 通过
  - `pnpm -w run verify:base`（typecheck + lint + test）✓ 45/45 通过
  - 回归检查：`ava-chat-basic.spec.ts`、`kb-001-upload-file.spec.ts`、
    `room-chat-create.spec.ts`（New Chat 三栏工作区场景）全部通过，无回归
  - `bash scripts/verify-full.sh`（生产 build + 全量 275 个 e2e）：206 passed / 69 failed；
    逐一核对 69 个失败均为既有 `ECONNREFUSED ::1:3000`（e2e helper 硬编码端口 3000，与
    `E2E_PORT` 不一致的既有 bug），零个 `studio-*` 失败
- 已记录证据:
  - `phases/phase-p12-studio-presentations/sprints/sprint-01/evidence/studio-001-generate-artifact.e2e.txt`
  - `phases/phase-p12-studio-presentations/sprints/sprint-01/evidence/verify-base.txt`
  - `phases/phase-p12-studio-presentations/sprints/sprint-01/evidence/verify-full.txt`
- 提交记录: 分支 `worker/wrk-studio-1-p12-f01-studio-panel`（见 PR）
- 已知风险或未解决问题:
  - "房间文件"来源语义 = kb_files（personal/team scope 映射），非真正房间级文件关联表（现有
    schema 限制，见 session-handoff.md 详述）
  - 旧独立 `/studio` 页面桩未清理，与新面板并存但语义不同，留给后续判断
  - 发现两个既有基础设施小问题（worktree docker-compose 端口变量缺失、部分 e2e 硬编码端口
    3000），均与本 feature 无关，已 spawn 独立任务跟踪，未在本 PR 内修复
- 下一步最佳动作: 协调者 review 后跑 `pnpm harness verify --sprint p12/01` 转 F01 passing；
  之后 F02（生成演示文稿）depends_on F01 可解锁分配

### 2026-07-02（同日续，PR #158 code review 后一轮修复）
- 本轮目标: 修复协调者转达的 code review 发现——2 个 high-severity 授权/数据范围 bug + 2 个
  medium-severity（入队失败静默/状态机跳步）+ 1 个 medium（500 泄露内部错误）
- 已完成:
  - `retry/route.ts` 补上与 `generate` 一致的 `chat.creator_user_id === user.id` 创建者校验（403）
  - 新增 `apps/web/lib/studio.ts` 的 `listRoomFiles(room)`：把"房间文件"查询从
    `ownerUserId: 当前请求者` 改锚定为 `room.owner_user_id`（房间 owner），修复个人房间下不同
    成员看到彼此无关私人文件的越权/数据错误问题；`generate`/`sources` 路由改用该共享函数
  - `generate`/`retry` 路由：入队失败时不再静默吞掉，立即 `markStudioArtifactError` 回写 error
    并在响应体带上更新后状态
  - `apps/workflow-worker/src/main.ts`：studioWorker 补上 `markStudioArtifactProcessing` 调用，
    使 queued → processing → ready/error 状态机名副其实
  - 五个 Studio 路由的 500 分支改为固定用户可读文案，不再 `String(err)` 泄露内部信息
  - `e2e/studio-001-generate-artifact.spec.ts` 新增 2 个回归场景（共 12 个）：非创建者重试 403、
    请求者私人文件不泄露进房间文件来源判定
- 运行过的验证:
  - `pnpm -w run verify:base` ✓ 45/45（typecheck+lint+test）
  - `pnpm --filter @repo/web exec playwright test e2e/studio-001-generate-artifact.spec.ts` ✓ 12/12
    （本轮验证期间机器负载剧烈波动导致同一命令多次运行时出现不同的偶发超时/`ECONNREFUSED`/
    Postgres recovery-mode 报错——单独重跑失败用例均通过，且失败点不集中在改动代码上，判定为
    共享机器资源争用而非逻辑问题；额外用 curl 直接调用两个 high-severity 修复对应的路由做了
    独立于浏览器的确定性验证，结果一致通过）
- 已记录证据（覆盖写入，反映本轮修复后的最终状态）:
  - `phases/phase-p12-studio-presentations/sprints/sprint-01/evidence/studio-001-generate-artifact.e2e.txt`
  - `phases/phase-p12-studio-presentations/sprints/sprint-01/evidence/verify-base.txt`
- 已知风险或未解决问题: "房间文件"仍非真正房间级关联（kb_files 无 room_id），只是从"请求者个人
  文件"改为更一致的"房间 owner 个人文件"近似——真要做房间级文件仍需新表，已在代码注释标记
  KNOWN LIMITATION
- 下一步最佳动作: 协调者重新 review PR #158，确认两个 high-severity 已解决后可推进
  `pnpm harness verify --sprint p12/01`
