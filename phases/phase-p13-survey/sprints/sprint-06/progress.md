# 进度日志 — Sprint p13/06

## 当前已验证状态(唯一真相)
- 仓库根目录(本 worker worktree): `.claude/worktrees/agent-ad0e28417288c398a`
- 分支: `worker/wrk-survey-2-p13-f06-publish-pause`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F06（发布/暂停问卷，公开答题开关）— 实现与 e2e 已完成，
  等待 `pnpm harness verify --sprint p13/06` 门控转 passing（本 worker 不可自升级状态）。
- 当前 blocker: 无。

## 会话记录
### 2026-07-02 15:44:06
- 本轮目标: GitHub issue #129 / Phase p13 F06：发布/暂停问卷（公开答题开关）。
- 已完成:
  - 勘察发现 PATCH /api/surveys/:id {isActive}、公开答题门控（is_active 决定题目是否返回、
    responses 提交 409）、卡片 Pause/Activate 切换 UI 均已在 F01/F03 实现中落地，
    包括 F03 的 info-disclosure 修复（`getPublicSurveyForAnswer` 对未激活问卷清空 questions）。
  - F06 缺口仅为声明的 e2e 契约文件不存在。新增
    `apps/web/e2e/survey-006-publish-unpublish-survey.spec.ts`，覆盖：
    1) owner 通过卡片切换 active/paused，状态与按钮文案即时反映；
    2) active 时公开答题链接可正常填答并提交落库；
    3) owner 暂停问卷后公开页展示不可答题态，提交被 409 拒绝，且公开 API 不泄露题目/选项
       （对齐 f03-06 安全修复边界）；
    4) 非 owner PATCH 被 403 拒绝，问卷状态不变，且非 owner 在列表看不到该问卷/Toggle 按钮。
  - 未改动任何既有实现代码（后端网关与 UI toggle 已由此前 feature 提供，符合范围纪律）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/survey-006-publish-unpublish-survey.spec.ts`（4 passed）
  - 回归: `pnpm --filter @repo/web exec playwright test e2e/survey-001..006*.spec.ts`（18 passed，无回归）
  - `pnpm -w run verify:base`：除 `@repo/auth#test` 外全部通过。`@repo/auth` 的
    `password > hash 不等于明文，verify 正确匹配` 用例在 turbo 全并发下超 5s 超时，
    单独 `pnpm --filter @repo/auth run test` 复测 836ms 全绿；本分支对 `packages/auth`
    零 diff（`git diff --stat origin/main -- packages/auth` 为空），判定为共享机器资源
    争用导致的无关 flake，非本 feature 引入。
- 已记录证据:
  - `phases/phase-p13-survey/sprints/sprint-06/evidence/F06.verify.log`
- 提交记录:
  - 待提交（本轮）。
- 已知风险或未解决问题:
  - `@repo/auth#test` 在满并发 turbo 跑批时偶发超时，与本 feature 无关，未修复（不在 F06
    范围内，修复该 flake 需要另开 feature/维护任务）。
- 下一步最佳动作:
  - 提交、push 分支、开 PR（Closes #129），不自行合并；等待 `pnpm harness verify` 门控。
