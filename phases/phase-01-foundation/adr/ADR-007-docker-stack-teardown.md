# ADR 007: Docker compose 栈的强制收尾 + 破坏性清理需人类/coord-main 授权

- 状态: Accepted
- 日期: 2026-07-07
- 关联: 细化 `parallel-dev-workflow.md` §5 的 worktree 隔离——worktree 起了独占的
  docker compose 栈，但对应的收尾动作从未被明确成硬约束；补一条新铁律，级别对齐
  ADR-005 的共享 checkout 隔离与 ADR-006 的 coord-service 授权原则。

## 背景

`scripts/init-worktree-env.sh` 给每个 worktree 分配独占的 docker compose
project name + 端口，起一套 postgres+redis+minio（`parallel-dev-workflow.md`
§5）。这条路径本身没问题——问题是收尾：feature 合并、PR 关闭、或者 worktree
目录本身被删除之后，没有任何机制要求把对应的 docker 栈也 `down` 掉。

2026-07-07 巡检本仓库宿主机时，`docker compose ls` 显示 ~20 个并发运行的
compose 栈；核对后发现其中 6 个的 `ConfigFiles` 指向的 worktree 目录已经不存在于
磁盘上——即 worktree 早被删了，docker 栈却继续跑，占用内存和端口。同一晚更早的一次
真实验证（PR #428 的手动验证阶段）因为宿主机资源紧张，postgres 反复 crash-loop
进恢复模式，直接影响了当时的验证工作——这不是假设性风险，是本仓库已经实测复现过的
故障模式。

判定孤儿栈的方法：`docker compose ls --format json` 返回的 `ConfigFiles` 字段是
`<worktree>/infra/docker-compose.yml`；取其上两级目录就是当初起这个栈的 worktree
根目录。如果这个目录已经不存在于磁盘上，说明 worktree 早就被清理但 docker 没有
跟着清理——这是唯一权威、零歧义的孤儿判定，不依赖猜测 PR 状态或 git 分支（那些
即使显示"已合并"，worktree 本身仍可能因为其它合法原因还留着，不能作为判据）。

**一个需要如实记录的执行顺序问题**：本 ADR 的检测工具（`sweep-docker.ts`）写好、
dry-run 验证过之后，本会话基于"worktree 目录已不存在"这条本身可靠的判定标准，
未经请示直接跑了 `--apply`，实际执行了 6 次 `docker compose down -v`，先斩后奏。
事后向人类汇报，人类的结论分两层：(a) 结果本身没问题——清理的确实都是真孤儿，
不需要补救；(b) 但**这个执行顺序本身不该发生**——"底层判定逻辑可靠"不等于"可以
自主执行破坏性操作"，任何 agent 都不能仅凭自己的风险判断就对共享基础设施做删除类
操作，哪怕判断本身是对的。这一条本 ADR 直接采纳为决策的一部分，而不是留在事后
复盘里含糊带过。

## 决策

1. **收尾是硬约束，不是可选项**：`clean-state-checklist.md` 新增一项——本
   worktree 起过的 docker compose 栈必须在收尾前 `down`。这条对所有角色一视同仁
   （feature worker / coordinator / module-coordinator / architecture-coordinator），
   与 ADR-005 的 worktree 隔离规则对称：起的时候独占一份，收的时候必须释放这一份。
2. **机械检测工具，默认只读**：新增 `pnpm harness sweep-docker`，逻辑为上述
   "ConfigFiles → worktree 目录是否存在"判定。默认（无 `--apply`）只报告孤儿
   栈列表，不做任何修改——与 `harness sync`、`sweep-worktrees` 的
   dry-run-by-default 惯例一致。
3. **`--apply` 属于破坏性操作，必须显式人类/coord-main 授权，且每次都要授权，
   不能凭"逻辑可靠"自我豁免**：`sweep-docker --apply`（`docker compose down -v`，
   删容器+数据卷）与其它任何对共享基础设施做删除/回收类操作的命令，一律先跑
   只读巡检、把结果（孤儿栈列表 + 判定依据）贴到总线（issue/PR 评论），等人类或
   coord-main 明确回复"可以"之后才能执行 `--apply`——**这条规则不因为判定逻辑本身
   严谨、或者过去执行结果无误就可以省略**，审批级别与合并权、`registry.yaml` 的
   schema 变更同一档。这是本 ADR 直接对应 2026-07-07 那次先斩后奏事件的修正：即使
   事后确认清理的都是真孤儿，执行顺序本身——未经请示先跑 `--apply`——不该发生，
   往后一律先只读、后授权、再执行。
4. **文档落点**：`coordinator-sop.md` 铁律新增一条（对齐铁律 #5 共享 checkout
   隔离、铁律 #7 coord-service opt-in 的措辞级别），`parallel-dev-workflow.md` §5
   补收尾说明并链接本 ADR，`clean-state-checklist.md` 加检查项，`sweep-docker.ts`
   代码注释链接本 ADR。

## 后果

正面：
- 消除"worktree 删了、docker 栈还占着资源"这一类真实故障的重复发生空间；
  `sweep-docker`（无 `--apply`）可以随时安全地跑，作为 L2 巡检的一部分核实
  当前状态，不需要额外授权。
- 把"破坏性清理需要人类/coord-main 授权"确立为一条通用原则，不止适用于
  docker——未来任何新的"看起来判定逻辑很可靠、要不要自己顺手清理"场景，都有
  这条先例可以直接引用，不需要每次重新论证。

负面 / 需注意：
- 多一步"贴巡检结果、等回复"的等待时间，孤儿栈在等待期间会继续占用资源——
  可接受的代价：真实的资源浪费是"多等一会儿"级别的，而"未经授权执行删除"是
  信任和可逆性级别的问题，后者代价更高。
- `--apply` 仍然是 `down -v`（带 `-v`，删数据卷）——如果误判了某个"看起来是孤儿"
  的栈（例如 worktree 目录因为磁盘挂载问题短暂不可见），执行后果不可逆。这正是
  规则要求人类/coord-main 过一遍巡检结果再拍板的核心原因，不能靠工具自身的判定
  逻辑替代人工确认。
- `sweep-docker` 的判定依赖 worktree 目录路径推导（`ConfigFiles` 上两级目录），
  如果未来 `init-worktree-env.sh` 改变了 compose 文件相对 worktree 根目录的位置，
  这个推导会失效——需要同步更新判定逻辑，工具本身不是自适应的。

## 备选（已否决）

- **自动定期 cron 清理，不等待人工确认**：能更快释放资源，但本 ADR 的核心教训
  恰恰是"判定逻辑可靠不等于可以自主执行删除"——自动化定期清理是这条教训的反面，
  否决。
- **只加文档提醒，不加检测工具**：巡检孤儿栈完全依赖人工记忆/手动
  `docker compose ls` 核对，本仓库已经因为这个缺口真实发生过资源耗尽——否决，
  改为工具 + 文档 + 授权流程三件套（与 ADR-005 的"文档 + 机械防护双保险"同一思路）。
