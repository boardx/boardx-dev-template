# 会话交接 — Sprint p13/04

## 当前已验证
- F05 问卷模板管理（应用/保存/删除模板）已由 `pnpm harness verify --sprint p13/04 --feature F05` 门控升级为 `passing`。
- F05 verification 全部通过:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-005-manage-templates.spec.ts`
- 基础验证 `pnpm -w run verify:base` 通过。
- 证据: `phases/phase-p13-survey/sprints/sprint-04/evidence/F05.verify.log`

## 本轮改动
- 数据层:
  - 新增 `packages/data/migrations/017_survey_templates.sql`，创建 `survey_templates` 并写入内置模板。
  - 扩展 `packages/data/src/survey.ts`，增加模板列表、创建、查询、删除权限与删除仓储函数。
- API:
  - 新增 `apps/web/app/api/survey-templates/route.ts`，支持 GET 可见模板与 POST 团队模板。
  - 新增 `apps/web/app/api/survey-templates/[id]/route.ts`，支持 DELETE 自己/团队可管理模板。
- UI:
  - 更新 `apps/web/app/(app)/surveys/page.tsx`，创建问卷时可选 Blank / 内置 / 团队模板，保存当前问卷为团队模板，删除可管理模板，应用后仍可编辑，并展示团队模板空态。
- 验证:
  - 新增 `apps/web/e2e/survey-005-manage-templates.spec.ts`。

## 仍损坏或未验证
- 无已知损坏。
- `pnpm lint-design` / `pnpm -w run lint-design` 在根目录无对应 script；实际设计检查由 `pnpm --filter @repo/web run lint` 覆盖并已通过。

## 下一步最佳动作
- 本 worktree 只完成并提交 F05；不要改其他 worktree，不要 push/PR。
- 若继续 p13 后续功能，先新建/认领下一 sprint feature，再按根 `AGENTS.md` 开工流程重新确认唯一目标。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p13/04`
- 调试:
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `pnpm --filter @repo/data exec tsc --noEmit`
