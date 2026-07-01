# Coordinator 自动派发循环 — 每次唤醒执行的职责

> 这是 `/loop` 定时唤醒 coordinator 时要跑的完整流程。目的：issue #100-139 里任何一个
> 前置合并后，不等人工介入就自动把下一批解锁的 feature 派给新 worker subagent。
> 依赖图权威来源：各 `phases/*/feature_list.json` 的 `depends_on`/`wave` 字段
>（见 PR #142；如果 main 还没合并这个 PR，本文件末尾附的表是同一份数据的只读备份）。

## 每次唤醒的步骤

1. `git fetch origin --quiet`。检查 coordinator 的 stacked 分支/PR
   （目前是 #140 → #141 → #142）有没有被人合并；合并了就说明 main 上已经有
   `depends_on`/`wave` 元数据了，之后直接读 main 上的 `feature_list.json` 即可。

2. 扫 `phases/*/feature_list.json`：对每个 `owner != null && status == "in_progress"`
   的 feature，查它对应的 GitHub issue 是不是已经 `closed`（PR 已被人工合并）。
   已关闭但 `status` 还不是 `passing` 的，跑
   `pnpm harness verify --sprint <phase>/<sprint> --feature <Fid>` 去正确翻转状态
   （只有 verify 脚本能翻 passing；跑失败就照实报告，别硬改）。

3. 算「新解锁」集合：`owner == null && status != "blocked"` 且 `depends_on` 里
   每一项都已 `passing`（同阶段写 `"F0x"`；跨阶段写 `"p9:F0x"` 这种形式，去对应
   phase 的 feature_list.json 查）。这些是本轮可以派发的候选。

4. **并发上限**：统计全仓 `status == "in_progress"` 的 feature 数；≥10 就不再新派，
   只汇报队列深度（docker 端口已靠 `scripts/init-worktree-env.sh` 隔离，但机器算力/
   review 带宽还是有限，10 是保守起点，观察一段时间没问题可以调高）。

5. 对每个要派发的新 feature：
   - `.harness/agents/registry.yaml` 里没有覆盖该 area 的 worker 就新增一个
    （命名 `wrk-<area>-N`）。
   - 需要的话 `pnpm harness new-sprint --phase <p> --id <NN> --features <Fid>`，
     然后 `pnpm harness claim --phase <p> --feature <Fid> --owner <id>`。
   - 这些纯控制面改动开一个新分支（stack 在最新一个还没合并的 coordinator 分支上；
     如果 coordinator 分支已全部合并，就直接从 main 开），
     `git push --no-verify`（**仅限**纯 `.harness/`、`phases/*`、`registry.yaml`
     这类控制面文件；碰了 `apps/*`、`packages/*` 等应用代码就必须走正常
     `verify:full` 门禁，不能 `--no-verify`）。
   - 开 PR，`gh issue edit <N> --add-label "agent:<id>,status:in-progress"`。

6. 对每个新派发的 feature，起一个后台 Agent（`subagent_type: general-purpose`，
   `isolation: worktree`），prompt 沿用之前几轮的模板套路：
   - Step 0 必须先 `git fetch && git merge origin/<对应 coordinator 分支>` 补齐控制面状态
    （worktree 创建时机可能早于 coordinator 的 commit，历史上出过这个问题）。
   - 先读 `AGENTS.md` + `.harness/instructions/{coding,testing}-standards.md`。
   - 读该 feature 在 `feature_list.json` 里的完整字段（尤其 `notes` 里写的 scope 边界
     和 mock/stub 许可）。
   - `docker compose up` 前先跑一次 `bash scripts/init-worktree-env.sh`。
   - 写/跑真实 verification 命令，证据存进对应 sprint 的 `evidence/`。
   - 不许手改 `status` 到 `passing`；提 PR（`Closes #N`，base 指向对应 coordinator
     分支或 main）；不许自己合并；开完 PR 把 issue 打成 `status:in-review`。

7. 对已开出但还没走完 review 的 worker PR：按 `.harness/agents/registry.yaml` §末尾
   的路由规则（`required_for` 含 `"*"` 或命中该 issue 的 area）算出必需 reviewer，
   起对应 reviewer subagent（`rev-code`→code-reviewer、`rev-feature`→feature-evaluator、
   `rev-e2e`→e2e-verifier、`rev-security`→code-reviewer 安全视角）跑在那个 PR 的 diff 上。
   **不要自己合并 PR**——包括 `--admin` 强制合并，这个环境的安全策略会拦下"自己开的 PR
   自己合并、没有人工 review 出现在 transcript 里"这种操作。全部必需 `review:*-ok` +
   CI 绿 + 分支 up-to-date 时，在汇报里明确写「PR #N 可以合并了，需要人工点一下」，
   不要反复重试合并。

8. 特殊情况：
   - `#108`（p9-F09 语音输入）没有干净的解锁路径（依赖一个还没被建成 feature 的
     共享 STT 能力）——不要派发，除非用户另外建了对应的 capability feature。
   - `#106`/`#109`（p9-F07/F10）按正常 wave 派发核心功能即可；在 worker prompt 里
     注明「Agent 选择器接入 AI Store 的增强」是等 `#116`(p11-F02) 合并后的独立
     follow-up feature，不阻塞这两个 issue 本身的派发。

9. 给用户发一条简短汇报：这轮新派发了什么、有多少 in_progress/in_review/passing/
   blocked、有没有「PR 已就绪待人工合并」、有没有异常（verify 失败、认领租约超过
   6 小时没进展等）。

10. 40 个 issue 全部 `passing`/关闭时停止重新调度并汇报收工；否则安排下一次唤醒。

## 依赖图备份（同 feature_list.json 的 depends_on/wave，供 main 尚未合并 PR #142 时兜底）

- p9(ava-chat): F01→[] W0；F02,F03,F04,F06,F07,F10→[F01] W1；F05(share)→[F04] W2；
  F08→[p10:F01] W1；F09→无干净解锁路径；F11→[F03] W2。
- p10(knowledge-base): F01→[] W0；F02→[F01] W1；F03→[F02] W2；F04→[F03,p9:F01] W3。
- p11(ai-store): F01→[] W0；F02,F04→[F01] W1；F03→[F02,p9:F01] W2；F05,F06→[F02] W2。
- p12(studio-presentations): F01→[p9:F01,p10:F01] W1；F02→[F01] W2；F03→[F02] W3。
- p13(survey): F01→[] W0；F02,F03,F05→[F01] W1；F04→[F03] W2；F06→[F01,F03] W2。
- p14(credits-billing): F01,F05→[] W0；F02,F04→[F05] W1；F03→[F01] W1。
- p15(admin): F01→[] W0；F02,F03→[F01,p14:F01] W1；F04→[F01,p11:F01,p11:F02] W2；
  F05→[F04,p11:F02] W3。
