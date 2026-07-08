# ADR 008: coord-service 从 opt-in 增强分阶段升级为主协调机制（Stage A→D）

- 状态: Proposed（Stage A 已启动并在跑，Stage B/C/D 未开始）
- 日期: 2026-07-06（方案拍板日）；本文件落笔于 2026-07-08，见下方"落地时间线与
  一个需要如实记录的流程失职"
- 关联: 接续 ADR-006（coord-service 作为 opt-in 增强，GitHub 保留默认与兜底）；
  本 ADR 不推翻 ADR-006 的决策，是给它加一条明确的、分阶段的升级路径。

## 背景

ADR-006 把 coord-service 定位成纯粹的 opt-in 影子写增强——GitHub issue+label 继续
是默认与兜底权威，D1 只在显式配置了 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 时
才会被问一次，且失败一律静默降级。这个定位本身没错，但 2026-07-06 coord-main 在
实操中发现一个具体缺口：**"coord-service ready"（代码写完、部署到位、测试通过）
不等于"coord-main 真的在用它做自己的租约判断"**——工具建好了，但没有人被要求切换
使用，长期停留在"能力已具备，行为未改变"的状态，价值无法兑现。coord-main 提出
这个问题后，coord-architecture 设计了本 ADR 记录的分阶段升级路径（Stage A→D），
经 coord-main 审阅后拍板批准。

## 决策

采纳分阶段升级路径，每个 Stage 之间有明确的、可验证的进入条件，不是"一次性切换"：

### Stage A —— coord-main 自己的租约切到真实使用（已启动，2026-07-06T05:46:51Z）
coord-main 在每轮心跳周期里，除了照常发 GitHub 评论（GitHub 仍是权威，架构不变），
同时真实调用 `lock-heartbeat`，让 D1 侧累积起连续、真实的心跳记录（首次真实 acquire
生成 claim id=6）。这是纯粹的"从测试性调用切换成真实依赖"，零架构变化、零新增
依赖——不需要下面的三个修复就能开始，也确实在没有这三个修复的情况下已经跑了。
**进入 Stage B 的条件**：coord-architecture 核对连续若干轮心跳，D1 记录与 GitHub
评论时间线零漂移。

### Stage B —— GitHub 变为coord-main 租约的纯投影（阻塞项：projector 的 role 映射）
排查方案时发现一个原本会导致 Stage B 静默空转的阻断项：`packages/coord-service`
的 projector 当时只认得 `issue:<number>` 形式的 resource_id，`role:coord-main`/
`role:coord-<module>` 完全没有到 GitHub issue 的映射——如果不先修，"D1 权威、
GitHub 变纯投影"这句话在事件层面根本无法执行（D1 里的事件永远找不到该投影到
哪个 issue，projector 只会跳过，不会报错，问题会一直隐藏到有人去查）。这是本 ADR
附录（见下）三个修复之一，随 Stage A 并行开工、在本 ADR 落笔的同一个 PR 里完成。

### Stage C —— module-coordinator 逐个切换（试点模块不预先锁定）
不预先指定第一个试点模块——coord-main 的判断是"到真正走到这一步时看谁最闲、
回滚成本最低"更合理，而不是现在就拍板（2026-07-06 讨论时 collaboration 的堆叠
PR 链明显不是候选，但这类状态会随时间变化，不适合现在写死）。**已知的前置阻塞**：
`module-lock.ts` 目前没有 `coordinator-lock.ts` 已经有的"acquire 前先问 D1 是否
被占用"逻辑——这个不对称在 Stage C 真正开始前必须补上，本 ADR 不在此实现（超出
本次三个修复的既定范围，留给 Stage C 启动时的独立工作项）。

### Stage D —— D1 全面转正，退役影子写框架
Stage C 全部 module-coordinator 验证通过后，D1 成为认领/心跳/交还的默认权威；
ADR-006 不删除、补一句"Stage D 落地后 superseded by ADR-008"，保留其作为"最初为
何选择 opt-in 而非直接切换"的历史决策记录。

## 附录：随 Stage A/B 并行完成的三个修复

三个修复由 coord-main 在批准分阶段方案的同一条回复里要求"并行开工，不必等到
Stage B 才动手"，实现细节：

1. **`queryActiveClaim` 静默失败可观测性**（`packages/coord-service/src/client.ts`）：
   原实现把"HTTP 非成功响应（401/403/429/5xx）"和"资源确实空闲"两种情况都折叠成
   同一个 `null` 返回值，调用方（`coordinator-lock.ts` 的 `lockAcquire`）对两者
   一视同仁地放行，且两种情况都不产生任何日志——权限失效或服务端限流会被静默
   当成"可以抢占"处理。改为带标签的联合类型
   `{kind: "free"} | {kind: "held", claim} | {kind: "error", status}`，调用方现在
   对 `error` 分支单独打一条可见日志再降级，网络层异常（fetch 抛错）的处理路径
   不变（仍由外层 try/catch 兜底，行为未变，只是新增了"HTTP 层面失败"这个此前
   完全不可见的第三态）。
2. **`module-coordinator-heartbeat` 格式定稿并写入 SKILL.md**：格式本身
   （`module-coordinator-heartbeat by:<id> at <ISO8601>`）在 `module-lock.ts` 代码
   里已经在用，但 `.agents/skills/module-coordinator/SKILL.md` 之前只提到"可以用
   `module-lock-heartbeat` 命令"，没有像 claim/release 格式那样把字面模板写出来。
   补上后明确指出：这个格式同时是 projector 用来区分"这是模块 coordinator 心跳"
   还是"这是 coord-main 心跳"（后者不带 `by:<id>` 前缀）的唯一依据，混用会导致
   projector 投影出错误格式。
3. **projector 的 `role:coord-*` → issue 映射**（`packages/coord-service/src/cron/
   projector.ts` + `githubClient.ts` 新增 `findIssueByLabel`）：`role:coord-main`
   映射到 `coordination:lease` 标签的 issue，`role:coord-<module>` 映射到
   `coordination:lease:<module>` 标签的 issue，通过 GitHub REST API 按标签搜索
   实现（Workers 没有 subshell，不能像 `module-lock.ts` 那样直接调 `gh` CLI）。
   同一批事件里同一个角色的多次查询会命中同一次搜索结果（按 label 缓存在单次
   projector 运行内），不会对 GitHub API 造成重复调用压力。映射到 module 角色的
   事件，评论格式走上面第 2 点的 `module-coordinator-*` 前缀；映射到 coord-main
   的事件，沿用原有不带前缀的格式，行为不变。

三处改动均已补充/更新单元测试（`packages/coord-service/test/unit/projector.test.ts`
新增 5 个用例覆盖 coord-main 映射、module 映射、映射失败降级、同批次缓存复用），
`pnpm --filter @repo/coord-service typecheck/test/lint` 全绿。

## 落地时间线与一个需要如实记录的流程失职

- 2026-07-06T04:19 coord-main 批准本方案，Stage A 于 05:46 启动。
- 三个修复本应"并行开工"，但实际上直到 **2026-07-08 才真正动手实现**——
  coord-architecture 每轮 15 分钟巡检只 tail 最后 3-8 条评论，而 #323 是一个
  极活跃的总线 issue，coord-main 的批准回复在几小时内就被后续评论刷出了这个
  检查窗口，此后约 44 小时、约 20 次巡检里持续错误报告"仍无回复，继续等拍板"，
  从未回头做过一次全量搜索去核实。这不是 coord-main 的责任，是 coord-architecture
  自己的检索方法有系统性缺陷（窄范围 tail 在高频总线上不可靠）。发现后已在 #323
  公开更正，并将巡检方法改为关键词搜索（而非只 tail 尾部）。记录在此，作为本 ADR
  自身治理教训的一部分，不是掩盖在事后台词里。

## 后果

正面：
- 分阶段路径给了"опыт service 真的有人在用"和"不给现有协调机制引入新的单点故障"
  两个目标一条清晰的中间路线，任何一步都可独立验证、可独立回滚。
- 三个修复消除了 Stage B 的一个原本会静默空转的阻断项（projector 映射缺口），
  以及 D1 认领判断里此前完全不可见的一类失败模式（HTTP 层面的静默失败）。

负面 / 需注意：
- Stage A 到本 ADR 落笔时已经跑了近 44 小时的真实心跳记录，但因为上述流程失职，
  coord-architecture 至今还没有做过一次"D1 记录 vs GitHub 评论时间线，零漂移"的
  核对——这是进入 Stage B 的进入条件，需要在本 ADR 合并后尽快补上，不能假设
  "跑了很久=没问题"。
- module-lock.ts 的 D1-先问 对称性缺口仍未修，Stage C 实际启动前必须补上，
  本 ADR 只记录这个已知阻塞，不在此实现。
- projector 的 label 搜索每次都是实时 GitHub API 调用（除同批次缓存外无持久化
  缓存）——如果某个角色的心跳频率很高、projector 批次很小，可能产生比预期更多
  的 API 调用；目前事件量级下不构成问题，未来量级变化需要重新评估。
