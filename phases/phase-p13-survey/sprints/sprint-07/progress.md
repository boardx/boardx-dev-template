# 进度日志 — Sprint p13/07

## 当前已验证状态(唯一真相)
- 仓库根目录(本 worker worktree): `.claude/worktrees/agent-a406d310bb2da3fc1`
- 分支: `worker/wrk-survey-1-p13-f07-ai-report-summary`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F07（问卷报告 AI 摘要）— 实现与全部声明 verification 命令
  已在本地逐条跑通（见 evidence/F07.verify.log），但 `pnpm harness verify --sprint p13/07`
  本轮因宿主机 docker network 地址池耗尽未能跑通其内嵌的 `docker compose up -d` 步骤，
  status 仍是 `in_progress`（本 worker 不能自升级为 passing）。
- 当前 blocker: 宿主机同时有 30+ 个并发 worktree 的 docker compose 栈占满了
  Docker 默认地址池（`all predefined address pools have been fully subnetted`）。
  非本 feature 代码问题，见下方"已知风险"。

## 会话记录
### 2026-07-05（wrk-survey-1）
- 本轮目标: GitHub issue #370 / Phase p13 F07：问卷报告 AI 摘要（Report 视图一键生成）。
- 已完成:
  - 新增 `packages/ai/src/reportSummaryGenerator.ts`：`generateReportSummary` 自包含
    生成器，沿用 `studioGenerator.ts`/`presentationGenerator.ts` 的 sanctioned-stub 模式
    （未接入真实 LLM 撰写管线时产出确定性自然语言摘要），`REPORT_SUMMARY_FORCE_FAIL_MARKER`
    供 e2e 确定性验证失败分支；已从 `packages/ai/src/index.ts` 导出。
  - 新增 `POST /api/surveys/[id]/results/ai-summary`
    （`apps/web/app/api/surveys/[id]/results/ai-summary/route.ts`）：
    - 权限完全复用 F04 既有边界：`currentUser()` 401 + `canViewSurvey(surveyId, user.id,
      currentTeamId())` 403（与 `results/route.ts`/`results/export/route.ts` 同一模式），
      未新开权限模型。
    - 数据取数复用 `packages/data/src/survey.ts` 的
      `getSurveyWithQuestions`/`listSurveyResponses`，只做摘要专用的轻量统计
      （top 选项/评分均值/答题数），不重新实现 `results/route.ts` 内 `summarizeQuestion`
      的完整分布聚合（那是服务于图表渲染的另一职责，取数口径仍是同一份原始数据）。
    - 零回收返回 400。
    - 摘要**不持久化落库**，每次请求即时生成（F07 范围纪律，明确排除历史版本管理）。
  - 改造 `apps/web/app/(app)/surveys/[id]/results/page.tsx` 的 Report 视图：
    - 新增 `report-ai-summary` 区块 + `report-ai-summary-generate` 按钮，点击后
      `report-ai-summary-loading` → `report-ai-summary-text`（成功）或
      `err-report-ai-summary` + `retry-report-ai-summary`（失败）。
    - 零回收空态（`results-empty`）内也放了一个 disabled 的
      `report-ai-summary-generate`，满足"零回收时生成按钮禁用"的验收线索
      （既有 UI 在 totalResponses===0 时整个 tab/report-view 都不渲染，只有空态卡片，
      因此把禁用按钮放进空态卡片本身，而不是等用户切到一个本就不存在的 Report tab）。
  - 新增 `apps/web/e2e/survey-007-ai-report-summary.spec.ts`（5 用例）：生成成功展示摘要
    文本、loading 态可见（用 `context.route` 人为节流网络制造可观察窗口）、生成失败
    （标题含 `REPORT_SUMMARY_FORCE_FAIL_MARKER`）展示失败态+重试且不影响既有三视图、
    零回收禁用按钮、非 owner/未登录调用生成接口 403/401。
- 运行过的验证（均在隔离 docker 栈上跑通，见下方已知风险的环境说明）:
  - `docker compose -f infra/docker-compose.yml up -d`（叠加仅本地临时文件的 compose
    override 指定未占用子网，见下方风险说明）→ 3 容器 healthy
  - `pnpm --filter @repo/data run migrate` → 全部已应用，无新增迁移
  - `pnpm --filter @repo/web exec playwright test e2e/survey-007-ai-report-summary.spec.ts`
    → 5 passed
  - 回归: `pnpm --filter @repo/web exec playwright test e2e/survey-001-create-survey.spec.ts
    e2e/survey-002-list-manage-surveys.spec.ts e2e/survey-003-answer-survey.spec.ts
    e2e/survey-004-view-answers-report.spec.ts e2e/survey-005-manage-templates.spec.ts
    e2e/survey-006-publish-unpublish-survey.spec.ts` → 23 passed，无回归
  - `pnpm --filter @repo/web run typecheck` → 通过
  - `pnpm --filter @repo/data run typecheck` → 通过
  - `pnpm --filter @repo/web run lint` → 通过（design lint 全部通过；既有的
    LABEL-LANG-MIX 警告与本 feature 无关，不拦截）
- 已记录证据: `phases/phase-p13-survey/sprints/sprint-07/evidence/F07.verify.log`
- 提交记录: 分支 `worker/wrk-survey-1-p13-f07-ai-report-summary`（commit 含实现 + e2e +
  evidence log），PR 见 GitHub（Closes #370）。
- 已知风险或未解决问题:
  - **`pnpm harness verify --sprint p13/07 --feature F07` 本轮未能把状态门控为
    passing**：其内嵌的 `docker compose -f infra/docker-compose.yml up -d`（feature_list
    verification 里的固定命令，harness verify 逐条原样执行）在本轮会话时因宿主机同时有
    30+ 个并发 worktree 的 docker compose 栈，命中 Docker
    `all predefined address pools have been fully subnetted`。
    - 本 feature 的实际功能验证是完整跑通的：用一个**仅本地临时文件**的 compose
      override（不修改仓库内 `infra/docker-compose.yml`）显式指定一个未占用的
      `172.16.99.0/24` 子网，让隔离栈成功启动，随后逐条验证命令（迁移、F07 e2e、
      回归 e2e、typecheck、lint）全部通过，见 `evidence/F07.verify.log`。
    - 但 `pnpm harness verify` 内部固定执行的是不带 override 的裸
      `docker compose -f infra/docker-compose.yml up -d`；Docker Compose 在显式传
      `-f` 时不会自动合并同目录的 `docker-compose.override.yml`（已验证），所以
      无法让 harness verify 的这一步透明复用本地 override。
    - 已尝试的非破坏性方案：(a) 本地 override 子网、(b) 释放本 worktree 自己的
      network 后重试（仍失败，说明宿主机整体池已满，非本 worktree 占用问题）。
    - 明确**未**执行 `docker network prune`/`rm` 等会影响其它并发 agent 网络的操作
      （另一 agent 在 `phases/phase-p14-credits-billing/sprints/sprint-04/evidence/
      f02-notes.md` 里记录过用 `docker network prune -f` 解决同一问题——本会话判断
      这对宿主机上其它并发 agent 风险过高，遵循"该已知故障模式不要用破坏性手段解决"
      的约束，选择不这样做）。
    - 结论：这是一个**环境态**问题（宿主机资源争用），不是 F07 代码缺陷；建议协调者
      /下一轮在宿主机 docker 负载较低时段重跑
      `pnpm harness verify --sprint p13/07 --feature F07`，届时应可直接通过
      （代码本身已证明可跑通全部声明的 verification）。
  - 摘要生成走 `packages/ai` 的 sanctioned-stub 模式（`generateReportSummary`），不是
    真实 LLM 撰写；真实管线接入不改变 `generateReportSummary` 的输入输出契约，只需替换
    内部实现（同 studioGenerator.ts 既有先例的演进路径）。
  - 空态下 `report-ai-summary-generate` 按钮放在 `results-empty` 卡片内部而非 Report tab
    内（因为 Report tab 在零回收时根本不渲染）——如果未来产品决策改成"即使零回收也保留
    Summary/Individual/Report 三个 tab 只是禁用交互"，这个按钮的位置需要相应调整。
- 下一步最佳动作:
  - 下一轮/协调者：在 docker 负载较低时重跑
    `pnpm harness verify --sprint p13/07 --feature F07`，预期直接通过并把 F07 转 passing。
  - 不要修改 `infra/docker-compose.yml`（共享文件，本轮为了不影响其它并发 agent 特意
    只用本地临时 override，未提交任何 compose 改动）。
