# ADR 005: 共享主 checkout 隔离——任何 agent 一律用独立 worktree

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-07-04
- 关联: 接续 ADR-004（issue 为协调总线）；细化 `parallel-dev-workflow.md` §5 的
  worktree 隔离到「所有角色」，不只是 feature worker。

## 背景

2026-07-03 夜间到 2026-07-04 凌晨的多 agent 并行实践中，同一晚发生了两次同类事故：

1. **Board agent stash 误伤**：一个会话在离开前做"清理回干净状态"的收尾动作，
   误伤了当时恰好检出在同一目录下的另一分支/stash（现场细节见总 coordinator lease
   issue #323 的 2026-07-04T00:02:18Z 事故复盘评论）。
2. **AVA 分支 ref 几乎丢失**：`worker/wrk-ava-p18-1-f03-research-persistence` 分支
   的 commit `0c17833` 一度从该分支的 ref 上消失（reflog 显示分支被重置回更早的
   `c3d0eef`）。事后用 `git reflog` 定位、确认 `0c17833` 已推送到 origin 未丢，
   在原分支上手动恢复。

根因分析（见 #323 同一条评论）：**共享主 checkout 的 `.git` 在所有"直接在这个目录下
工作"的会话之间是同一份**——`HEAD` 指向哪个分支、该分支的 ref 指向哪个 commit，
对所有并发使用这个目录的会话都是全局可见、全局可写的单一状态。任何会话对"当前分支"
执行 `checkout <other-branch>`、`reset --hard`、`branch -f`、`stash`（不分片给自己的
worktree）之类操作，都可能影响到**恰好也在使用这个目录、当前检出在同一分支上的另一个
会话**，而后者对此毫不知情。

`parallel-dev-workflow.md` §5 已经写了"每个 agent 在自己的 git worktree / 分支上工作"，
但表述范围是「N 个 agent = N 路并行」的 **feature worker** 场景；`coordinator-sop.md`
/ `module-coordinator` SKILL 里，coordinator 类会话常年习惯直接在共享主 checkout 里
`git checkout <branch>` 切来切去做巡检、核实 PR、临时验证——这条规则从未明确覆盖到
coordinator/module-coordinator/architecture-coordinator 这几类角色，本会话自己在
2026-07-04 处理 F03 evidence 提交时也遇到过一次轻量版的同类踩踏（分支被并发 merge，
本地提交被静默替换——见本会话对话记录，未造成实质损失，但确认了同一类问题在写入本
ADR 的这次会话里仍在发生）。

这不是"小心点"能解决的操作纪律问题，而是**共享可变状态的并发访问**问题——本 ADR
把 worktree 隔离从"feature worker 的最佳实践"升级为"任何角色都不可违反的硬约束"，
并补一层轻量的机械防护（git 原生 hook，非 Claude 专属），而不是只靠文档提醒。

## 决策

1. **一律 worktree，无角色例外**：任何 agent 会话（worker / reviewer / coordinator /
   module-coordinator / architecture-coordinator），只要不是"明确已知自己是当前
   唯一在使用共享主 checkout 的会话"，一律 `git worktree add` 开独立工作目录 +
   独立分支后再动手；不得在共享主 checkout 上执行 `commit` / `stash` / `reset` /
   `branch -f` / `checkout <branch>`（纯只读的 `git log` / `git show` / `git diff`
   查阅不受限）。coordinator 类角色的"巡检读总线、核实 PR 状态"如果只是 `gh` 命令 +
   只读 git 命令，不需要 worktree；一旦要落地写文件/提交，必须先开 worktree。
2. **分支创建后立即 push**：`git worktree add -b <branch>` 之后的第一个动作就是
   `git push -u origin <branch>`，不要攒到会话收尾再推。收益：即使本地这份 worktree
   之后出任何问题（被误删、宿主机重启、ref 被污染），origin 上已有一份可恢复的副本；
   `git reflog` 只是本地兜底，不是权威恢复手段。
3. **清理只删自己创建的东西**：会话收尾/清理阶段，只删除自己创建的分支、自己的
   worktree、自己 push 的 stash；绝不对"当前检出的分支"做整体性重置类操作
   （`reset --hard`、`checkout -- .`、`clean -f`、`branch -D <not-mine>`）——这类
   操作默认假设"这个目录只有我在用"，而这个假设在共享主 checkout 上不成立。
4. **机械防护（不只靠文档）**：新增 git `reference-transaction` hook，由 `init.sh`
   的 `install_reference_transaction_hook` 内联写入 `.git/hooks/reference-transaction`
   （heredoc 方式，与既有 pre-commit/pre-push hook 同一安装方式，不是单独的
   `scripts/hooks/` 源文件）。规则：
   - 只在**共享主 checkout**（`git rev-parse --git-dir` == `git rev-parse
     --git-common-dir`，即不是某个 linked worktree）里生效；worktree 内部天然
     隔离，不需要也不应该被这层拦截。
   - 只拦截 `refs/heads/*` 的**非快进（non-fast-forward）**更新——即"已有 commit
     从某个分支 ref 上凭空消失"这个动作本身，不管背后是 `reset --hard`、
     `branch -f`、`commit --amend` 还是别的命令。分支创建（旧值全零）与删除
     （新值全零）不拦截。
   - 命中时 exit 非零，`reference-transaction` 处于 `prepared` 阶段即可直接
     中止这次操作，打印指向本 ADR 的提示；可用 `ALLOW_HISTORY_REWRITE=1` 环境变量
     临时放行（明确知道自己在干什么、且已确认没有别的会话在用这个目录时）。
   - 选 `reference-transaction` 而非包一层 `git` 命令别名：它是 git 原生机制，
     对任何平台/任何 agent 一视同仁生效，不依赖 Claude Code 专属工具——符合
     architecture-coordinator 的"协议本体不能绑定单一平台"的设计原则。
5. **更新的文档落点**：`parallel-dev-workflow.md` §5 补一条"适用于所有角色，非仅
   feature worker"的明确说明 + 链接本 ADR；`coordinator-sop.md`、
   `.agents/skills/module-coordinator/SKILL.md`、
   `.agents/skills/architecture-coordinator/SKILL.md` 的启动仪式段各加一句
   "落地文档改动前先开 worktree，遵守 ADR-005"。

## 后果

正面：
- 消除"共享主 checkout 被并发踩踏"这一类事故的重复发生空间——即使有会话忘记开
  worktree、误做了破坏性操作，`reference-transaction` hook 会在本地直接挡下来，
  而不是事后靠 reflog 抢救。
- push-immediately 把"本地 worktree 出问题"的恢复成本从"可能不可逆"降到"重新
  `fetch` 一次"。
- 规则对任何未来接入的 agent（含非 Claude 平台）同样生效，因为落地机制是 git 原生
  hook + 文档约定，不是 Claude 专属能力。

负面 / 需注意：
- 每个会话多一步 `git worktree add` + 首次 `git push`，略增操作步骤；对纯只读巡检
  场景（coordinator 读 issue、核实 PR 状态）不需要，避免过度设计。
- hook 也会拦截共享主 checkout 上合法的 `git commit --amend` / `rebase`——这是
  预期行为（两者本质都是历史改写），不是 bug；在共享主 checkout 上想 amend/rebase，
  应先确认没有别的会话在用这个目录，再用 `ALLOW_HISTORY_REWRITE=1` 放行，或者
  （更推荐）直接去自己的 worktree 里做。
- 新建 worktree 缺 `node_modules`，`pre-push` hook 会因 "turbo not found" 失败——
  这是已知陷阱（见 `harness-workflow` SKILL「陷阱 5」），解法是先在该 worktree 跑
  `pnpm install`（monorepo 场景下 pnpm store 命中缓存通常几秒到十几秒完成），
  而不是用 `--no-verify` 绕过门禁；纯文档改动如确有必要跳过，需人类明确同意。
- `reference-transaction` hook 只挡"非快进的分支 ref 更新"，挡不住"跑错分支改错
  文件"或"在共享主 checkout 里 `git checkout` 切到别人正在用的分支"这类非破坏性
  但仍会造成困惑的操作——这两类问题仍要靠"只读巡检不算数、要落地就先开 worktree"
  的纪律来覆盖，机制本身不是银弹。
- hook 只在本机 `.git/hooks/` 生效，若某会话在从未跑过 `init.sh` 的裸 clone 里
  直接工作（理论上不应该发生，但不能 100%排除），这层防护不存在——落地仍以
  push-immediately 作为兜底。

## 备选（已否决）

- **只加文档提醒，不加机械防护**：#323 的事故复盘已经把规则写进了一条 issue 评论
  （"规则(即刻生效,写入 harness-workflow 与 coordinator-sop)"），但复核发现这条
  规则从未真正落地进 `coordinator-sop.md` / harness-workflow SKILL 的文件内容——
  这正是本次审计发现的具体漂移案例，也是本 ADR 认为"只发生在总线评论里的规则,
  不会自动变成大家会遵守的规则"的直接证据。否决"只靠文档"，改为文档 + 机械防护
  双保险。
- **包一层 `git` 命令别名/wrapper 脚本挡下危险子命令**：能覆盖更多命令
  （`checkout`、`clean` 等），但只对"记得用这个 wrapper 而不是直接调系统 git"
  的 agent 生效，本质上仍是"文档提醒"的变体，且是 shell 环境相关的私有约定，
  违反"协议本体不绑定单一平台"的设计原则。否决，改用 git 原生 hook。
- **服务端强制（要求所有 push 走 PR + 保护分支）**：能防止坏状态进 `main`，但防
  不住本 ADR 针对的问题——事故发生在**推送前的本地共享目录**，服务端规则鞭长莫及。
  两者不冲突，是互补关系（服务端保护见 `multi-agent-coordination.md` §5，因套餐
  限制暂不可用），不是本 ADR 的备选，而是另一层独立防护，故不在此重复。
