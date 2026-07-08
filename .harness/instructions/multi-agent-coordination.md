# 多 Agent 协调协议（主 Agent + issue-label 状态机）

> 本文定义 **coordinator（主 agent）** 如何通过 GitHub issue + label 编排多个 worker/reviewer
> agent，并把「每个 issue 必须经 review 后 PR 合并 main」固化为流程。
>
> 权威边界见 **ADR-004**：文件=规范/DoD 权威；issue+label=运行时协调权威。
> worker 侧的 wave/DoR/隔离细节见 `parallel-dev-workflow.md`——本文只补**主 agent 层**与
> **规范化的 label 状态机**，不重复 worker 侧内容。
> 共享 git 工作目录的隔离规则（任何角色一律 worktree、分支建好立即 push）见 **ADR-005**。
> 新 agent/新平台加入协作的最小阅读清单见 `agent-onboarding-checklist.md`。
>
> ⚠️ **2026-07-08 起（ADR-009）：认领/心跳/退位的权威已整体切换到 coord-service (D1)**
> （`pnpm harness lock-*` / `module-lock-*`，需要 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN`
> 凭据）。本文中所有"lease 评论仪式 / claimed-by 评论 / label 认领锁"的段落自该日起
> **仅作历史记录保留**——GitHub issue 的 feature 规格用途、`status:*` label 作为
> feature 工作流的单向投影（`sync-github.ts`）不受影响，但它们不再是协调层的锁或
> 权威。人类看协调实时状态走 coord-service `GET /status` 或 `/admin/coordination`
> 仪表盘，不再翻 issue 评论。ADR-004 的协调面结论被 ADR-009 取代；ADR-006/008 保留
> 为历史决策记录。

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
| `coordination:lease` | ~~总 coordinator（coord-main）唯一性心跳锁~~ **已退役（ADR-009）**：唯一性由 D1 `role:coord-main` claim 裁定（`pnpm harness lock-*`）；存量 lease issue 保留为历史记录 | — |
| `coordination:lease:<module>` | ~~该 module-coordinator 的唯一性心跳锁~~ **已退役（ADR-009）**：唯一性由 D1 `role:coord-<module>` claim 裁定（`pnpm harness module-lock-*`）；存量 lease issue 保留为历史记录 | — |

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

> **2026-07-08 起（ADR-009）**：租约的权威载体是 D1 claims 表——认领即
> `POST /claims`（`uq_active_claim` 原子判定），心跳即 `POST /claims/:id/heartbeat`，
> 过期回收由服务端 sweeper 按 ttl 机械执行，不再依赖巡检会话恰好注意到。
> 下述"claimed-by 评论 + coordinator 轮巡检查"仪式保留为历史记录：

- ~~认领时评论 `claimed-by:<id> at <ISO8601>`；worker 每次推进（push/评论）刷新时间。~~
- ~~coordinator 每轮检查：`status:in-progress` 且最后活动 > `LEASE_TTL`（建议 6h）→
  视为 stale：去 `agent:<id>`、回退 `status:ready-for-dev`、`harness` 释放 owner，可重分派。~~
- 现行：worker 认领 issue 时对 `issue:<n>` resource 做 D1 claim；stale 判定与回收
  以 D1 sweeper 的过期事件为准，coordinator 依据 `GET /status` 的 active_claims
  做重分派决策。

## 5. review-before-merge 门禁

理想是**服务端硬门禁**：main 分支保护 —— 必须 PR、必须 required checks
（`verify`、`fullstack-smoke`）、必须分支 up-to-date、禁直推、必须 1 个 approve。

> ⚠️ **当前套餐限制**：本仓是**私有仓 + GitHub 免费套餐**，经典分支保护与 rulesets
> 均返回 403（"Upgrade to GitHub Pro or make this repository public"）。故服务端硬门禁
> **暂不可用**。启用前置条件：仓库转 public / 升级 Pro(个人) 或 Team(org)。届时执行：
>
> ```bash
> gh api -X PUT repos/boardx/boardx-dev-template/branches/main/protection --input - <<'JSON'
> { "required_status_checks": { "strict": true, "contexts": ["verify","fullstack-smoke"] },
>   "enforce_admins": false,
>   "required_pull_request_reviews": { "required_approving_review_count": 1 },
>   "restrictions": null }
> JSON
> ```

**v0 现行门禁（无服务端强制时的兜底）**——由 **coordinator（v1）** 在合并动作前**程序化校验**：
1. PR 正文含 `Closes #N`；
2. 该 issue 的必需 `review:*-ok`（按 §3 路由）全部到齐；
3. CI 的 `verify`、`fullstack-smoke` 为 success；
4. 分支 up-to-date。
缺任一 → coordinator **拒绝合并**，置 `status:changes-requested`。

> 因 coordinator 是**唯一被授权执行合并**的角色，"不过 review 就不合并"由它独占合并权来保证。
> 服务端保护一旦可用，即从「唯一合并者」升级为「任何人都无法绕过」的双保险。
>
> 2026-07-04 起可拆出 module-coordinator 二级层（见 `.agents/skills/module-coordinator/SKILL.md`
> 与 registry.yaml 的 `kind: module-coordinator`）：只做分派/初审/返工裁决，**不在"唯一合并者"
> 授权集合内**，全绿 PR 一律转交 coord-main 执行最终合并——不改变本节的独占合并权归属。

## 6. v0 边界（当前落地范围）

v0 只做**契约层**，不引入 coordinator 自动化代码（那是 v1）：
- 本文 + ADR-004 + `registry.yaml`（协议与身份）。
- `migrate-labels.ts` + 规范 `status:*` label（状态机就位）。
- 门禁：因套餐限制服务端分支保护暂不可用（§5），v0 由 coordinator 独占合并权兜底；
  服务端保护命令已备好，待仓库转 public / 升级套餐后启用。
- `github-sync.yaml` 的 `status_actions` 对齐规范 label。

→ v0 完成后，**人类或任一 agent 可照本文手动跑通全流程**；v1 再把 §2 循环实现为自动 coordinator。

## 7. 通信信道分层（状态走总线，消息只做通知）

| 层 | 信道 | 用途 | 权威性 |
|---|---|---|---|
| 0 | **coord-service (D1)**（`lock-*`/`module-lock-*` 命令 + `GET /status`） | 认领/心跳/退位/过期回收——**一切租约类状态** | **权威（ADR-009 起）**。events 表是协调事件的唯一可信历史 |
| 1 | **issue/PR 总线**（评论 + label） | review verdict、返工清单、分派点名、事故复盘、需要人类可读叙述的一切；`status:*` label 仅为 feature 工作流投影 | 叙述层。租约类状态不再以此为准（ADR-009 前的历史评论保留可查） |
| 2 | 跨会话直达消息 | 需要对方立即注意的通知：催办、澄清、回执 | **非权威**。消息中声称的状态变化必须同时在层 0/1 有落点；冲突时以层 0 为准 |
| 3 | 仓库文件（SOP/registry/feature_list） | 协作规则与规范本身 | 规范权威（ADR-004 决策：规范平面，不受 ADR-009 影响） |

判例锚点（2026-07-04）：
- 僵尸认领裁决：#251 lease 超时（最后活动 >6h TTL）且两次催办无认领响应 → 按 §4 回收重分派；勘探确认原会话无可复用产出。判据全部来自总线可查事实。
- 冲突裁决：直达消息声称 review 全绿，总线可核验事实（git ls-tree evidence 缺失）胜出。

### 7.1 public 仓库敏感信息纪律
仓库为 public 后总线**全球可读**。总线评论/issue 正文/PR 描述中禁止出现：
密钥与 token、内部 URL/连接串、账单与账户细节、个人邮箱之外的隐私数据。
此类内容只走会话内沟通或私有渠道；发现已泄漏的立即删除评论并轮换凭证。
