# 会话交接 — Sprint p12/03

## 当前已验证
- F03（修订演示文稿：方案修改 + 单页优化）实现完成，自测全绿：
  - 声明的 verification 三条命令全部 exit 0（见 `evidence/F03.verify.txt`）。
  - 新 e2e spec `e2e/presentations-002-revise-presentation.spec.ts` 5/5 passed。
  - 回归：`pnpm run verify:base` 45/45、F02 spec 5/5、F01(studio) spec 12/12，均无破坏。
- 状态未自行提升：`feature_list.json` 里 F03 仍是 `in_progress`/`owner: wrk-studio-1`，
  按硬约束只有 `pnpm harness verify` 能翻 passing，本轮未跑（worker 无权限）。

## 本轮改动
- 数据层：`packages/data/migrations/021_presentation_revisions.sql`（新表）+
  `packages/data/src/presentations.ts`（新增 revision 仓储函数 + `updatePresentationArtifactSlides`）。
- AI stub 层：`packages/ai/src/presentationGenerator.ts` 新增
  `revisePresentationPlan`/`optimizePresentationPage` + 强制失败触发词。
- 队列/worker：`packages/queue/src/index.ts` 新增 `presentationRevision` 队列名；
  新文件 `apps/workflow-worker/src/presentationRevisionJob.ts`；`main.ts` 接入新 worker。
- API：新增两个路由（方案修订 `.../revisions`，单页优化 `.../optimize-page`），均复用
  F01/F02 已确立的鉴权模式（`canViewRoom` + `chat.creator_user_id`/`artifact.creator_user_id`
  必须等于当前用户，非创建者/只读线程一律 403，制品不属于该线程 404——不引用无权访问的文件）。
- 前端：`presentation-preview-card.tsx` 全屏预览内新增「方案修订」面板 + 「优化本页」输入行；
  `rooms/[id]/chats/[chatId]/page.tsx` 接入轮询加载 + 两个提交 handler。
- 测试：`e2e/presentations-002-revise-presentation.spec.ts`（新）+
  `apps/workflow-worker/src/presentationRevisionJob.test.ts`（新）。

## 仍损坏或未验证
- 无已知损坏。
- 已知非阻断性边界（详见 progress.md「已知风险」）：修订/优化生成器是 stub（与 F02 一致的
  既定模式，非本轮引入的新缺口）；未做显式修订前后并排 diff 视图（用「处理态 + 成功后原地
  替换可见 + 失败态保留原结果」满足端到端契约，如需 diff UI 需另开 feature）。

## 下一步最佳动作
- 协调者：审查 PR（worker/wrk-studio-1-p12-f03-revise-presentation → main，Closes #123），
  review 通过后合并，跑 `pnpm harness verify --sprint p12/03 --feature F03` 门控转 passing。
- 门控通过后 Phase p12（Studio & 演示）三个 feature 全部 passing，phase 可收尾。
- 不要动：`presentation_artifacts` 表结构（F02 既有契约，本轮只新增独立的
  `presentation_revisions` 表，未改动前者 schema）。

## 命令
- 启动: `pnpm -w run dev`（先 `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d`）
- 验证: `pnpm harness verify --sprint p12/03`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/presentations-002-revise-presentation.spec.ts --headed`
  （worker 需先 `set -a && source .env && set +a` 再起 `pnpm --filter @repo/workflow-worker run dev`，
  否则会连到默认 redis 端口，队列任务不会被消费）。
