# Loop 设计八原则 — coordinator 自动派发循环

> 归纳自 `.harness/state/coordinator-loop-brief.md`（下称 loop-brief）与本目录
> `coordinator-sop.md` 的既有教训——**只做归纳，不造新规**。每条原则的权威出处见
> 条目末尾括号；本文与出处原文冲突时，以出处为准。
> 适用对象：任何实现、修改或执行 coordinator 自动循环（`/loop` 定时唤醒、事件驱动
> tick、cron 派发任务）的会话。

## 1. 拿锁才调度
每次唤醒第一步 `pnpm harness lock-acquire`；拿不到锁（有其它 session 活跃）就只做
只读巡检后退出，不派发、不 push，等下一次唤醒再试。多个 loop 会话互不知情地同时
调度，吃过互相冲突、重复派发的亏（main 上莫名多出没人派发过的 PR）。
（loop-brief §0 末条 + 步骤 0；唯一性权威见 `coordinator-sop.md` 铁律 2/7，ADR-009。）

## 2. 事件驱动为主、扫描兜底
L0 事件层有变化才动作；L1/L2/C 各层定期扫描逐层嵌套兜底——任何一层漏掉的问题都会
被更大的循环接住。不靠单一轮询节奏扛所有职责，也不假设事件流零丢失。
（`coordinator-sop.md` 开篇目标句 + 「三层循环」/「C-cycle」章。）

## 3. 一次性授权不写进自动化策略
用户当场说的「不要干等」「这次可以直接做」是当场一次性的授权，不能固化成写死的
循环策略；每次遇到同类情况都要按当时实际情况重新判断，最新、最明确的指令覆盖
早前的经验性结论。
（loop-brief §0 标题原文及「不再自己合并任何 PR」条。）

## 4. 汇报而非代劳
worker 卡在需要人类亲口确认的关口（如 verify:full 失败后是否 `--no-verify`）时，
它的安全策略只认它自己会话里用户的原话——coordinator 转达、代劳都不算数，也不该
尝试任何形式的绕过。正确动作是如实记录：谁卡住了、原因是什么、证据在哪，然后
继续推进其它可推进的线，留人类醒来一次性看汇报处理。
（loop-brief §0「worker 卡在……」条。）

## 5. 不可静默等待
发现 lease/PR 停滞，必须在总线上贴出**带明确时限的通牒**，到期按「Deadline 与分级
补救」表机械执行 Tier 2/3 动作；「内部注意到了」「已经提醒过了」不算跟进。本条对
coord-main 和全体 module-coordinator 一视同仁。
（`coordinator-sop.md` 铁律 6 + 「Deadline 与分级补救」表。）

## 6. 分支短命
coordinator 开的分支写完即 push + 开 PR（base 永远直指 `main`），合并后即废弃；
不留长期存活、混多个 feature 的中间整合分支，不让 worker 反复 merge 累积几层历史。
先例：`harness/coord-dispatch-wave2-admin-payment` 整合分支把 payment engine
尚未修复安全漏洞的旧版本带上了 main，靠热修复收场。
（loop-brief §0.5。）

## 7. 状态视图脚本生成、不手写
依赖图、active-features 等状态视图一律由脚本从权威源实时生成（如
`pnpm harness dep-graph`），文档里不维护手写快照——loop-brief 曾内嵌一份手写依赖图，
多次被发现记的是几天前的状态（写着「待 review」时其实早就 passing），误导下一次
唤醒的判断，后改为脚本生成。派生视图禁止手改同理（AGENTS.md 硬约束）。
（loop-brief「依赖图」章；AGENTS.md「功能清单是权威」条。）

## 8. 破坏性动作永远在 loop 之外
合并 PR、`sweep-docker --apply`、`--force` 抢占等破坏性/不可逆操作不进自动循环——
loop 只推进到「就绪待授权」，把清单列进汇报（「PR #N 已 review 通过，需要人工点
一下」），等人类或 coord-main 明确授权后在 loop 之外执行。判定标准本身可靠也不
豁免：错的是未经授权执行这个顺序，不是结果。
（loop-brief §0 前两条 + 步骤 8；`coordinator-sop.md` 铁律 3/8，ADR-007。）
