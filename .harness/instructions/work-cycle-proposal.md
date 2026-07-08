# 工作周期（Work Cycle）提案 — 3 小时节拍 + 精益协作

> status: Proposed
> 作者：coord-main（应用户 2026-07-08 直接要求：把 agent 群当成一个团队、用精益思想管理，
> 以 ~3 小时为一个工作周期节拍）；实现者：architecture-coordinator。
> 背景动机：用户明确反馈当前协作"太慢、性能低"。本提案的唯一目标是**缩短流动时间**
> （PR 从开出到合并的时间），不是增加仪式。任何一条如果实践中反而拖慢速度，就砍掉。

## 1. 诊断：慢在哪里（真实数据，2026-07-06 ~ 07-08）

对着实际发生的事看，延迟几乎全部来自**等待**，不是工作本身：

| 浪费类型（muda） | 实例 | 损失 |
|---|---|---|
| 等待（最大头） | #406 从开出到合并 ~3 天，其中 42h+ 是"零响应等待"；#415/#416 开出 24h 无人 review | 天级 |
| 返工 | #406 四轮 review、#433 两轮、#437 一轮打回——多数返工原因是"没对着最新 main 验证" | 每轮 2-10h |
| 库存积压 | stale 分支越放越难合（#422/#425 放一天后 CONFLICTING，解决成本上升） | 小时级 |
| 无效动作 | 状态轮询靠人肉 15 分钟 tick 逐个查；同一问题（双状态标签）反复手工修 | 分钟级但高频 |
| 系统性缺陷 | 热点文件(board-canvas.tsx)三次合并碰撞,两次打挂/差点打挂 main | 每次 1-3h 修复 |

结论：提速的关键是**把等待压掉**——让每件在制品在每个周期内都必须"动一下"，动不了就立刻处理（接管/降级/明确搁置），绝不静默滞留。

## 2. 方案：C-cycle（3 小时工作周期）叠加在现有 L0/L1/L2 之上

现有三层循环（coordinator-sop.md：L0 事件 60s / L1 队列 5min / L2 全局 15min）**不动**，
它们是"神经反射"。新增一层 **C-cycle（~3 小时）作为"团队节拍"**——类比精益的 takt time：

### 周期开始（cycle-start，10 分钟内完成）
每个在任 coordinator（coord-main + 各 module-coordinator）在**专用的
`[coordination] work-cycle` issue**（单一 issue，所有 coordinator 共用，比散在各处
更好聚合；ADR-009 起 lease issue 已退役为历史记录，不再读写——cycle-plan/result 是
叙述层内容，按 ADR-009 的信道分层发在叙述总线上）发一条 `cycle-plan` 评论，
格式固定（机器可解析）：
```
cycle-plan cycle:<UTC起始时刻> by:<id>
commit: <本周期承诺完成的 1-3 件事，小批量，宁少勿多>
carry: <上周期未完成滚入的>
blocked: <需要别人/人类解锁的，@到人>
```
**精益原则：小批量承诺**。承诺的是"本周期内可验证完成"的事，不是愿望清单。
没东西可承诺就写 `commit: none（原因）`——诚实的空比虚假的满好。

### 周期中
- 正常干活，L0/L1/L2 照旧。
- **WIP 上限（pull 而非 push）**：每个 module 同时 `in_progress` 的 feature ≤ 2
  （现有"每 owner 一个 in_progress"的 harness 硬约束不变，这是 module 维度的补充上限）。
  上限满了就先把手上的推到 in-review/merged，再拉新的——压库存，保流动。
- **Andon（拉绳停线）**：main 被打挂（typecheck/verify 红）= 全线最高优先事件，
  coord-main 在 #323 发 `andon-stop` 评论，所有人暂停 rebase/merge 到 main，修好后发
  `andon-clear`。今天 itemsRef 事故的教训：没有停线信号时，坏 main 会连带污染无辜 PR 的 CI。

### 周期结束（cycle-end，与下一周期的 cycle-plan 合并成一条也行）
每个 coordinator 发 `cycle-result`：
```
cycle-result cycle:<UTC起始时刻> by:<id>
done: <真完成的（有 merge/verify 证据）>
miss: <承诺了没完成的 + 一句原因>
flow: <本周期自己域内 PR 的 开出→合并 平均时长（粗略即可）>
```
coord-main 汇总成一条全局 cycle-report 发 #323：全仓 done/miss、当前 flow time、
下周期的全局优先级（1-3 条）。**这就是"团队站会"，异步、书面、10 分钟内完成。**

### 周期内的 SLA（把等待变成违约，可检测、可升级）
| 事项 | SLA | 超时动作（自动升级，不再临场判断） |
|---|---|---|
| 新 PR 开出 → 首次 review 结论 | 同周期内（≤3h） | coord-main 直接派 reviewer，不等 module-coordinator |
| CHANGES → 返工 push | 1 个周期 | 下个周期 cycle-plan 里必须出现，否则回收 |
| `in_progress` 无任何可见进展 | 1 个周期 | worker 对 `issue:<n>` claim 时传 `ttl_seconds=10800`（3h），由 coord-service 服务端 sweeper 机械回收——不需要人巡检判断（比人肉通牒更精益，消除的正是"无效动作"浪费）。通牒（15-30 分钟窗口）只留给有争议的场景（如 worker 声称在做但 D1 无心跳） |
| blocked 挂起 | 1 个周期 | 升级人类 或 明确降级为"搁置"（写明复活条件） |
| 低风险 PR（纯文档/元数据/gate-only）| review+merge ≤ 30 分钟 | coord-main 直接快速核验合并，不派 subagent |

### 热点文件协作规约（消除今天最大的返工来源）
- `.harness/state/hotspots.md` 维护一个热点文件清单（当前：`board-canvas.tsx`、
  `rooms/[id]/members/page.tsx`、`.harness/state/PROGRESS.md`）。
- 动热点文件的 PR，在 cycle-plan 里必须申报；同周期两个 PR 申报同一热点 → coord-main
  排序，后者等前者合并后 rebase 再提。
- 合并热点文件 PR 前，本地 merge main + typecheck（SOP #429 已有，纳入周期检查）。

## 3. 明确不做的（避免精益变官僚）

- **不做同步会议/实时站会**——一切异步书面，评论即会议。
- **不做故事点/估算**——承诺"周期内完成"是二元的，不搞估算游戏。
- **不做新的常驻服务**——cycle-plan/result 就是 work-cycle issue（#452）上的评论，复用现有总线。
  唯一可选的新工具是一个聚合脚本（见 §4），没有它人肉也能跑。
- **不改变现有权威结构**——合并权仍 coord-main 独占，feature 状态仍 harness verify 门控。

## 4. 请 architecture-coordinator 实现的部分

1. **SOP 整合**：把本提案的 C-cycle 章节合入 `coordinator-sop.md`（新章节，L0/L1/L2 之后），
   `module-coordinator/SKILL.md` 加对应义务（cycle-plan/result 的格式与时机）。
2. **`pnpm harness cycle-report`（可选但值得）**：数据源三路（ADR-009 对齐）：
   (a) 单一 work-cycle issue 的 cycle-plan/result 评论；(b) `gh pr list` 的
   createdAt/mergedAt（flow time）；(c) coord-service `GET /status` 的 active_claims
   （谁持有什么、心跳年龄——SLA 表"in_progress 无进展"检测的权威数据，比翻评论准）。
   输出一张"当前周期健康表"（谁承诺了什么/什么超 SLA/flow time 趋势）。dry-run 只读，
   无 --apply 概念。可以挂进 coordination dashboard（#428/#447 已上线两片）作为后续卡片。
3. **`.harness/state/hotspots.md`**：初始化热点清单（上面三个文件起步）。
4. **cycle 时钟的锚定**：建议锚定 UTC 整点（00/03/06/09/12/15/18/21），不搞相对时钟，
   所有会话无状态可推算当前 cycle id。

## 5. 试运行与退出标准

- 先跑 **3 个周期（~9 小时）**试运行，之后 coord-main 汇报给用户：flow time 是否真的降了。
  **起算点：coord-service 凭据换轨完成之后**（ADR-009 激活门槛）——SLA 表依赖 D1
  active_claims 作为"in_progress 无进展"的权威数据源，凭据没发完之前这个数据源是空的。
- 唯一成功指标：**PR 开出→合并 的中位时长下降**。仪式遵守率不是指标。
- 如果试运行后 flow time 没降，砍掉 cycle-plan/result 仪式，只保留 SLA 表和 Andon（这两条
  即使没有周期概念也独立有效）。
