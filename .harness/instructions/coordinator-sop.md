# Coordinator SOP — 分层监控循环（v1）

> `multi-agent-coordination.md` §2 定义了 coordinator 单轮循环"做什么"（ADR-004 §4 确立 coordinator 角色）；本文定义"什么节奏做、每层必查什么"。
> 目标：事件驱动为主、定期扫描兜底，任何一层漏掉的问题都会被更大的循环接住。

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
2. **review 在途**：调起 >15min 未回的 reviewer agent 是否还活着，死了重派。
3. **分派补给**：有空闲 worker 且存在 `status:ready-for-dev` ∩ 依赖全绿 ∩ 与在途 PR 无同文件热点 → 分派（认领双写：`harness claim` + label）。

### L2 全局层（~15min）
1. **lease/deadline 巡检**：按下方"Deadline 与分级补救"表逐项检查，触发即执行对应 tier 动作（不止 worker lease，还包括 changes-requested 停滞、review 未派、CI 卡住等）。
2. **漂移巡检**：抽查 label 与事实一致性——`review:*-ok` 是否都有对应 reviewer 产出记录（评论）；有无非 coordinator 编排的 verdict label（出现即摘除并留言，见"verdict 权威"）。
3. **阻塞升级**：`status:blocked` 超过 1 个 L2 周期无进展 → 评论 + 通知人类。
4. **基础设施健康**：CI 是否整体可用（账单/runner）；不可用时在追踪评论里刷新状态。
5. **背景任务盘点**：自己派出的 reviewer/verifier agent、监控任务有无僵死；scratchpad worktree 有无该清理的。

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

## 铁律（任何层都不可违反）
1. **verdict 权威**：`review:*-ok` 只能由 coordinator 编排的 reviewer 产出。发现来路不明的 verdict → 摘除 + 留言，以可核验事实（git ls-tree、命令退出码）重裁。
2. **coordinator 唯一**：唯一性由 `coordination:lease` issue 的心跳裁定（见下方生命周期章节）；接管协调前先向存量协调会话广播；双 coordinator 结论冲突时，以可核验事实为准，并立即收敛为单 coordinator。
3. **合并独占**：只有 coordinator 执行合并；review 全绿 + CI 绿 + up-to-date 缺一不可（CI 因基础设施不可用时，合并冻结并升级人类，不得以"本地验过"绕行）。
4. **证据实测**：任何"已验证/已入库"声称都用 `git ls-tree` / `git show` / 退出码实测，不信任 diff 注释、progress 叙述或打分。
5. **共享主 checkout 隔离**：任何要落地写文件/提交的会话（含 coordinator 自己）一律
   `git worktree add` 开独立工作区，不在共享主 checkout 上 `commit`/`stash`/`reset`/
   `branch -f`/`checkout <branch>`；分支建好立即 push。见 ADR-005
   （`phases/phase-01-foundation/adr/ADR-005-shared-checkout-isolation.md`），本地另有
   `reference-transaction` git hook 兜底拦截非快进更新。
6. **不可静默等待**：发现 lease/PR 停滞（见上方 Deadline 表）时，必须在总线上贴出带
   明确时限的通牒，再据此回收/升级——不能只是内部判断"再等等"或"已经提醒过了"就不再
   跟进。这条对 coord-main 和全体 module-coordinator 一视同仁，没有"层级更高就可以裸等"
   这回事（人类反馈直接触发，2026-07-07）。
6. **coord-service 是 opt-in 增强，不是新权威**：`COORD_SERVICE_URL`/
   `COORD_SERVICE_TOKEN` 未配置时，`lock-*`/`module-lock-*` 行为与 coord-service
   出现之前逐字一致；配置了才会额外问一次 D1、失败一律静默降级——GitHub
   issue+label（module-coordinator 侧）和本地文件锁（顶层 coordinator 侧）依然是
   默认权威。见 ADR-006（`phases/phase-01-foundation/adr/ADR-006-coord-service-d1-gating.md`）。

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

## 生命周期（启动/退位/抢占）
coordinator 是**单例角色**，由会话通过启动仪式认领，不是常驻 subagent。
完整仪式见 `.agents/skills/coordinator/SKILL.md`（唯一性握手 → 认领广播 → 冷启动读总线 →
挂监控 → SOP 循环）。要点：
- **唯一性来源**：label 为 `coordination:lease` 的专用 issue；heartbeat（每个 L2 tick 一条评论）
  < 30 分钟视为在任，禁止第二个 coordinator 启动。
- **抢占**：heartbeat 过期后任何会话可 takeover；冲突以 lease issue 最新合法 claim 为准。
- **退位**：release 评论 + 交接要点写进 lease issue，状态永远在总线上，不在会话记忆里。
- 顶层 coordinator 的本地文件锁（`pnpm harness lock-*`）如果配置了 coord-service
  环境变量，`lock-acquire` 会先问 D1 有没有人已经占着（见 ADR-006）；未配置则
  完全不受影响。

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
