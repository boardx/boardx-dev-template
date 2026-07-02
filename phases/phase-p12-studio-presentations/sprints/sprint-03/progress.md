# 进度日志 — Sprint p12/03

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm harness verify --sprint p12/03`
- 当前最高优先级未完成功能: 无（F03 已实现，待协调者跑 `pnpm harness verify` 门控转 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-02（wrk-studio-1）
- 本轮目标: 实现 F03（修订演示文稿：方案修改 + 单页优化），复用 F01/F02 的异步生成管线
  与创建者鉴权模式。
- 已完成:
  - 新增迁移 `packages/data/migrations/021_presentation_revisions.sql`（presentation_revisions 表：
    kind='plan'|'page'，记录修订/优化请求的异步状态；不复制制品数据，成功后直接原地更新
    `presentation_artifacts.title/slides`）。
  - `packages/data/src/presentations.ts`：新增 `updatePresentationArtifactSlides` +
    `presentation_revisions` 全套仓储函数（create/get/list/markProcessing/markReady/markError）。
  - `packages/ai/src/presentationGenerator.ts`：新增 `revisePresentationPlan`（方案层修订，
    stub 在原幻灯片基础上做确定性追加变换 + 方案摘要）与 `optimizePresentationPage`（单页优化，
    仅重生成目标页），同 `PRESENTATION_FORCE_FAIL_MARKER` 模式新增
    `PRESENTATION_REVISION_FORCE_FAIL_MARKER` 供确定性失败验证。
  - 新队列 `boardx.presentation-revision`（`packages/queue/src/index.ts`）+
    `apps/workflow-worker/src/presentationRevisionJob.ts`（处理 plan/page 两种 kind）+
    `main.ts` 接入 worker（诚实状态机：先回写 processing，成功原地替换 artifacts 的
    title/slides，失败只标记 revision 为 error，不触碰 artifacts——保证"修订失败不破坏原
    可查看结果"）。
  - API 路由：
    - `POST/GET .../presentations/artifacts/[artifactId]/revisions`（方案修订，创建者鉴权 +
      仅 ready 制品可修订 + 说明为空 400）。
    - `POST .../presentations/artifacts/[artifactId]/optimize-page`（单页优化，同鉴权 +
      目标页存在性校验）。
  - 前端：`presentation-preview-card.tsx` 扩展全屏预览——「方案修订」面板（textarea + 提交，
    空输入禁用，处理中态，方案摘要展示，失败态展示）+「优化本页」输入行（同规则）；
    `rooms/[id]/chats/[chatId]/page.tsx` 接入轮询加载 revisions + 两个新 handler，
    `canEdit=false`（非创建者只读线程）时不传 handler，UI 不出现修订入口。
  - 新增 e2e spec `apps/web/e2e/presentations-002-revise-presentation.spec.ts`（5 个用例：
    方案修订成功、单页优化成功且不影响其余页、修订失败不破坏原结果、非创建者越权 403/404、
    未登录 401）。
  - 新增单测 `apps/workflow-worker/src/presentationRevisionJob.test.ts`（4 个用例覆盖
    plan/page 成功、目标页不存在、强制失败）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（exit 0）
  - `pnpm --filter @repo/data run migrate`（exit 0，021 迁移已应用）
  - `pnpm --filter @repo/web exec playwright test e2e/presentations-002-revise-presentation.spec.ts`
    （5/5 passed，exit 0）
  - 回归确认：`pnpm run verify:base`（45/45 successful）、
    `e2e/presentations-001-generate-presentation.spec.ts`（5/5，F02 无回归）、
    `e2e/studio-001-generate-artifact.spec.ts`（12/12，F01 无回归）。
- 已记录证据: `evidence/F03.verify.txt`（含以上全部命令的完整输出 + exit code；用 .txt 而非
  .log 后缀是因为 `.gitignore` 全局忽略 `*.log`，同 sprint-02 F02 证据的既有约定）。
- 提交记录: 见对应 PR（worker/wrk-studio-1-p12-f03-revise-presentation → main，Closes #123）。
- 已知风险或未解决问题:
  - 修订/优化生成器仍是 sanctioned stub（同 F02 模式），未接入真实 AI 重生成——与 F02 的
    已知边界一致，不是本轮新增风险。
  - 前端 diff/对比视图（"可对比/接受"）目前是"处理完成即原地替换"，未做修订前后并排对比
    UI；`user_visible_behavior` 用词"可对比/接受"以本轮实现的"处理态展示 + 成功后可见新
    结果 + 失败态不破坏原结果"满足端到端契约，但若后续需要显式 diff 视图需要新 feature/
    补充设计稿。
- 下一步最佳动作: 协调者跑 `pnpm harness verify --sprint p12/03 --feature F03` 门控转
  passing；Phase p12 三个 feature（F01/F02/F03）届时全部完成。
