# 会话交接 — Sprint p21/01

## 当前已验证
- **F02**（团队成员角色接口越权修复，owner: wrk-platform-2）：2026-07-05 本轮会话在新
  worktree 上，本机 Docker 资源空闲，`pnpm harness verify --sprint p21/01 --feature F02`
  一次性跑通全部 5 条 verification + 基础验证 → **门控通过，F02 = passing**。代码此前已由
  PR #399（"替代误合并的 #394"，cherry-pick 自已过两轮 rev-security 复审的提交）落地在 main
  上（commit `c3a449d`），本轮只是让脚本把已完成状态如实登记，未改任何代码。
- **F04**（Team F06-F09 证据补齐 + F13 状态拆分回填，owner: wrk-platform-2，issue #376）：
  `pnpm harness verify --sprint p21/01 --feature F04` 门控通过 → **F04 = passing**。

## 本轮改动（F04 正式范围）
- `phases/phase-04-identity-and-spaces/feature_list.json`：
  - F06/F07/F08/F09 的 `evidence` 字段改为指向本轮真实重跑并落盘的日志（原 2026-06-29 的
    evidence 引用文件从未存在于仓库，`sprint-02/evidence/` 此前只有空 `.gitkeep`）。
  - F13（原 `[DEFERRED] 团队设置/Home/Memory/AI Store`，覆盖 uc-team-007/008/009/010）拆分：
    - 收窄为仅 uc-team-009（团队 Memory），继续 `not_started` + DEFERRED（`team_memories`
      表确实不存在，`packages/memory` 是 harness 自身会话记忆基础设施，与团队 Memory 无关）。
    - 新增 **F15**：uc-team-007（团队改名/描述/删除），标记 `passing`，指向
      `e2e/team-007-general-settings.spec.ts`（5 用例全过）。commit `f603f45` 早已实现
      （`apps/web/app/(app)/teams/page.tsx` General 设置区 + PATCH/DELETE
      `/api/teams/[id]`），只是从未回填 feature_list.json。
    - 新增 **F16**：uc-team-008（Team Home 统计壳）+ uc-team-010（团队 AI Store 入口），
      标记 `not_started`（不是 passing，也不再是过时的 DEFERRED）——AI/AI Store 底层平面已
      具备条件（p9-ava-chat 10/11 passing、p11-ai-store 5/6 passing，团队维度审核精选页面
      `teams/[id]/ai-store-review/page.tsx` 已真实存在），但 Team Home 页面本身、团队维度的
      Store Explore/Subscribe 页面尚未实现，留待后续排期，**本 feature 未实现这两个页面**。
- 新增 evidence 文件（均已 git add）：
  `phases/phase-04-identity-and-spaces/sprints/sprint-02/evidence/F06.verify.log`、
  `F07.verify.log`、`F08.verify.log`、`F09.verify.log`、`F15.verify.log`；
  `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F04.verify.log`。
- 未新增/修改任何业务代码——本 feature 定义就是"重新验证 + 状态回填"，不要求重新实现。

## 顺带核实（未改动）
- `apps/web/app/api/invite/[token]/route.ts`：gap-report 怀疑的疑似死 STUB 路由。核实后仍被
  `apps/web/app/invite/[token]/page.tsx` 引用（GET 解析邀请信息 + POST 接受邀请），是一个真实
  UI 页面的后端支撑，**不是死路由**，按指示"不确定就跳过"未删除。

## 仍未解决/需要 coordinator 关注
- **重复 PR 风险**：PR #399（`worker/wrk-platform-2-p21-f02-refix-onto-main`，Closes #374）
  此前已经把 F02 的代码+evidence+`feature_list.json` 状态更新一并打包在同一个 PR 里，但截至
  本轮会话仍是 **OPEN 未合并**。本轮会话是在独立干净 worktree 上重新从 origin/main 出发，
  跑通了 verify 让 F02 状态落到本地并随 F04 一起提交/开 PR。这意味着 main 上可能会有两个
  PR 都尝试把 F02.status 改成 passing（内容应该一致，因为都是重跑同一批已经存在于 main 上的
  代码/测试，但字面 diff 可能不完全相同，如 evidence 时间戳）。建议 coordinator：
  1. 确认 PR #399 与本 PR 里 F02 相关的 diff 是否冲突；
  2. 只保留一个 PR 落地 F02 状态更新，关闭另一个重复部分（不影响各自 PR 里 F04 相关的
     独立内容）。
- F13/F15/F16 的拆分是本轮新引入的 feature id 分配（phase-04 之前最大编号是 F14），如果同一
  时间还有其它 agent 在改 phase-04 的 feature_list.json，需要 coordinator 核对是否有 id 冲突。

## 下一步最佳动作
- 走 PR review（建议至少一轮 rev-code 确认 F13→F15/F16 拆分逻辑合理、evidence 路径真实存在
  于 git 历史），通过后交 coordinator 合并，worker 不自行合并。
- coordinator 处理上述"F02 重复 PR"的收尾（关闭其中一个、避免 main 上产生冲突的 evidence
  时间戳/状态写入顺序问题）。
- F16（Team Home + 团队 AI Store 入口）已经从 DEFERRED 解除为 not_started，可以在后续 sprint
  正常排期实现，不再需要"等待 AI 平面就绪"的前置检查。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p21/01 --feature F04`（本 feature）；
  `pnpm harness verify --sprint p21/01 --feature F02`（如需重新确认 F02）。
- 本轮 worktree 独立端口: `bash scripts/init-worktree-env.sh`（每个 worktree 各自分配，
  不与其它并行 agent 冲突）。
