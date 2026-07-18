# ADR-014: 统一时钟与分级 loop 纪律

- 状态：Accepted（人类拍板 2026-07-16：每个 agent 需要知道时间、用统一时钟协调；
- 适用层：方法论（可移植：随模板打包）
  main/module/sub 各级都要有合适的 loop 策略与 SOP）
- 日期：2026-07-16
- 作者：coord-architecture
- 关联：ADR-009（D1 是协调权威）、ADR-010（三级组织 + 3h C-cycle）、ADR-012（能机器判定的绝不交给人肉）、#594（任务收件箱）

## 背景：两个真实失效

**1. 没有统一时钟。** 每个 agent 用自己机器的 `Date.now()`：`cycle-report.ts` 本地算
周期边界，各会话本地判断"我的租约还新鲜吗"、"这个 PR 等了多久"。机器时钟一漂，
**全队对"现在几点、当前哪个周期"没有共识**——租约新鲜度误判、周期边界各算各的、
deadline 争议无法裁定。协调权威（D1）明明有一个确定的时钟，却没人读它。

**2. 没有操作 loop，只有汇报节拍。** ADR-010 定了 3h C-cycle（汇报），但没定
**每个 agent 每隔多久该醒一次、醒来做什么**。后果是真实的：coord-architecture
自己的协调租约在 p23 集成期间**静默过期 8 小时**——续约全靠"会话想起来做"；
任务收件箱（#594）定了 ≤15min 轮询，但没有一条命令把"续约+收件箱+时钟"合起来，
于是每个 agent 各自实现、各自漏项。

两个失效同源：**把机械纪律交给了记性**（ADR-012 同款教训的时间版）。

## 决策

### D1. coord-service 是全队唯一权威时钟

新增 **`GET /time`**（公开只读，同 `/status`，任何 runtime 免 token 可读）：

```json
{ "now": "2026-07-16T07:25:26.492Z", "epoch_ms": 1784186726492,
  "cycle": { "id": "2026-07-16T06Z", "started_at": "...", "ends_at": "...",
             "remaining_seconds": 5674, "elapsed_seconds": 5126 } }
```

- **C-cycle 计算集中到 `packages/coord-service/src/lib/cycle.ts`**（唯一实现，5 个
  单测锁定锚点/id 稳定性/边界自洽）。cycle id = 起始时刻紧凑 ISO（`2026-07-16T06Z`）
  ——全队用同一字符串指代同一周期。
- **铁律：协调决策一律以 `/time` 为准，不信本地 `date`。** 本地时钟只用于本地日志。
- 权威联系不上时 **fail-closed**：不按本地时钟硬猜（同 ADR-009 的 acquire 语义）。

### D2. `pnpm harness tick` —— 每个 loop 的唯一一条命令

一条命令做完一个 loop 该做的四件事，**任何 runtime 都能在自己的循环里调**：

1. 读权威时钟 → 当前周期 id / 还剩多久（决定何时发 cycle-result）
2. **时钟漂移检测**：本地与权威相差 >60s 直接告警（你按错误时间协调会误判租约）
3. **续自己的租约**（acquire-or-renew）——防静默过期
4. **拉任务收件箱**（#594）——有 pending 就打印 ack 命令

`--json` 供脚本/非 CC runtime 消费。tick 本身不是门控（退出码 0），它是**行动清单**。

### D3. 分级 loop 策略（各级节奏不同，但都必须有 loop）

| 层级 | tick 周期 | 每 tick 做什么 | C-cycle（3h）边界 |
|---|---|---|---|
| **coord-main** | **5 分钟** | tick + 合并队列（CI 绿的 PR 立即合）+ andon/停线 + review 积压升级 | 发 cycle-plan/result；巡检 flow-time 与各模块健康 |
| **module-coordinator** | **15 分钟** | tick + 本模块收件箱/PR 队列 + 首轮 review + 派子 agent | 发 cycle-plan/result；**模块 skill 经验回流补漏** |
| **sub-agent / worker** | **15 分钟** | tick + pending 任务 ack + 当前 feature 推进 | 向父 coordinator 汇报 done/miss + 阻塞 |

- **节奏依据**：coord-main 是全队瓶颈（合并权独占），loop 越紧 flow-time 越低——
  实测 review 积压曾把 flow-time 推到 16.5h（基线 1.8h，+817%）；module/sub 的活是
  小时级的，15min 足够且不浪费。
- **loop ≠ C-cycle**：loop 是操作节拍（分钟级），C-cycle 是汇报/度量节拍（3h）。
  此前只有后者，是"8 小时租约静默过期"的直接原因。
- **实现随 runtime**：CC 用 `/loop` 或 Monitor，Codex 用其等价物，裸脚本 cron 也行
  ——契约只规定节奏与 tick，不绑任何私有通道（同 #594 的平台中立原则）。

### D4. 席位空缺是诚实信号，不是要掩盖的故障

tick 发现自己无租约 → 提示 acquire；租约按 ttl 正常过期 → dashboard 诚实显示空缺，
下个活跃 tick 自愈。**不得**为了"看起来连续"调大 ttl 或替别人代跑心跳——那是掩盖
失联（ADR-010 防断链不变量）。

## 后果

- "现在几点/哪个周期/租约还新不新鲜"全队有唯一答案，时钟漂移从静默误判变成显式告警。
- 每个 agent 的 loop 从"各自实现、各自漏项"变成一条 `harness tick`。
- 代价：每个 loop 多一次 HTTP（`/time` 公开只读、无库读，成本可忽略）。
- **首次 live 运行即抓到真问题**：coord-architecture 的租约当时又是缺失状态——
  证明这个工具要防的失效是常态而非偶发。

## 经验教训

1. **有"汇报节拍"不等于有"操作节拍"**——3h 汇报周期骗了我们很久，实际每小时都在
   发生的续约/收件箱/时钟对齐，没有任何节拍托底。
2. **权威已经存在，只是没人读**：D1 一直有确定的时钟，各 agent 却各用各的 `date`。
   建立权威 ≠ 使用权威，中间差一条"必须读它"的铁律 + 一条让读它变容易的命令。
3. 同 ADR-012：**能机械化的纪律，绝不交给记性**。
