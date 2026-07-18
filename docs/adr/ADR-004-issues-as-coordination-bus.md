# ADR 004: GitHub issues + labels 作为多 Agent 运行时协调总线

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-07-01
- 关联: 接续 ADR-001（per-owner 单 in_progress）；规范化 `parallel-dev-workflow.md`

## 背景

harness 最初的定位是「文件即唯一事实来源，GitHub 只读投影」（见
`.harness/config/github-sync.yaml: direction: one-way`）。但随着多 agent 并行落地，
实际做法已经越界：

- `parallel-dev-workflow.md` §8 已经**用 issue 的 `status:*` label 当分布式认领锁**
  （领取前查 label、领取即改 label、放弃即回退 label）——这是把 GitHub 当作
  可读回的协调状态，而不是只读投影。
- `pnpm harness claim` 把认领写进 `feature_list.json`（owner/in_progress），
  与 issue 的 assignee/label 构成**两份事实**，可漂移（正是 ADR-001 警告过的 drift）。
- 线上 label 已漂移：`in-progress` 与 `status:in-progress` 并存、裸 `blocked`/`passing`
  与 `status:*` 混用，没有唯一生命周期定义。

要支持「主 agent 协调多 worker agent、通过 issue label 驱动、review 后合并」，
必须先把**权威边界**钉死，否则协调逻辑一写就和现有 `claim`/`sync` 打架。

## 决策

正式划分两个平面，各自唯一权威：

1. **规范平面（文件，权威定义 WHAT 与 DONE）**——不变。
   - `phases/<phase>/feature_list.json`：feature 的 `user_visible_behavior`、
     `verification`（DoD 契约）、`depends_on`/`wave`/`parallel_safe`。
   - `passing` 仍不可逆、仍只能由 `pnpm harness verify` 门控升级。ADR-001 的
     per-owner 单 in_progress 不变。

2. **协调平面（GitHub issue + label，权威定义 WHO / WHEN / 工作到哪一步）**——正式确立。
   - issue 的 `status:*` label 是**运行时工作状态的唯一权威**，也是跨 agent 认领锁。
   - 之所以放在 GitHub 而非共享文件：issue/label 经 GitHub API 变更是**并发安全**的，
     天然解决 ADR-001 遗留的「多 owner 竞写 progress.md/handoff/memory」竞态。

3. **两平面的绑定**：`claim` 成为**原子双写**——同时置 `feature_list.owner/in_progress`
   与 issue `agent:<id>` + `status:in-progress`；二者视为一次事务，禁止只改一边。
   `feature_list.passing` ↔ label `status:merged` 一一对应。

4. **新增角色：coordinator（主 agent）**。worker/reviewer 已存在（`.harness/agents/*.yaml`），
   补一个协调者：读 issue 总线 → 分派 → 编排 review → 合并 → 流转 label。
   注册于 `.harness/agents/registry.yaml`。

5. **review-before-merge 成为正式终态**。任何 issue 的收口路径**必须**是：
   PR → 必需 reviewer 全绿 → coordinator 合并 main → `status:merged` + 关 issue。
   不存在「不过 review 直接合并」的合法路径（由 main 分支保护 + 门禁机器校验）。

## 后果

正面：
- 消除 `github-sync.yaml`（单向）与 `parallel-dev-workflow.md` §8（label 锁）的文档/实现矛盾。
- 协调状态搬到并发安全的 issue 上，绕开 ADR-001 遗留的共享文件竞写。
- 「一次做一件可验证的事」在 owner 粒度继续成立；并行吞吐可控。

负面 / 需注意：
- GitHub 从「纯投影」变为「协调权威」，**离线不可开发协调动作**（认领/流转依赖 gh 可用）。
  规范平面仍全本地，故断网时仍能写码，只是不能认领/流转。
- `sync-github.ts` 需从「一次性单向投影」演进为「幂等对账」（v1 落地）；v0 先把
  `status_actions` 的 label 对齐到规范集合，不改单向骨架。
- label 是弱类型字符串，必须由**唯一规范集合 + 迁移**约束（见
  `.harness/instructions/multi-agent-coordination.md`），否则重演漂移。

## 备选（已否决）

- **维持 GitHub 纯只读、协调全放共享文件**：与已上线的 label 锁冲突，且共享文件并行竞写
  无解（ADR-001 已 deferred 该问题）。否决。
- **认领只写 issue、不写 feature_list**：DoD/verify 门控依赖 feature_list，拆开会让
  `passing` 失去 owner 关联。故采用「原子双写」而非「单边权威」。否决。
