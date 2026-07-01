# 多 Agent 协调协议（主 Agent + issue-label 状态机）

> 本文定义 **coordinator（主 agent）** 如何通过 GitHub issue + label 编排多个 worker/reviewer
> agent，并把「每个 issue 必须经 review 后 PR 合并 main」固化为流程。
>
> 权威边界见 **ADR-004**：文件=规范/DoD 权威；issue+label=运行时协调权威。
> worker 侧的 wave/DoR/隔离细节见 `parallel-dev-workflow.md`——本文只补**主 agent 层**与
> **规范化的 label 状态机**，不重复 worker 侧内容。

## 1. 规范 label 集合（唯一事实，禁止漂移）

### 1.1 `status:*` —— 互斥生命周期（一个 issue 任一时刻**恰好一个**）

```
status:needs-spec        规范/DoR 未达标，不可开发
      │ （requirement-author + verification-writer 补齐 → DoR 通过）
      ▼
status:ready-for-dev     DoR 达标、依赖全绿、未认领 → 可被 coordinator 分派
      │ （coordinator 分派：加 agent:<id>）
      ▼
status:in-progress       已认领并在写码（= 跨 agent 认领锁，见 ADR-004）
      │ （worker 开 PR，Closes #N）
      ▼
status:in-review         PR 已开，coordinator 已请必需 reviewer
      │                        │
      │（全部必需 review 绿）    │（任一 review 要求改动）
      ▼                        ▼
status:approved          status:changes-requested ──► 退回 status:in-progress
      │ （coordinator 合并 main）
      ▼
status:merged            终态：PR 合并、issue 关闭、harness verify 置 feature=passing

status:blocked           旁路：外部障碍（缺 key/环境/上游未绿）。可从任意态进入，
                         排除后回到进入前的态。带 comment 说明原因。
```

映射：`feature_list.json` 的 `passing` ⇔ label `status:merged`（ADR-004 §3）。

### 1.2 正交维度（非互斥，可叠加）

| 维度 | 取值 | 来源 |
|---|---|---|
| `agent:<id>` | 花名册 id（`registry.yaml`） | coordinator 分派时打 |
| `area:<x>` | feature.area | sync 投影（已有） |
| `wave:<N>` | 依赖拓扑层级 | sprint-planner（已有） |
| `parallel-safe` | 与同 wave 兄弟文件不相交 | sprint-planner / coordinator |
| `cap:<x>` | feature.capability | sync 投影 |
| `review:code-ok` `review:e2e-ok` `review:feature-ok` `review:security-ok` | reviewer verdict | reviewer agent 通过时打 |
| `review:changes` | 有 reviewer 要求改动 | reviewer agent |

### 1.3 迁移（消除线上漂移）

| 旧 / 漂移 label | → 规范 label |
|---|---|
| `in-progress` | `status:in-progress` |
| `blocked` | `status:blocked` |
| `passing` | `status:merged` |
| `status:ready-for-dev` | 保留（已规范） |
| `wave:N` / `parallel-safe` / `area:*` | 保留 |

> `passing`/`blocked`/`in-progress` 这三个裸 label 迁移完成后**废弃**（删除或停用）。
> 迁移由 `.harness/scripts/migrate-labels.ts`（v0 附）执行，幂等。

## 2. Coordinator（主 Agent）单轮循环

主 agent 无状态、只读 issue 总线即可冷启动。每轮：

1. **拉总线**：`gh issue list --state open --json number,labels,title` 读全量 status。
2. **分派**：取 `status:ready-for-dev ∩ 无 agent:* ∩ wave==当前 ∩ parallel-safe`
   的 issue，按 `registry.yaml` 的 worker `areas` 亲和 + `max_concurrent` 选空闲 worker，
   **原子双写**（ADR-004 §3）：`harness claim --owner <id>` 且
   `gh issue edit N --add-label agent:<id>,status:in-progress --remove-label status:ready-for-dev`。
3. **监视**：worker 完成开 PR（`Closes #N`）→ 自身把 issue 置 `status:in-review`。
4. **编排 review**：对 `status:in-review` 的 issue，按 §3 算出必需 reviewer 集合，
   逐个用 `Agent` 调起（传 PR diff）；reviewer 通过打 `review:*-ok`，否则 `review:changes`。
5. **门禁 + 合并**：当
   - 全部必需 `review:*-ok` 到齐，且
   - CI 必需检查（`verify` + `fullstack-smoke`）绿，且
   - PR 分支 up-to-date（否则要求 worker rebase）
   → coordinator `gh pr merge --squash`，置 `status:merged`，关 issue，
   跑 `pnpm harness verify` 把 feature 翻 `passing`。
   否则置 `status:changes-requested`，`@` 回原 worker。
6. **回收 / 升级**：`status:in-progress` 超过 lease（见 §4）无进展 → 解锁重分派；
   `status:blocked` → 升级给人类（评论 + 通知）。

## 3. Review 路由（哪些 reviewer 是必需的）

一个 issue 的**必需 reviewer** = `registry.yaml` 中所有满足下式的 reviewer：

```
reviewer.required_for 含 "*"   OR   reviewer.required_for ∩ {issue.area} ≠ ∅
```

例：`area:auth` 的 issue → `rev-code`(*) + `rev-feature`(*) + `rev-security`(auth)；
`area:canvas` 的 issue → `rev-code` + `rev-feature` + `rev-e2e`(canvas)。
全部对应 `emits` 的 verdict label 到齐才允许合并。

## 4. 认领租约（lease，防死锁）

- 认领时评论 `claimed-by:<id> at <ISO8601>`；worker 每次推进（push/评论）刷新时间。
- coordinator 每轮检查：`status:in-progress` 且最后活动 > `LEASE_TTL`（建议 6h）→
  视为 stale：去 `agent:<id>`、回退 `status:ready-for-dev`、`harness` 释放 owner，可重分派。

## 5. review-before-merge 硬门禁（机器校验，非君子协定）

- **main 分支保护**（v0 配置，见 setup）：必须 PR、必须 required checks
  （`verify`、`fullstack-smoke`）、必须分支 up-to-date、禁直推、必须 1 个 approve
  （= coordinator 的 approve）。
- **合并前置校验**（coordinator 或一个 CI job）：PR 正文含 `Closes #N`；
  该 issue 的必需 `review:*-ok` 全部在 PR/issue 上。缺任一 → 不合并。

> 这条是本方案对「主 agent 调各 agent review 后再合并」的**可执行落地**：
> 不过 review 的 PR，在分支保护 + 前置校验双重拦截下无合法合并路径。

## 6. v0 边界（当前落地范围）

v0 只做**契约层**，不引入 coordinator 自动化代码（那是 v1）：
- 本文 + ADR-004 + `registry.yaml`（协议与身份）。
- `migrate-labels.ts` + 规范 `status:*` label（状态机就位）。
- main 分支保护 + required checks（硬门禁就位）。
- `github-sync.yaml` 的 `status_actions` 对齐规范 label。

→ v0 完成后，**人类或任一 agent 可照本文手动跑通全流程**；v1 再把 §2 循环实现为自动 coordinator。
