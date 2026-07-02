# 会话交接 — Sprint p13/03

## 当前已验证
- F03「填写并提交问卷（公开答题页）」已 passing。
- 验证命令: `pnpm harness verify --sprint p13/03 --feature F03`
- harness 证据: `phases/phase-p13-survey/sprints/sprint-03/evidence/F03.verify.log`
- 基础验证: `pnpm -w run verify:base` 已由 harness verify 跑通。

## 本轮改动
- `packages/data/src/survey.ts`
  - 新增 `getPublicSurveyForAnswer`、`createSurveyResponse`、`setSurveyActive` 和 `SurveyResponse` 类型。
- `apps/web/app/api/surveys/[id]/answer/route.ts`
  - 公开读取问卷详情，访客无需登录，返回 active / not accepting 状态。
- `apps/web/app/api/surveys/[id]/responses/route.ts`
  - 公开提交答卷，结构化校验必填和题型，落库到 `survey_responses`。
- `apps/web/app/survey/[id]/answer/page.tsx`
  - 公开答题页，覆盖 loading、error、empty、不可答题、表单、进度、成功页。
- `apps/web/e2e/survey-003-answer-survey.spec.ts`
  - 覆盖访客答题、必填校验、提交落库、未发布不可答题态。
- `phases/phase-p13-survey/feature_list.json`
  - 由 harness verify 将 F03 状态推进为 `passing` 并写入 evidence。
- `.harness/state/PROGRESS.md`
  - 由 harness verify 更新阶段汇总。

## 仍损坏或未验证
- 无已知 blocker。
- 当前 schema 没有单独 paused/closed 字段；F03 在现有 feature_list/F06 约束下使用 `is_active=false` 统一展示不可答题态。

## 下一步最佳动作
- 本 sprint F03 已完成。下一轮如继续 p13，应先读取 `phases/phase-p13-survey/feature_list.json`，选择下一个未 passing feature 并通过 harness 认领。
- 不要手改 `phases/phase-p13-survey/sprints/sprint-03/active-features.json`。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p13/03 --feature F03`
- 调试:
  - `pnpm --filter @repo/web exec playwright test e2e/survey-003-answer-survey.spec.ts`
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/web run lint`
