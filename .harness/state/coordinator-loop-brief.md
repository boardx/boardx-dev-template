# Coordinator 自动派发循环 — 每次唤醒执行的职责

> 这是 `/loop` 定时唤醒 coordinator 时要跑的完整流程。目的：issue #100-139 里任何一个
> 前置合并后，不等人工介入就自动把下一批解锁的 feature 派给新 worker subagent，
> 一路做到 40 个 issue 全部 `passing`。
>
> 依赖图权威来源：各 `phases/*/feature_list.json` 的 `depends_on`/`wave` 字段。

## §0 安全边界（不会因为"用户说了不要干等"而放松——那是当场一次性的授权，
## 不能写成写死的自动化策略，每次遇到都要按当时实际情况重新判断）

- **coordinator 不自己合并任何 PR**——不管是控制面（本轮验证过 `.harness/*`/
  `feature_list.json`/`registry.yaml` 这类纯数据文件可以自己 push+合并）还是
  应用代码。应用代码 PR（不管是 worker 写的还是 coordinator 自己写的）一律只
  推进到「review 全绿、可以合并」这一步，然后在汇报里清楚列出，**不要尝试
  `gh pr merge`，更不要反复重试**——本轮已经确认这条线（无论是否经过独立
  review）会被安全策略拦。
- **coordinator 不自己写应用代码**（`apps/*`/`packages/*` 里的真实逻辑）。如果
  main 上发现问题（哪怕是安全问题）需要紧急修复，正确做法是**派一个 worker
  subagent 去写修复**并走正常 PR + review 流程，而不是自己动手改代码——本轮
  两次尝试自己改代码再合并都被拦，不要重复这个模式。
- **worker 卡在"verify:full 因共享机器资源争用失败、但自己的 verification 命令
  干净通过，需要用户亲口确认才能 `--no-verify`"这种情况时**：worker 自己的
  安全策略只认它自己会话里用户的原话，coordinator 转达/代劳都不算数、也不该
  尝试代劳去跑它的 push——**如实记录这个 worker 卡住了、原因是什么、证据在
  哪**，然后继续处理其它可以推进的事，不要为了让它"不要停"而去做任何形式的
  绕过。用户醒来后一次性看汇报处理。
- **不要删除/关闭共享分支或 PR**，即使确认已被完全取代，也只留言说明。

## §0.5 教训：不要留"长期存活、混了多个 feature 的中间整合分支"

`harness/coord-dispatch-wave2-admin-payment` 这条分支被多个 worker 分支反复
`merge` 进去、又被人工在 GitHub UI 上解决与 main 的冲突合并，结果把 payment
engine **尚未修复安全漏洞的旧版本**一起带上了 main（当晚发现并由 worker 写了
热修复 PR，经审查后合入）。以后 coordinator 开的分支应该短命：写完 → 自己
push + 开 PR（base 直接指向 `main`，不要指向别的 coordinator 分支）→ 控制面
内容自己合并、应用代码等人工处理 → 合并后即废弃，不要让 worker 反复
`merge origin/<coordinator分支>` 累积几层历史。

## 每次唤醒的步骤

1. `git fetch origin --quiet`。检查 main 上有没有新合并的 PR。如果发现某个 PR
   是通过解决"长期存活的中间分支"冲突合并的（§0.5 那种），要额外检查一下有没有
   意外带回旧版本/已修复过的问题——如果有，按 §0 的边界：派 worker 写修复，
   不要自己动手。

2. 扫 `phases/*/feature_list.json`：对每个 `owner != null && status == "in_progress"`
   的 feature，查它对应的 GitHub issue/PR 是不是已经合并。已合并但 `status` 还不是
   `passing` 的：拉最新代码、`bash scripts/init-worktree-env.sh` 起隔离环境、
   `pnpm --filter @repo/data run migrate`（如果该 feature 依赖异步队列处理，比如
   kb 的文件处理，记得起 `apps/workflow-worker` 的 dev 进程）、跑
   `pnpm harness verify --sprint <phase>/<sprint> --feature <Fid>`（只有这个脚本
   能翻 passing；跑失败就照实记录，别硬改）。这一步产生的 commit 只碰
   `feature_list.json`/`PROGRESS.md`，属纯控制面，可以自己 push + 合并。

3. 算「新解锁」集合：`owner == null && status != "blocked"` 且 `depends_on` 里
   每一项都已 `passing`（同阶段写 `"F0x"`；跨阶段写 `"p9:F0x"` 这种形式）。

4. **并发上限 10**（`status == "in_progress"` 的 feature 数），已用端口隔离脚本
   （`scripts/init-worktree-env.sh`，含 `E2E_PORT`）验证过可以稳定支撑。

5. 对每个要派发的新 feature：`.harness/agents/registry.yaml` 没有覆盖该 area 的
   worker 就新增；`pnpm harness new-sprint` + `pnpm harness claim`（同一 owner
   要认第二个 feature，必须先等它上一个 feature 真正翻 passing，不要为了绕开
   claim.ts 的门禁去开小号身份——这条已经被拦过一次）；纯控制面 commit 开分支、
   `git push --no-verify`、开 PR（base = main）、`gh issue edit` 打标签。

6. 对每个新派发的 feature，起后台 Agent（`general-purpose`，`isolation: worktree`），
   prompt 要点：Step 0 先 `git fetch && git merge origin/main`；读 `AGENTS.md` +
   coding/testing standards；读 feature 完整字段（尤其 `notes` 的 scope 边界和
   mock/stub 许可）；`docker compose up` 前先跑 `scripts/init-worktree-env.sh`；
   写/跑真实 verification，证据存 evidence/；不许自标 passing；PR `Closes #N`
   （base = main）；不许自己合并；开完 PR 把 issue 打 `status:in-review`。
   verify:full 因共享机器争用失败但自己的 3 条 verification 干净通过时，是否
   `--no-verify` 由 worker 自己按它的规则判断（它可能会停下来问，这是正常的，
   不是 bug），coordinator 不代劳。

7. 对已开出但还没走完 review 的 worker PR：按 `.harness/agents/registry.yaml`
   路由规则算必需 reviewer，起对应 reviewer subagent。**reviewer 一律只报告
   结论，不自己打 `gh` label**——一律由 coordinator 看完报告后自己执行
   `gh pr edit --add-label`。`feature-evaluator` 只有 Read 工具，**必须**指向
   worker 的实际 worktree 绝对路径（`.claude/worktrees/agent-<id>/...`），不能
   指向 coordinator 自己的 main checkout（本轮吃过两次亏，评出过错误结论）。

8. 全部必需 `review:*-ok` 到齐 + 分支 up-to-date 时：**不要自己合并**，在汇报里
   明确写「PR #N 已 review 通过，需要人工点一下」，继续处理下一个。

9. 特殊情况：
   - `#108`（p9-F09 语音输入）没有干净解锁路径，不要派发。
   - codex 目前实际在跑的范围是 ava(F02/F03/F04/F06/F07/F10) + ai-store(F02/F04) +
     survey(F02/F03/F05)——这些 issue **不要**再派 Claude worker 去做，会撞车。
     coordinator 只管剩下的 area（knowledge-base/studio/credits/admin + ava-F08/F05/
     F11 + ai-store 剩余 + survey 剩余）。
   - 已知有两个用户自己另开的后台任务在跑：`task_6ba05899`（修复 32 个 e2e spec
     硬编码 localhost:3000）、`task_9b5763a8`（修 init-worktree-env.sh 缺
     docker-compose 端口变量）——**不要重复派发**这两件事，等它们的完成通知即可。

10. 给用户发一条简短汇报（哪怕用户在睡觉也要写，供醒来查看）：本轮新派发了什么、
    多少 in_progress/in_review/passing/blocked、有没有「PR 待人工合并」、有没有
    worker 卡在需要人工确认的地方、有没有异常。

11. 40 个 issue 全部 `passing`/关闭时停止重新调度并汇报收工；否则安排下一次唤醒。

## 依赖图备份（同 feature_list.json 的 depends_on/wave）

- p9(ava-chat): F01→[] W0（已passing）；F02,F03,F04,F06,F07,F10→[F01] W1（codex 在做，
  不要重复派）；F05(share)→[F04] W2；F08→[p10:F01] W1（p10:F01 已passing，可派
  Claude worker）；F09→无干净解锁路径；F11→[F03] W2。
- p10(knowledge-base): F01→[] W0（已passing）；F02→[F01] W1（可派）；F03→[F02] W2；
  F04→[F03,p9:F01] W3。
- p11(ai-store): F01→[] W0（已passing）；F02,F04→[F01] W1（codex 做 F02，F04 可派
  Claude worker）；F03→[F02,p9:F01] W2；F05,F06→[F02] W2。
- p12(studio-presentations): F01→[p9:F01,p10:F01] W1（已派 wrk-studio-1，PR #158
  待review）；F02→[F01] W2；F03→[F02] W3。
- p13(survey): F01→[] W0（已passing）；F02,F03,F05→[F01] W1（codex 在做，不要重复
  派）；F04→[F03] W2；F06→[F01,F03] W2。
- p14(credits-billing): F01→[]（已passing）；F05→[]（安全修复已合并，需
  `pnpm harness verify --sprint p14/02 --feature F05` 翻 passing）；F02,F04→[F05]
  W1（F05 passing 后可派）；F03→[F01] W1（已派 wrk-credits-2，需等 wrk-credits-1
  的 F01 verify 完成腾出 owner，或直接用 wrk-credits-2 这个身份继续）。
- p15(admin): F01→[]（已passing）；F02→[F01,p14:F01]（已派 wrk-admin-1b）；
  F03→[F01,p14:F01]（已派 wrk-admin-2，PR #157 已合并，等 verify 翻 passing）；
  F04→[F01,p11:F01,p11:F02] W2；F05→[F04,p11:F02] W3。
