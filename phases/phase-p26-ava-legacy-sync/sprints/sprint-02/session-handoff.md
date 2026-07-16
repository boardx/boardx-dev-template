# 会话交接 — Sprint p26/02

## 当前已验证
- `F02 / 迁移旧 AVA composer 与消息动作能力` 已由 harness 升级为 `passing`。
- evidence: `evidence/F02.verify.log @ 2026-07-16T11:00:07.480Z`。
- 当前 phase 状态：
  - `F01` passing。
  - `F02` passing。
  - `F03` not_started。
  - `F04` not_started。

## 本轮关键改动
- `phases/phase-p26-ava-legacy-sync/requirements/01-change-intake.md`
  - 补充规则：后续所有 AVA 行为、UI、接口、模型、文案或验证口径调整必须写入 requirements。
  - 已记录 Qwen 默认模型、Deep Agent 同步、UI 改善、Delete 文案、F02 验证收敛、重新生成连续发送、附件上传即时反馈和 e2e 本地端点稳定性。
- `apps/web/app/(app)/ava/page.tsx`
  - 保留并验证 AVA UI 改善、Deep Agent mode、用户消息 inline edit、Delete 文案、regenerate 不阻塞 composer 下一次普通发送。
- `apps/web/app/(app)/ava/attachments.tsx`
  - 文件选择/拖拽后立即展示预览条，再异步创建 thread 和上传。
  - 登录失效时上传中附件进入 failed 可重试态，不静默卡住。
- `packages/storage/src/index.ts`
  - `ensureBucket()` 增加进程内 promise 缓存，避免 AVA 附件连续上传重复初始化对象存储 bucket。
- `apps/web/playwright.config.ts`
  - Playwright webServer 的 `DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT` 在 e2e 环境中规范为 `127.0.0.1`，减少 Docker Desktop 下 `localhost` IPv6/IPv4 抖动。
  - e2e 仍强制 `AVA_DEFAULT_MODEL_ID=stub:default`，不影响普通本地/生产默认 Qwen。
- `apps/web/e2e/ava-attach-files.spec.ts`
  - 上传完成断言等待窗口调整为 30s，仍要求最终 `data-status="uploaded"`。
  - reload 后按本次线程标题回到对应线程，不依赖历史列表第一项。

## 已通过命令
- `pnpm --filter @repo/web exec playwright test e2e/ava-attach-files.spec.ts` — 8 passed。
- `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts e2e/ava-message-actions.spec.ts e2e/ava-message-send-actions.spec.ts e2e/ava-attach-files.spec.ts e2e/ava-voice-input.spec.ts` — 30 passed。
- `pnpm --filter @repo/web test` — 17 files / 95 tests passed。
- `pnpm --filter @repo/storage test` — 1 file / 19 tests passed。
- `pnpm --filter @repo/web typecheck` — passed。
- `pnpm harness verify --sprint p26/02` — passed，F02 -> passing。

## 环境说明
- 本轮 Docker daemon 曾中途不可连接，导致 Postgres `ECONNREFUSED` 和附件/线程 e2e 假失败；已重新启动 Docker Desktop，并拉起当前 worktree compose 栈。
- 当前 compose 服务已恢复：Postgres/Redis/MinIO healthy，`users` 表可查询。
- `pnpm harness sweep-docker` dry-run 发现 2 个孤儿 compose 栈仍在运行：`boardx-next`、`officelab`。本轮未执行 `--apply`，未删除孤儿卷。

## 下一步
- 若继续本 phase，按 harness 流程为 `F03 / 迁移旧 AVA Deep Research 细节视图` 创建/认领 sprint，不要复用 F02 的 passing scope。
- 不要手改 `active-features.json`，不要手动改 feature status；继续通过 `pnpm harness verify` 升级。
- 若要接真实 boardx-backend Deep Agent，浏览器本地需要旧 backend JWT：`auth-token-data.token` 或 `loginToken`，否则 backend proxy 会按预期返回 401。
