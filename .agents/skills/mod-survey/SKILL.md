---
name: mod-survey
description: >
  激活条件：接到 Survey（问卷） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Survey（问卷） — 模块知识库

> 本文件是 survey 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
问卷的创建/作答/结果统计，room 作用域（026_survey_room_scope）。

## 代码地图
- 页面：`apps/web/app/(app)/surveys/`（创建器/列表/结果页）、`apps/web/app/survey/[id]/answer/`（公开作答页）、
  `apps/web/app/(app)/rooms/[id]/surveys/`（room 作用域入口，p20 F08）。
- API：`apps/web/app/api/surveys/[id]/{answer,responses,results,results/export,results/ai-summary}`、
  `apps/web/app/api/survey-templates/`、`apps/web/app/api/rooms/[id]/surveys/`。
- 组件/数据：`packages/data/src/survey.ts`（surveys/survey_questions/survey_responses 表 + room scope 迁移
  `026_survey_room_scope.sql`）；`packages/ai/src/reportSummaryGenerator.ts`（结果报告 AI 摘要生成器）。

## 关键契约与不变量（改代码前必读）
- 作答页是**未登录可达**的公开面——任何改动过一遍未授权视角。
- 结果统计聚合在服务端算，不把原始答卷全量发给客户端。
- 新增结果相关端点（如 `results/ai-summary`）应**逐行复用** `results/route.ts`/`results/export/route.ts`
  已有的鉴权顺序（`currentUser()`→401，`canViewSurvey(surveyId, userId, teamId)`→403），不要另起一套权限判断。
- CAP-AI 接入走 `packages/ai` 已合入 main 的 `gateway.ts`（`defaultGateway`/`stubProvider`/`FORCE_FAIL_MARKER`）
  或 `studioGenerator.ts` 的 sanctioned-stub 先例——e2e 必须能在无真实 Anthropic API key 时确定性通过。

## 关联阶段 / ADR / 文档
phases/phase-p13-survey

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-14：移植独立 Survey 源仓的数据契约时，`survey_templates` 的个人模板模型不能直接覆盖主仓团队模板模型；
  应增量加入 `tags`/`category_plan`，并继续用 `canViewSurvey` + `canManageSurveyScope` 执行 team/room 边界
  （出处：phase-p25 F09 / PR #637）。
- 2026-07-14：用户要求同步“包括未提交内容”时，源事实必须核对 `git status` 和 `git stash list/show`；
  只读取分支 HEAD 会漏掉 stash 中已完成但未提交的首页/导航设计。同步前应记录源 commit、stash 标识和目标文件哈希
  （出处：phase-p25 F08）。
- 2026-07-14：UI 对 session 恢复接口的 404 如果被 `catch` 静默吞掉，常规 happy-path E2E 不会暴露功能缺失；
  同步原型时要搜索全部 `fetch` URL 并逐一确认 route 存在，草稿恢复需单独做刷新 E2E（出处：phase-p25 F07）。
- 2026-07-14：从独立 Survey 原型仓同步时不能直接覆盖 `packages/data/src/survey.ts`：原型分支缺少主仓的
  Room scope 权限，且 AI 路由曾引用未实现的 session 数据函数。正确做法是保留主仓权限边界，用向后兼容
  migration 增量扩展发布设置/报告产物，并先跑 typecheck 暴露悬空契约（出处：phase-p25 F01-F06）。
- 2026-07-14：禁止把纯文本 Blob 以 `application/pdf` 和 `.pdf` 名称下载；浏览器端无 PDF 生成器时应使用
  `window.print()` 走系统 Print/PDF，CSV 则继续由鉴权服务端生成并防公式注入（出处：phase-p25 F05）。
- 2026-07-14：Playwright 串行跑完整 Survey 套件时，Next.js 首次冷编译可超过默认 10 秒；只对等待服务端
  生成结果的断言设置 20 秒超时，不提高全局超时，避免掩盖真实卡死（出处：phase-p25 F02/F06）。
- 2026-07-08：`pnpm harness sync` 的 `near_term_window` 切片按字典序取**最早**的 N 个 sprint，
  不是最近的——新 feature 挂到新 sprint 后永远不会被 sync 自动开 issue。发现于 F07 排到
  sprint-07 却只投影 sprint-01/02。绕过：手工按 `buildIssueBody` 模板开 issue；根因待修（已开独立
  维护任务，非本模块范围）。
- 2026-07-07：诊断"PR 为什么没合并"只查 `state`/`mergedAt` 不够，会把真实 merge conflict 误判成
  "对方拖延"——F07 门控 PR #422 曾经历这个误判，连续多轮巡检+两次总线升级才发现问题其实是
  `mergeable: CONFLICTING`（main 推进导致，非 review 拖延）。必须同时查
  `mergeable`/`mergeStateStatus`；冲突面若只是 `.harness/state/PROGRESS.md` 等自动聚合文件，
  直接 `git merge origin/main` 取 main 版本即可，无需人工排查内容语义。
- 2026-07-07：宿主机多 worktree 并行时 docker 默认地址池会耗尽
  （`all predefined address pools have been fully subnetted`），F07 harness verify 曾因此卡住。
  非本模块代码缺陷，不要用 `docker network prune` 等破坏性手段解决（会误杀其他 agent 的容器/网络）；
  根因已由 `scripts/init-worktree-env.sh` 给每个 worktree 分配显式独立子网修复。
- 2026-07-04：给已有 feature（如 F04）补充新增强前，先核实文档里引用的"先例文件"当前是否真的在
  `main` 上——git 状态快照与并发合并存在时序竞态，容易把"某分支正在开发中的文件"误当成已有先例
  （F07 需求文档初版误引用了当时尚未合并的 `researchGenerator.ts`，后来该文件才真正合入 main，
  两次勘误才理顺）。
- 2026-07-04：给模块找"有据可查的新工作"，优先翻前一个 feature 的 `notes` 字段里显式写的排除项
  （如 F04 notes 明确写"AI 摘要为可选增强"），而不是凭空发明范围——F07 就是这样源生的，避免了
  "为了有活干而制造低价值任务"。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
