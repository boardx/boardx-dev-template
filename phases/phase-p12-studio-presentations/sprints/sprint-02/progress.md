# 进度日志 — Sprint p12/02

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（worktree: agent-a59333eeac2f20781）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 已实现并本地验证通过，等待 `pnpm harness verify` 门控转 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-02
- 本轮目标: 实现 F02（生成演示文稿：配置弹窗 + 生成进度 + 预览卡片），owner wrk-studio-1，
  issue #122。最大化复用 F01 的 studio_artifacts 异步管线模式（队列 + workflow-worker 消费 +
  轮询），生成器继续用 sanctioned mock。
- 已完成:
  - `packages/data`：新增 `019_presentation_artifacts.sql` 迁移（独立表，非复用
    studio_artifacts——需要 topic/pages/style 配置字段 + slides 分页元数据 + PPTX/PDF 双产物
    key，理由见迁移文件注释）+ `src/presentations.ts` 仓储（queued→processing→ready/error
    状态机，同 F01 模式）
  - `packages/queue`：新增 `presentationGeneration` 队列名
  - `packages/ai`：新增 `presentationGenerator.ts`（sanctioned mock 生成器，产出确定性
    幻灯片大纲 + 占位 PPTX/PDF 二进制内容；含 `PRESENTATION_FORCE_FAIL_MARKER` 测试触发词，
    同 studioGenerator 模式）
  - `packages/storage`：新增 `buildPresentationObjectKey`（presentations/ 前缀，与
    studio/、kb/ 隔离命名空间）
  - `apps/workflow-worker`：新增 `presentationJob.ts` 处理器（生成 → 写 PPTX+PDF 两个对象
    → 回写终态），`main.ts` 注册消费 `boardx.presentation-generation`（含 processing 回写）
  - `apps/web`：
    - `POST /api/presentations/generate`（顶层路由，body 携带 roomId/chatId 定位目标聊天
      线程，与 F01 房间聊天集成一致——产物结果"出现在聊天"）
    - `GET /api/rooms/[id]/chats/[chatId]/presentations/{sources,artifacts}`、
      `POST .../presentations/artifacts/[artifactId]/retry`、
      `GET .../presentations/artifacts/[artifactId]/download?format=pptx|pdf`
    - 新组件 `components/presentations/presentation-config-modal.tsx`（主题/来源[聊天/
      文件/说明]/页数/风格配置弹窗，来源为空时禁用生成，来源可用性判定复用
      `apps/web/lib/studio.ts` 的 `listRoomFiles`）
    - 新组件 `components/presentations/presentation-preview-card.tsx`（聊天内预览卡片：
      翻页缩略图 + 页码指示 + 全屏预览翻页 + 下载 PPTX/PDF 按钮；失败态展示错误 + 重试）
    - 改造 `rooms/[id]/chats/[chatId]/page.tsx`：顶部新增「生成演示」入口按钮打开配置弹窗，
      聊天消息列表插入演示预览卡片，2s 轮询驱动生成中→ready/error 状态刷新（同 F01 模式）
  - 重写 `apps/web/e2e/presentations-001-generate-presentation.spec.ts`：原文件测的是一个
    不相关的早期独立 `/presentations` 页面桩（同步生成、无来源校验、无聊天集成、无预览卡片/
    翻页/全屏/PPTX+PDF 双格式下载，不符合 F02 真实验收标准）——按 F02 真实验收标准整体重写，
    覆盖 5 个场景（来源为空禁用、说明来源配置+翻页+全屏+双格式下载、聊天来源生成、失败重试、
    未登录 401）
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d` ✓
  - `pnpm --filter @repo/data run migrate` ✓（含新 019 迁移）
  - `pnpm --filter @repo/workflow-worker dev`（后台起 worker 消费新队列）✓
  - `pnpm --filter @repo/web exec playwright test e2e/presentations-001-generate-presentation.spec.ts`
    ✓ 5/5 通过，重复跑 3 次（含本节证据落盘那次）均 5/5，无 flaky
  - 回归检查：`pnpm --filter @repo/web exec playwright test e2e/studio-001-generate-artifact.spec.ts`
    ✓ 12/12 通过，确认 F02 改动未影响 F01
  - `pnpm -w run verify:base`（typecheck + lint + test）✓ 45/45 通过
  - **未跑 `verify:full`**（协调者与用户已确认的轻量门控策略）：本轮改动范围与 F01 高度类似
    （新表 + 新队列 + 新 API 路由 + 新前端组件，均是新增代码而非改动既有路径），F01 sprint
    已用 verify:full 验证过同款模式在本仓库端到端可跑通（206 passed，69 个既有失败均与
    studio/presentations 无关）；本轮仅跑 targeted e2e + verify:base，证据见下方文件
- 已记录证据:
  - `phases/phase-p12-studio-presentations/sprints/sprint-02/evidence/presentations-001-generate-presentation.e2e.txt`
  - `phases/phase-p12-studio-presentations/sprints/sprint-02/evidence/verify-base.txt`
- 提交记录: 分支 `worker/wrk-studio-1-p12-f02-presentations`（见 PR）
- 已知风险或未解决问题:
  - "房间文件"来源沿用 F01 的 KNOWN LIMITATION（kb_files 无 room_id 外键，非真正房间级文件
    关联表），见 `apps/web/lib/studio.ts` 注释
  - PPTX/PDF 产物仍是 sanctioned mock 占位内容（纯文本 Buffer，非真实 Office Open XML /
    PDF 格式二进制），符合任务要求的"非真实 AI/PPTX 管线，mock 产物要能真实下载"——下载链路
    （presigned URL）本身是真实的，产物字节内容是占位符
  - 未跑 verify:full（见上方"运行过的验证"说明的轻量门控策略理由）
  - F03（修订演示文稿）仍 `blocked`/未分配，本轮未动（超出 F02 范围）
- 下一步最佳动作: 协调者 review PR → `pnpm harness verify --sprint p12/02` 转 F02 passing；
  之后 F03（修订演示文稿）depends_on F02 可解锁分配
