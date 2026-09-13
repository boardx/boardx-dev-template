# AGENTS.md — 根路由文件

> 这是 agent 每次开工读的第一个文件。它是**目录页,不是百科全书**。
> 详细规则都拆到 `.harness/instructions/` 和各级 scoped 的 AGENTS.md 里,按需加载。
> 硬上限 ~100 行。放不下的内容请拆出去,不要往这里堆。

## 项目是什么
- 一个 agentic 系统的 monorepo(turbo + pnpm + TypeScript)。
- 代码平面:`apps/`(运行时)、`packages/`(可复用能力)。
- 控制平面:`.harness/`(harness 大脑:指令/模板/状态/脚本)。
- 交付平面:`phases/`(阶段=项目 → sprint → feature)。

## 技术栈与版本
- 运行时:Node 见 `.nvmrc`;包管理:pnpm(见 `pnpm-workspace.yaml`)。
- 构建编排:turbo(见 `turbo.json`)。
- 语言:TypeScript,严格模式。

## 首次运行(每个新会话/新环境都先跑这个)
```bash
./init.sh           # 安装依赖 + 跑基础验证 + 打印启动命令
```
如果 `init.sh` 的验证失败,**停下来先修基础状态**,不要在坏的基础上叠新功能。

## 开工流程(每轮会话开始)
0. **先确认角色,角色决定 loop 策略,不可跳过**:人类要你当 main coordinator →
   先用 `coordinator` skill(挂 5 分钟 loop);当某模块的 module coordinator →
   先用 `module-coordinator` skill(挂 15 分钟 loop);都不是 → 你是 worker,
   loop 由 `agent-bootstrap.md` 第 3.5 步挂(15 分钟)。三条路径都跑
   `pnpm harness tick`,没有第四种"不挂 loop"的角色。
1. 读当前 sprint 的 `progress.md` 和 `session-handoff.md`。
2. 读当前 sprint 的 `active-features.json`(派生视图),找到唯一 `in_progress` 的 feature。
3. 只做那一个 feature。做完用验证命令证明,再收尾。

## 不可违反的硬约束
- **仓库即唯一事实来源**:你看不到的东西就不存在。所有上下文进仓库。
- **功能清单是权威**:`phases/<phase>/feature_list.json` 是该阶段唯一权威来源。
  sprint 的 `active-features.json` 是脚本派生的只读视图,**禁止手改**。
- **一次只做一个 feature**:每个 owner 同一时刻最多一个 `in_progress`。
  无 owner(`owner: null`)时退化为全局只能有一个(单 agent 兼容)。
  由 `assertSingleInProgress` 门控,见 ADR-001。
- **状态不能自己改**:你不能把 feature 直接标成 `passing`。只能跑
  `pnpm harness verify`,由验证脚本门控转移。`passing` 不可逆。
- **范围纪律**:只动当前 feature 涉及的代码,别顺手重构无关区域。
- **文件规模**:业务源文件原则上不超过 2000 行;接近上限时必须按领域职责拆分。超过 2000 行仅允许有明确豁免、拆分计划和验证证据,禁止继续在超限文件中堆功能。
- **UI 先行(仅 has_ui 阶段)**:UI 相关阶段的 `feature_list` 必须在真实 UI 经**人类**确认
  (`ui-signoff.md` status: confirmed)之后才定稿;`new-sprint` 对未确认的 UI 阶段直接拒绝。见 ADR-003。

## 完成定义(DON'T EDIT — 这是整个 harness 最关键的部分)
一个 feature 只有同时满足以下条件才算 `passing`:
1. `user_visible_behavior` 描述的行为真实可见、端到端可复现。
2. 该 feature 的每一条 `verification` 命令都执行成功(退出码 0)。
3. 证据已写入 `evidence`(命令输出 / 日志 / commit / 截图路径)。
4. 没有引入新的失败:`./init.sh` 的基础验证仍然通过。
没有证据 = 没有完成。"代码写完了""看起来能跑"都不算完成。

## 干净收尾(每轮会话结束前)
逐项过一遍 `.harness/rubrics/clean-state-checklist.md`,确保:
- 标准启动路径、标准验证路径仍可用。
- `progress.md` 已更新,`session-handoff.md` 已写。
- 功能清单真实反映 passing / 未验证边界(没有假 passing)。
- 没有半成品处于未记录状态;下一轮无需人工修复即可继续。

## 按需深入(渐进式披露,需要时才读)
- 系统架构总览 → `.harness/instructions/architecture.md`
- 智能体编排/工具/记忆约定 → `.harness/instructions/agentic-patterns.md`
- 多 agent 协调（权威 = coord-gateway/RepoHub 租约，ADR-017；issue 只承载规格与叙述 + review 门禁）→ `.harness/instructions/multi-agent-coordination.md`（见 ADR-004/009/017）
- **新 agent 接入执行书（第一次进来照它走）** → `.harness/instructions/agent-bootstrap.md`；背后的规则清单 → `agent-onboarding-checklist.md`（见 ADR-005）
- **人类开发者带 agent 加入 BoardX 开发** → `.harness/instructions/human-developer-onboarding.md`（面向人类；enroll 步骤 + 启用 agent 的首条消息模板 + 三级 coordinator 层级 + 性能管理，见 ADR-010）
- Agent 组织模型（多级 coordinator + 子 agent 注册 + 3h 性能周期 + 防断链）→ ADR-010
- **模块活知识库（做某模块的活之前先读）** → `.agents/skills/mod-<模块名>/SKILL.md`（15 个模块：room/board/canvas/collab/ava/knowledge-base/ai-store/studio/survey/credits-billing/admin/auth-identity/platform/devportal/harness；经验回流规则见各文件末尾）
- 编码规范 → `.harness/instructions/coding-standards.md`
- UIUX 规范 → `.harness/instructions/uiux-standards.md`
- 端到端验证标准 → `.harness/instructions/testing-standards.md`
- 可观测性约定 → `.harness/instructions/observability.md`
- 阶段/局部规则 → 对应 `apps/*/AGENTS.md`、`phases/<phase>/AGENTS.md`
- 文档该放哪一层（标准/ADR/档案）→ `docs/README.md`；项目专属事实单点 → `.harness/instructions/project/boardx.md`

## 需求录入流水线（新阶段开工前）
原始需求 → 智能体 → 权威功能清单：
1. `pnpm harness new-phase [--ui]` scaffold 出 `phases/<phase>/requirements/` 文件夹（`--ui` = 有界面的阶段）。
2. 把**原始需求**（大白话/用户故事）写进该文件夹，可按领域放多份 `*.md`（auth.md/teams.md/rooms.md…）。
3. **【仅 UI 阶段，has_ui】UI 先行确认关卡**（ADR-003）：先由 **ui-prototyper** 用真实组件
   （`apps/web` + mock 数据）把界面做出来 → **人类工程师**核对 → 把 `ui-signoff.md` 的 `status`
   改为 `confirmed`。未确认不得进入下一步（`new-sprint` 会拒绝）。
4. 调 **requirement-author** 智能体：读该文件夹全部 `*.md`（UI 阶段还读已确认 UI）→ 生成
   `feature_list.json`（带可执行 `verification`，锚定真实 `data-testid`）。
`requirements/` 是输入,不是权威;权威永远是 `feature_list.json`。

## 常用 harness 命令
```bash
pnpm harness new-phase  --name agent-runtime --goal "..."   # 缺省 --id 从 roadmap 自动取号(#660)；加 --ui 走 UI 先行关卡
pnpm harness new-sprint --phase 02 --id 01 --goal "..." --features F01,F02
pnpm harness verify     --sprint 02/01
pnpm harness sync       --phase 02 --apply
pnpm harness doctor     --phase 02        # 审计链体检：passing 证据真实性 + 派生视图一致（ADR-012；pre-push 自动跑）
```
