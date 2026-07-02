# 会话交接 — Sprint p12/02

## 当前已验证
- F02（生成演示文稿：配置弹窗 + 生成进度 + 预览卡片，owner wrk-studio-1，issue #122）：
  实现完成，本地跑通：
  - `docker compose -f infra/docker-compose.yml up -d` → `pnpm --filter @repo/data run migrate`
    （含新 `019_presentation_artifacts.sql`）→ 起 `pnpm --filter @repo/workflow-worker dev`
    （消费 `boardx.presentation-generation` 新队列）→
    `pnpm --filter @repo/web exec playwright test e2e/presentations-001-generate-presentation.spec.ts`
    （5/5 场景通过，重复跑 3 次无 flaky）。
  - `pnpm -w run verify:base`（typecheck+lint+test）45/45 通过。
  - 回归：`e2e/studio-001-generate-artifact.spec.ts`（F01）12/12 通过，确认无回归。
  - **未跑 `verify:full`**：按协调者与用户已确认的轻量门控策略跳过（详见下方"验证范围说明"）。
  - **注意**：`status` 字段仍是 feature_list.json 里的原值——按 AGENTS.md 硬约束，我没有自己
    改 feature_list.json（协调者已在 issue #122 上转 `status:in-progress` 完成认领，但仓库里
    的 `phases/phase-p12-studio-presentations/feature_list.json` 尚未反映 F02 从 blocked 转
    in_progress/分配 sprint-02——这是协调者侧的派生视图/权威文件更新，不属于本次 worker 的
    改动范围，只能由 `pnpm harness verify` 门控转移到 passing）。

## 验证范围说明（为何跳过 verify:full）
本轮改动结构与刚交付的 F01（p12/01，同一 owner）高度一致：新表 + 新队列名 + 新 API 路由 +
新前端组件，均是**新增**代码路径，不改动任何既有路由/组件的行为（唯一改动的既有文件是
`rooms/[id]/chats/[chatId]/page.tsx`，只做纯增量：加了一个按钮 + 弹窗 + 结果卡片渲染分支，
不改动 Studio 面板既有的 state/effect/JSX）。F01 sprint 上一轮已经跑过 `verify:full`（生产
build + 全量 275 个 e2e），结果 206 passed / 69 failed，69 个失败逐一核对均为既有、与
studio/presentations 无关的 `ECONNREFUSED ::1:3000`（e2e helper 硬编码端口 3000 的既有 bug，
已 spawn 独立任务跟踪）。同一套基础设施/构建配置在本轮未变，判断本轮无需重复跑全量验证来
确认这批既有失败依旧无关——协调者与用户已确认这一轻量门控策略，改为只跑 targeted e2e +
verify:base，证据见 `evidence/`。

## 本轮改动
- 新表 `packages/data/migrations/019_presentation_artifacts.sql` + 仓储
  `packages/data/src/presentations.ts`（presentation_artifacts：queued → processing →
  ready/error，chat_id 关联房间聊天线程；独立于 studio_artifacts 建表，因为需要额外的
  topic/pages/style 配置字段 + slides 分页元数据 JSON + PPTX/PDF 两个 object_key，见迁移
  文件顶部注释里的理由）。
- `packages/queue`：新增队列名 `QUEUE_NAMES.presentationGeneration`。
- `packages/ai/src/presentationGenerator.ts`：sanctioned mock 生成器（同 F01/AVA stub
  模式），产出确定性幻灯片大纲（标题+要点）+ 占位 PPTX/PDF 二进制内容（真实、非空的 Buffer，
  满足"mock 产物要能真实下载"要求，但不是真正的 Office Open XML/PDF 格式字节）。
  `PRESENTATION_FORCE_FAIL_MARKER` 供确定性验证失败态（同 `STUDIO_FORCE_FAIL_MARKER` 模式）。
- `packages/storage`：新增 `buildPresentationObjectKey`（presentations/ 前缀命名空间）。
- `apps/workflow-worker/src/presentationJob.ts` + `main.ts` 注册消费
  `boardx.presentation-generation`（含 processing 状态回写，同 F01 诚实状态机模式）。
- `apps/web/app/api/presentations/generate/route.ts`：**顶层路由**（非房间 scoped 路径），
  body 携带 `roomId`/`chatId` 定位目标聊天线程——因为 F02 spec 明确写的是
  `POST /api/presentations/generate`（不是 F01 那种 `/api/rooms/:id/chats/:chatId/...`
  嵌套路径），但产物结果仍需"出现在聊天"，所以用 body 参数而非 URL 路径传递房间/聊天上下文。
  服务端仍完整校验 `canViewRoom` + 线程归属 + 创建者权限（与 F01 一致）。
- `apps/web/app/api/rooms/[id]/chats/[chatId]/presentations/{sources,artifacts}/route.ts`、
  `.../presentations/artifacts/[artifactId]/{retry,download}/route.ts`：房间 scoped 的
  查询/操作路由（列表轮询、来源可用性、重试、下载），与 F01 的 studio/* 路由结构对称。
  `download` 路由支持 `?format=pptx|pdf` 查询参数选择产物格式。
- `apps/web/components/presentations/presentation-config-modal.tsx`（新组件）：主题输入 +
  来源三选一（当前聊天/房间文件/说明文本，来源不可用时禁用对应按钮）+ 页数/风格下拉 + 说明
  文本框（仅 source=instructions 时显示）；来源为空时生成按钮禁用（instructions 来源看
  文本框是否为空，其余两个来源看服务端返回的可用性计数）。
- `apps/web/components/presentations/presentation-preview-card.tsx`（新组件）：聊天内预览
  卡片（标题+页数+封面预览+翻页缩略图+全屏预览按钮+下载 PPTX/PDF 按钮）+ 全屏预览弹层
  （上一页/下一页导航 + 页码指示 + 关闭）；data-testid 对齐
  `phases/requirements/mockups/presentation-preview.html` 里 F02 部分的锚点
  （`presentation-preview-card`/`pres-page-indicator`/`pres-thumb-strip`/
  `pres-open-fullscreen`/`pres-download`/`pres-download-pdf`/`presentation-fullscreen`/
  `pres-prev`/`pres-next`）；失败态展示错误信息 + 重试按钮。
- 改造 `apps/web/app/(app)/rooms/[id]/chats/[chatId]/page.tsx`：头部新增「生成演示」按钮
  打开配置弹窗（只读线程禁用）；消息列表里插入演示预览卡片（生成中态用简单文案占位，同
  Studio 面板"生成中或结果卡片其一可见"的验证策略，不对生成中占位可见时长做脆弱假设）；
  新增一组 state + 2s 轮询 effect（复用与 Studio 完全相同的轮询模式，两套 state 互不干扰）。
- 重写 `apps/web/e2e/presentations-001-generate-presentation.spec.ts`：原文件测的是一个
  早期独立的 `/presentations` 页面桩（同名但语义完全不同——同步生成、无来源可用性校验、
  不写数据库仅进程内存、无聊天集成、无预览卡片/翻页/全屏/下载）——按 F02 真实验收标准（配置
  弹窗/异步生成/来源为空禁用/聊天内预览卡片/翻页缩略图/全屏预览翻页/PPTX+PDF 下载/失败重试）
  整体重写，覆盖 5 个场景。

## 仍损坏或未验证
- F03（修订演示文稿）仍 `blocked`/未分配，本轮未动（超出 F02 范围，按分配说明不做）。
- 早期独立 `/presentations` 页面（`apps/web/app/(app)/presentations/page.tsx` +
  `apps/web/app/api/presentations/route.ts`）未删除，仍是同步假生成桩（进程内存存储，重启
  即清空），与新 F02 房间聊天集成并存但语义完全不同——不在本次范围内清理，留给后续 sprint
  判断是否废弃或改造成跳转入口（同 F01 交接时对旧 `/studio` 页面的处理方式）。
- "房间文件"来源语义沿用 F01 的 KNOWN LIMITATION（kb_files 无 room_id 外键，非真正房间级
  文件关联表），直接复用了 `apps/web/lib/studio.ts` 的 `listRoomFiles`，未重复实现。
- PPTX/PDF 产物是 sanctioned mock 占位二进制内容（纯文本 Buffer），不是真实 Office Open
  XML/PDF 格式——符合任务对 F02 的"非真实 AI/PPTX 管线"要求，下载链路（对象存储 presigned
  URL）本身真实可用。
- `apps/web/components/board/slides-panel.tsx`（board 页面的幻灯片管理面板）与本 feature
  无关——那是白板画布视口快照功能（uc-board-header-005），与 AI 生成演示文稿是两个完全不同
  的领域，本轮未触碰。

## 下一步最佳动作
- 协调者：review PR → `pnpm harness verify --sprint p12/02` → F02 转 passing。
- 下一个 sprint：F03（修订演示文稿）现在 depends_on F02，F02 一旦 passing 即可解锁分配。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p12/02`
- 调试:
  ```
  bash scripts/init-worktree-env.sh   # 如遇端口冲突，且需要手动补 infra/.env 的 PG_PORT/REDIS_PORT/MINIO_PORT
  docker compose -f infra/docker-compose.yml up -d
  set -a && source apps/web/.env.local && set +a
  pnpm --filter @repo/data run migrate
  pnpm --filter @repo/workflow-worker dev &   # presentation-generation 消费者
  pnpm --filter @repo/web exec playwright test e2e/presentations-001-generate-presentation.spec.ts
  ```
