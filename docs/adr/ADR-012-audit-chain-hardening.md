# ADR-012: 审计链加固——p23 三轮 Block 复盘与全仓证据欠债治理

- 状态：Proposed
- 适用层：方法论（可移植：随模板打包）
- 日期：2026-07-10
- 作者：coord-architecture
- 关联：ADR-001（单一 in_progress）、ADR-010（组织模型/性能周期）、PR #517（事故现场）

## 背景：p23 交付连续三轮被 Block，代码本身全程无返工

p23（Developer Portal）9 个 feature 的代码质量在独立 review 中全部过关（API 鉴权/
降级/spec 断言/UIUX token/单测），但 PR #517 连续三轮被 coord-main Block。逐轮拆解：

| 轮次 | 指控 | 核实结果 | 消耗 |
|---|---|---|---|
| 1 | 9 个 passing 零 evidence 日志、evidence 是裸时间戳、PROGRESS/roadmap 派生视图与 feature_list 矛盾 | **全部属实** | 一轮 review |
| 2 | evidence 是 9 个 0 字节空文件、派生视图矛盾原封不动 | **不属实**——reviewer 读的是旧 fetch（修复已在 30 分钟前推送）；另把 PROGRESS 表格列序读反（第 4 列是 not_started 不是 passing） | 一轮 review + 两轮往返申辩 |
| 3 | 只剩 PROGRESS 还是 0 passing | **不属实**——同样是 stale fetch；另把 gitignored 的本地派生视图（active-features.json）当成了仓库侧审计对象 | 一轮往返 |

第 1 轮的指控成立，其根因是 **verify.ts 的双模式陷阱**：`--phase/--feature` 模式
真实执行全部 verification 命令并门控翻转 passing（门控本身没被绕过），但**证据落盘
与派生视图刷新只在 `--sprint` 模式触发**（`if (sprintId)` 分支）。于是产生一种
危险状态：**门控真实通过了，审计链却完全断裂**——从外部看与"手改 passing 造假"
不可区分。reviewer 按"没有证据=没有完成"判 Block 是完全正确的。

第 2、3 轮暴露的是另一类失效：**review 判定没有锚定 commit SHA**。指控、修复、
复查三方各自基于不同时刻的快照，同一个"0 字节"指控在修复推送后仍被重复发出，
双方消耗了三轮往返才收敛。

## doctor 首跑揭示：这不是 p23 的个别失误，是全仓系统性欠债

为防再犯而写的 `pnpm harness doctor` 对全部 25 个 phase 首跑结果：**85 FAIL / 15 WARN**。
断裂形态分布（都是 p23 同款）：

- **evidence 指向不存在的文件**（p10/p11/p12/p13/p14/p15/p17/p20 …）：约 70+ 条
  ——feature_list 里写着 `evidence/Fxx.verify.log @ …`，但对应文件从未提交。
- **日志存在但没有任何 `[exit 0]`**（p9/p13/p15/p22）：日志是手写摘要而非命令输出。
- **裸时间戳 evidence**（p14 F04 等）：`--phase` 模式的直接产物。
- **roadmap 阶段状态漂移**（p8/p16/p17/p18/p20/p21/p22 全部 not_started 却有大量
  passing）：阶段状态纯手工维护、无人对齐。

结论：p23 只是**第一次被 reviewer 逐字节核查的 phase**。此前所有 phase 的
"passing"证据链在同等标准下大多不成立。这是过程/工具问题，不是某个 agent 的
纪律问题——工具允许的路径必然会被走到。

## 决策

### D1. 审计链完整性成为机器判定，不再依赖 reviewer 人肉核查

新增 `pnpm harness doctor [--phase NN]`（`.harness/scripts/doctor.ts`），逐 phase 判定：

1. 每个 passing feature：evidence 指向真实存在、非空、含 `[exit 0]` 的日志文件；
   裸时间戳 / 空文件 / 断链 = FAIL。
2. passing 却 `sprint: null` = FAIL（`--sprint` 门控永远覆盖不到它，p23 F09 踩过）。
3. PROGRESS.md 派生行与 feature_list 实时计数逐列比对，矛盾 = FAIL。
4. roadmap 阶段状态与实际进度粗对齐（漂移 = WARN）。
5. 多 agent 阶段无 owner 的 in_progress（认领断档，p23 F04/F08 形态）= WARN。

### D2. pre-push 钩子按"触碰的 phase"接入 doctor

push 改到 `phases/<phase>/**` 的分支，先过该 phase 的 doctor。**新的断裂进不了
origin**；历史欠债不阻塞无关工作（见 D4）。逃生门与既有惯例一致（`--no-verify`），
但 reviewer 会用同一标准复查，绕过没有意义。

### D3. review 判定必须锚定 SHA（流程规则，写入 coordinator SOP）

- Block/Accept 结论必须写明**审的是哪个 commit**（`审于 <sha>`）。
- 对"已修复"声明复查前必须 `git fetch` 并确认审的是分支头。
- 指控派生视图矛盾时，引用**列名**而非列序号（本次列序误读消耗了两轮）。
- 仓库侧审计对象以 git 树为准：gitignored 的本地派生文件（active-features.json）
  不是审计对象；in-repo 派生视图（PROGRESS.md）才是。

### D4. 存量 85 FAIL 的治理：按 phase 分治，backfill 而非豁免

- 修复路径已存在：`pnpm harness verify --sprint <phase>/<MM> --backfill-evidence`
  （PR #517 引入）——对已 passing feature 重跑全部 verification 命令、落真实日志、
  不碰 status；重跑失败会如实标注 `[BACKFILL: 重跑未通过]` 交人工核实。
- 归属：各 phase 的 module coordinator 各自还债（无主 phase 由 coord-main 指派）；
  roadmap 漂移由 coord-main 统一对齐一次。
- **不做全局豁免名单**：欠债 phase 在被再次触碰时自然被 D2 钩子拦住，谁触碰谁先还。

### D5. verify.ts `--phase` 模式禁止翻转 passing（跟进项，落在 #517 合并后）

根因修复：`--phase/--feature` 模式保留"跑一遍看结果"的调试用途，但**不再允许把
status 翻成 passing**（翻转必须走 `--sprint`，因为只有它落证据+刷派生视图）。
不随本 ADR 落地是为避免与 #517 的 verify.ts 变更冲突。

## 后果

- reviewer 的"逐字节验证"从人肉动作变成 `pnpm harness doctor --phase NN` 一条命令，
  review 焦点回到代码本身。
- "门控通过但审计链断裂"这个状态从此不可能静默进入 origin。
- 代价：触碰欠债 phase 的第一个 push 会被拦住先还债（一次 backfill，通常几分钟）。
- 诚实的副作用：backfill 重跑可能暴露某些历史 passing 实际已经跑不过（回归或
  当初就没跑过）——这正是目的：**宁可暴露假 passing，不可让它继续冒充真的**。

## 经验教训（供后续 SOP 迭代引用）

1. **工具允许的路径必然被走到**：verify 双模式中有一条产出不完整审计的合法路径，
   于是全仓 25 个 phase 里它成了主流路径。修工具，不要只教育使用者。
2. **派生视图必须由同一条命令原子刷新**：feature_list（源）与 PROGRESS（派生）
   分两步维护就一定会漂移——漂移后从外部无法区分"忘了刷"和"造假"。
3. **review 与修复必须共享同一个快照锚点**：没有 SHA 锚定，双方会为"两个时刻的
   不同事实"反复争论（本次三轮里两轮属此类）。
4. **备援路径要提前存在**：事故发生时"补证据"没有合规路径，只能现场改门控工具
   （--backfill-evidence）并请求人类拍板——预设的修复通道能把响应时间从小时级
   降到分钟级。
5. **第一次严格审计必然大出血**：doctor 首跑 85 FAIL 不是 doctor 太严，是标准
   第一次被机器执行。以后每个新 phase 从第一天起就在钩子覆盖下，不会再积债。
