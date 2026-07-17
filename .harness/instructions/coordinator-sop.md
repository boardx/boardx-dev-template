# Coordinator SOP — 分层监控循环（v1）

> `multi-agent-coordination.md` §2 定义了 coordinator 单轮循环"做什么"（ADR-004 §4 确立 coordinator 角色）；本文定义"什么节奏做、每层必查什么"。
> 目标：事件驱动为主、定期扫描兜底，任何一层漏掉的问题都会被更大的循环接住。

## Loop 设计原则（先读这个）

自动派发循环（`/loop` 唤醒、事件驱动 tick）的八条设计原则已归纳为独立文档
`loop-design-principles.md`（拿锁才调度 / 事件驱动为主扫描兜底 / 一次性授权不写进
自动化策略 / 汇报而非代劳 / 不可静默等待 / 分支短命 / 状态视图脚本生成 / 破坏性
动作永远在 loop 之外）。均归纳自本文与 `.harness/state/coordinator-loop-brief.md`
的既有教训，实现或修改自动循环前先读它。

## 三层循环

### L0 事件层（~60s，事件驱动，非轮询开销）
监听总线变化（issue 的 `status:*`/`review:*` label、open PR 的 CI check 结论），**有变化才动作**：

| 事件 | 动作 |
|---|---|
| issue → `status:in-review`（新 PR） | 导出 diff，按 §3 路由调起必需 reviewer |
| reviewer verdict 齐 | 全绿 → 走合并门禁；任一 CHANGES → `status:changes-requested` + PR 评论逐条返工清单 + @worker |
| 返工 push（changes-requested 的 issue 回到 in-review） | 复核返工 commit：逐条对照原返工清单实测（git ls-tree / git show，不信任声称），到位即翻绿 |
| CI check 失败 | **先分诊**：job steps 为空 + 秒级失败 + annotation 含 billing/runner 字样 = 基础设施问题，升级人类、不退回 worker；否则读失败日志归因到代码，退回 worker |
| `status:blocked` 出现 | 读原因评论，能解则解（缺依赖→调整分派；缺 key/环境→升级人类） |

### L1 队列层（~5min 或每次事件处理完顺手做）
1. **合并队列**：`status:approved` ∩ CI 绿 ∩ 分支 up-to-date → 按约定顺序合并（动共享文件多的最后合），置 `status:merged`、关 issue、跑 `pnpm harness verify`。
   **热点文件额外一步**：如果待合并 PR 改动的文件，同一批次里还有其它 PR 刚合并过同一文件——"up-to-date"（git 层面无文本冲突，GitHub 显示 mergeable）不代表"合并后仍能编译"：两个 PR 各自在同一文件不同位置插入同名声明/重复逻辑，文本上完全不冲突，语义上会炸（先例：PR #415 与 #417 各自独立给 `board-canvas.tsx` 声明 `itemsRef`，两边 CI 各自绿、mergeable 各自为真，合并后 main 上 `TS2451` 重复声明，靠 hotfix #427 收场，见下方"事故分诊速查"）。本仓库因套餐限制没有 GitHub 的 merge queue（合并前对最新 base 重新跑 CI）可用，兜底只能是社会性约定：**热点文件的 PR 合并前，本地把当前 main 实际 merge 一次，重新跑一遍受影响包的 typecheck，绿了再合**，不要只看 GitHub 界面的 mergeable 状态。
2. **review 在途**：调起 >15min 未回的 reviewer agent 是否还活着，死了重派。
3. **分派补给**：有空闲 worker 且存在 `status:ready-for-dev` ∩ 依赖全绿 ∩ 与在途 PR 无同文件热点 → 分派（认领双写：`harness claim` + label）。

### L2 全局层（~15min）
1. **lease/deadline 巡检**：按下方"Deadline 与分级补救"表逐项检查，触发即执行对应 tier 动作（不止 worker lease，还包括 changes-requested 停滞、review 未派、CI 卡住等）。
2. **漂移巡检**：抽查 label 与事实一致性——`review:*-ok` 是否都有对应 reviewer 产出记录（评论）；有无非 coordinator 编排的 verdict label（出现即摘除并留言，见"verdict 权威"）。
3. **阻塞升级**：`status:blocked` 超过 1 个 L2 周期无进展 → 评论 + 通知人类。
4. **基础设施健康**：CI 是否整体可用（账单/runner）；不可用时在追踪评论里刷新状态。
5. **背景任务盘点**：自己派出的 reviewer/verifier agent、监控任务有无僵死；scratchpad worktree 有无该清理的；
   **对应的 docker compose 栈是否也一并 down 了**——worktree 删了但 docker 栈没 down 是最常见的
   遗漏（`pnpm harness sweep-docker` 能扫出这类孤儿栈），见 ADR-007。

## Deadline 与分级补救（2026-07-04 起）

> 根因：今晚多条返工线（PR #315/#332/#350/#355）反复出现"发了返工清单后 2-4 小时无新提交"，
> 而 coordinator 只是在 L2 巡检时"注意到"没推送，没有明确的"超时了该做什么"规则——
> 全靠临场判断，容易该催不催、该代修不代修、该升级不升级。以下把这类判断固化成表。

| 对象 | Deadline | Tier 1（软提醒） | Tier 2（升级） | Tier 3（补救） |
|---|---|---|---|---|
| `status:in-progress`（worker 认领锁） | 6h 无进展 | — | **强制**：在总线（issue/PR）上贴一条带明确时限的通牒（例："接下来 N 分钟/小时内如果看不到实际进展（哪怕是 draft PR），我会视为 stale 直接回收重分派"），不能只是"注意到了"就默默等或默默回收（先例：coord-main 对 #406 给 45 分钟窗口、coord-board 对 #282 给 2 小时窗口，均在窗口内/窗口后收到明确结果或据此回收）——**本条对 coord-main 和全体 module-coordinator 一视同仁，不因层级或角色豁免** | 窗口到期仍无可验证进展（commit/push/评论）→ 回收 lease、回退 `ready-for-dev`，可重分派（已有，ADR-004 §4） |
| `status:changes-requested`（返工中） | 2h 无新提交 | 总线追加提醒评论 @worker，附上次返工清单链接 | 4h 无新提交：判断 worker 会话是否仍在运行——仍在运行但静默＝排队中，不追加动作；会话已停止/不可达＝视同 lease 超时，回收或重分派 | 若纯机械性小改、已给过明确修法、且已返工 ≥2 轮未落地：coordinator/module-coordinator 可直接代为修复（先例：PR #327 第三轮），修完仍需过独立 review，不可自我豁免 |
| `status:in-review`（等 reviewer） | 30min 内未派出 reviewer | 自查为何漏派 | — | 立即补派，属 coordinator 自身失职，不算 worker 责任 |
| `coordinator`/`module-coordinator` 心跳 | 30min（已有，见生命周期章节） | — | 抢占仪式（已有） | 抢占 |
| PR CI pending | 30min 未出结果 | 查 CI 健康（账单/runner） | 确认平台问题 → 升级人类，明确标注不算 worker 责任 | 平台恢复后重跑 |
| 需要人类拍板的产品/安全降级决策（如"是否接受某类已知安全边界"） | 无固定时限，发现即标注 | 在 issue/PR 上明确写"需要人类批复"+ 可选项，不擅自代为拍板 | 人类长时间未回应且不阻塞其他工作 → 继续推进其他线，定期在总 lease issue 重申待决事项 | 绝不静默降级安全/产品决策 |

**执行位置**：L2 巡检的"deadline 巡检"项按此表逐条检查；触发 Tier 2/3 的动作需在对应 issue/PR 留痕（不只是内部判断），保持"总线是权威"。

### L3 会话层（每轮会话收尾/交接时）
- 未完成的协调状态写进总线（issue 评论），不留在会话记忆里——下一个 coordinator 冷启动只读总线即可续上。
- 更新 `.harness/state/PROGRESS.md` 中协调平面相关条目。

### C-cycle 团队节拍层（~3h，叠加在 L0/L1/L2 之上，2026-07-08 起）
> 完整设计与 amendments 见 `work-cycle-proposal.md`（PR #443 + 同日三处 ADR-009
> 对齐修正）。唯一目标是压等待、缩短 PR 开出→合并的流动时间；试运行 3 个周期后
> 只看这一个指标，不降就砍仪式只留 SLA+Andon。

- **时钟**：锚定 UTC 整点 00/03/06/09/12/15/18/21，`cycle id = 起始时刻的 ISO8601`
  （如 `2026-07-08T06:00Z`），无状态可推算，不搞相对时钟。
- **cycle-plan / cycle-result**：每个在任 coordinator 在专用 `[coordination]
  work-cycle` issue（label `coordination:work-cycle`，全仓唯一）按提案格式发周期
  计划与结果评论——**不是 lease issue**（那已随 ADR-009 退役）。coord-main 周期末
  汇总一条全局 cycle-report 到 #323。
- **WIP 上限**：每 module 同时 in_progress ≤ 2（ADR-001 每 owner 一个的补充维度）。
- **Andon 停线**：main typecheck/verify 红 = coord-main 在 #323 发 `andon-stop`，
  全线暂停 rebase/merge，修复后 `andon-clear`。
- **SLA**（超时动作机械执行，见提案表格）：新 PR 同周期内必得首个 review 结论；
  CHANGES 返工 1 周期；`in_progress` 的 D1 claim 用 `ttl_seconds=10800` 由 sweeper
  机械过期回收；低风险 PR（纯文档/元数据）review+merge ≤ 30 分钟。
- **热点申报**：动 `.harness/state/hotspots.md` 所列文件的 PR 必须在 cycle-plan
  申报；同周期撞热点由 coord-main 排序。
- **健康表**：`pnpm harness cycle-report`（只读）聚合当前周期承诺/超时/flow time。

## 铁律（任何层都不可违反）
1. **verdict 权威**：`review:*-ok` 只能由 coordinator 编排的 reviewer 产出。发现来路不明的 verdict → 摘除 + 留言，以可核验事实（git ls-tree、命令退出码）重裁。
2. **coordinator 唯一**：唯一性由 coord-service (D1) 的 `role:coord-main` claim 裁定（2026-07-08 起，ADR-009；此前的 `coordination:lease` issue 心跳机制已退役，见下方生命周期章节）；接管协调前先向存量协调会话广播；双 coordinator 结论冲突时，以可核验事实为准，并立即收敛为单 coordinator。
3. **合并独占**：只有 coordinator 执行合并；review 全绿 + CI 绿 + up-to-date 缺一不可（CI 因基础设施不可用时，合并冻结并升级人类，不得以"本地验过"绕行）。
4. **证据实测**：任何"已验证/已入库"声称都用 `git ls-tree` / `git show` / 退出码实测，不信任 diff 注释、progress 叙述或打分。
5. **共享主 checkout 隔离**：任何要落地写文件/提交的会话（含 coordinator 自己）一律
   `git worktree add` 开独立工作区，不在共享主 checkout 上 `commit`/`stash`/`reset`/
   `branch -f`/`checkout <branch>`；分支建好立即 push。见 ADR-005
   （`docs/adr/ADR-005-shared-checkout-isolation.md`），本地另有
   `reference-transaction` git hook 兜底拦截非快进更新。
6. **不可静默等待**：发现 lease/PR 停滞（见上方 Deadline 表）时，必须在总线上贴出带
   明确时限的通牒，再据此回收/升级——不能只是内部判断"再等等"或"已经提醒过了"就不再
   跟进。这条对 coord-main 和全体 module-coordinator 一视同仁，没有"层级更高就可以裸等"
   这回事（人类反馈直接触发，2026-07-07）。
7. **coord-service 是唯一协调权威（2026-07-08 起，取代本条旧文）**：`lock-*`/
   `module-lock-*` 必须配置 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 才能使用，
   未配置直接报错——不存在降级回 GitHub 的路径（GitHub 协调面已整体退役）。
   权威（D1）联系不上时 acquire fail-closed 拒绝执行，`--force` 仅限人类授权的
   抢占仪式。见 ADR-009（`docs/adr/
   ADR-009-github-coordination-plane-retirement.md`）；本条 2026-07-08 之前的
   opt-in 版本见 ADR-006（保留为历史决策记录）。
8. **破坏性清理操作需要显式人类/coord-main 授权，任何会话都不能仅凭自己判断"逻辑
   可靠"就执行**：`pnpm harness sweep-docker --apply`（删容器+卷）、以及其它任何
   对共享基础设施做删除/回收类操作的命令，一律先跑不带 `--apply` 的只读巡检、把
   结果贴到总线，等人类或 coord-main 明确说"可以"再执行——跟合并权、
   registry.yaml 的 schema 变更同一个审批级别。这条是 2026-07-07 的真实教训：
   一次基于"worktree 目录已不存在"这条本身可靠的判定标准，未经请示就直接跑了
   `--apply`，即使结果本身没错，这个执行顺序本身不该发生。见 ADR-007
   （`docs/adr/ADR-007-docker-stack-teardown.md`）。
9. **review 判定锚定 SHA + 审计链用 doctor 机器判（2026-07-10 起，ADR-012）**：
   Block/Accept 结论必须写明审的是哪个 commit（`审于 <sha>`）；对"已修复"声明复查
   前必须先 `git fetch` 确认审的是分支头——p23（#517）三轮 Block 里有两轮是基于
   stale fetch 重复指控已修复的问题。证据链核查（evidence 非空/含 exit 0/派生视图
   一致）不再人肉逐字节验，跑 `pnpm harness doctor --phase NN`；引用派生视图时用
   **列名**不用列序号。仓库侧审计对象以 git 树为准——gitignored 的本地派生文件
   （active-features.json）不是审计对象，in-repo 的 PROGRESS.md 才是。

10. **统一时钟 + loop 纪律（2026-07-16 起，ADR-014）**：协调决策一律以
   coord-service `GET /time` 为准（现在几点/当前哪个周期/租约还新鲜吗），**不信本机
   `date`**——机器时钟漂移会让你误判租约新鲜度与周期边界，`harness tick` 会在漂移
   >60s 时告警。**每个层级都必须有 loop**：coord-main 5 分钟、module-coordinator
   15 分钟、sub-agent/worker 15 分钟，每个 loop 跑 `pnpm harness tick`（权威时钟+
   漂移检测+续租约+收件箱一条命令做完）。loop 是操作节拍，C-cycle（3h）是汇报节拍
   ——只有后者没有前者，就是"coord-architecture 租约静默过期 8 小时"的成因。
   席位按 ttl 正常过期是**诚实信号**，不得调大 ttl 或替人代跑心跳来掩盖失联。

11. **协调权威（coord-service）绝不手动部署（2026-07-17 起）**：coord-service 有了
   CD（deploy-coord-service.yml）——改它的代码一律走 PR 合 main 触发自动部署，
   **不再 `wrangler deploy`**。手动部署会 last-write-wins 互相覆盖（#629 覆盖 #614
   的 tasks 路由、线上收件箱静默消失，andon #272/#290）。CD 冒烟带部署漂移探针
   （/time 存在 + /tasks 返 401 而非 404），漂移当场红。这条对 devportal/devapp
   同理——**有 CD 的目标不手动部署**，把"从哪个 checkout 部署"的竞争彻底消灭。

## 事故分诊速查（来自实战）
- CI 秒级失败 + steps 空 → 账单/runner，非代码（2026-07-04 账单事故）。
- evidence 指针存在但文件不在 git 树 → 假 passing（PR #310/#311/#312 三连）。
- 迁移回填用自然键（name）匹配 → 用户数据混入风险（PR #312 初版）。
- 无 node_modules 的 worktree push 失败（turbo not found）→ 先在该 worktree 跑
  `pnpm install`（pnpm store 命中缓存通常几秒到十几秒），而不是用 `--no-verify` 绕过；
  纯文档改动如确有必要跳过，需人类明确同意（ADR-005 后果段）。
- 共享主 checkout 被并发会话 `reset`/`stash`/`branch -f` 踩踏，分支 commit 无声消失
  （2026-07-03/04 夜间两起：Board agent stash 误伤、AVA 分支 ref 一度被重置）
  → 见 ADR-005；发现即用 `git reflog` 定位恢复，之后确认该分支已 push 到 origin。
- 两个 PR 各自 mergeable（无文本冲突）、合并后语义冲突（同文件不同位置重复声明同名
  变量）导致 main typecheck 红（2026-07-07：PR #415 与 #417 各自给
  `board-canvas.tsx` 声明 `itemsRef`，hotfix #427 收场）→ 见上方 L1"合并队列"热点
  文件额外一步；发现 main 红，先看是不是这类连带影响（rebase 到修复后的 main 重跑
  即可，不是自己代码的问题），不要盲目排查自己 PR。

## 生命周期（启动/退位/抢占）
coordinator 是**单例角色**，由会话通过启动仪式认领，不是常驻 subagent。
完整仪式见 `.agents/skills/coordinator/SKILL.md`（唯一性握手 → 认领广播 → 冷启动读总线 →
挂监控 → SOP 循环）。要点（**2026-07-08 起按 ADR-009 切换到 coord-service**）：
- **唯一性来源**：D1 的 `role:coord-main` claim（`pnpm harness lock-acquire --session
  <id>`，需要 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 凭据）。认领是服务端
  `uq_active_claim` 唯一索引上的原子 INSERT——两个会话抢，恰好一个成功。
  ~~label 为 `coordination:lease` 的专用 issue + heartbeat 评论~~ 已退役，存量
  issue 保留为历史记录。
- **心跳**：每个 L2 tick 跑 `pnpm harness lock-acquire --session <id>`（acquire-or-renew
  语义：自己持有则续约，空缺/过期则重新认领，2026-07-08 定稿）。新鲜度由服务端
  sweeper 按 ttl（6h）裁定——**tick 节奏撑不过 ttl 时租约正常过期，席位间歇性空缺
  是诚实信号不是故障**（会话没在 tick = 没在履职），下个 tick 自愈；不要为了席位
  显示连续而调大 ttl 或代跑别人的心跳（人类裁定，2026-07-08）。
- **抢占**：`lock-status` 显示权威持有者与心跳年龄；持有者心跳过期后 acquire 即可
  接任（sweeper 已回收）或 `--force`（人类授权仪式）。冲突以 D1 claim 为准。
- **退位**：`pnpm harness lock-release` + 交接要点写进总线（issue 评论仍是人类可读
  叙述层）——租约状态在 D1，叙述在总线，都不在会话记忆里。

## 二级架构:module-coordinator(2026-07-04 起)

当模块工作量足够大时,coord-main 可以把某个领域拆给一个 module-coordinator(见
`.agents/skills/module-coordinator/SKILL.md` 与 registry.yaml 的 `kind: module-coordinator`
条目)。规则:
- module-coordinator 只在自己 areas 范围内分派+初审+返工裁决,**没有合并权**。
- 全绿 PR 转交 coord-main 做最终合并——保留"合并唯一把关人"不变量,只是把分派/审查
  的日常负担下放,避免 coord-main 成为唯一瓶颈。
- 跨模块热点文件冲突由 coord-main 仲裁顺序,module-coordinator 不擅自抢改。
- 当前已划分模块(见 registry.yaml):Room、Board & Canvas、Collaboration、AVA/AI、
  AI Store & Admin、Survey、Platform/Accounts。p16/p17 类横切质量扫荡任务不设常驻
  module-coordinator,由 coord-main 按需拆给对应模块。
