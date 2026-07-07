# Agent 全生命周期管理 — 设计提案

> status: Proposed
> 作者：coord-main（本提案）；实现者：architecture-coordinator（代码/coord-service 扩展）
> 维护者：architecture-coordinator（同 `agent-onboarding-checklist.md`）

## 1. 为什么需要这个

用户要扩大 agent 数量。现状是：谁在做什么、谁的 lease 已经 stale、review 队列卡在哪、
coord-service 的 D1 状态和 GitHub label 状态是否一致——这些信息分散在 `gh issue list`
临时查询、`.harness/state/*` 几个文件、和 coord-service 的 `/status` 端点里，没有一个
统一的可视化入口。随着 agent 数量增加，靠人工逐条 `gh` 查询会越来越跟不上。

**治理约束（用户已拍板，不可绕过）**：这个 UI 对"注册/注销 agent 身份（改
`registry.yaml`）、强制回收 stale lease"这类**控制面变更**，只能**可视化 + 起草**（生成
PR 草稿 / 发起回收请求），不能直接执行。最终仍要走正常 review。这保留了
`agent-onboarding-checklist.md` 里已有的规则（"新增身份是控制平面变更，走正常 PR 流程"）
——UI 只是让这个流程更好操作，不是绕过它的后门。

## 2. 全生命周期六个阶段

| 阶段 | 数据来源 | UI 展示 | UI 能发起的动作 |
|---|---|---|---|
| **注册 Register** | `registry.yaml` | 当前花名册（按 kind 分组：coordinator/module-coordinator/worker/reviewer），areas 覆盖情况 | 仅起草——生成 `registry.yaml` diff/PR 草稿，不直接改 main |
| **激活 Activate** | GitHub `agent:<id>` label 首次出现 | 该身份是否已在任意 issue 上出现过 `agent:<id>`（= 已激活信号） | 无（纯观测） |
| **在岗 Active** | GitHub `status:*`/`agent:*` label + coord-service `/status` | 每个 agent 当前认领了什么、lease 新鲜度（>6h = stale）、GitHub 与 D1 是否一致 | stale lease 仅起草回收请求（评论 + 建议的 label 变更），不直接调用 `gh issue edit` |
| **Review 中** | `review:*-ok`/`review:changes` label + `required_for` 路由规则 | 每个 in-review 的 issue/PR，哪些必需 reviewer 已通过、哪些还没 | 无（纯观测） |
| **完成 Complete** | `feature_list.json` status + PR merged 状态 | 已完成的 feature，harness verify 证据链接 | 无 |
| **注销 Retire/Deactivate** | `registry.yaml` 的 `active` 字段（如无则需新增此字段） | 长期无活动的身份 | 仅起草——生成 `active: false` 的 PR 草稿，不直接执行 |

## 3. UI 架构

### 页面/路由
```
apps/web/app/(app)/admin/coordination/
  page.tsx                    # server component，requireSysAdmin() 门禁
  coordination-dashboard.tsx  # "use client"，编排各卡片 + 轮询
  cards/
    coordinators-card.tsx
    active-claims-card.tsx
    review-queue-card.tsx
    stale-leases-card.tsx
    drift-card.tsx

apps/web/app/api/admin/coordination/
  registry/route.ts       # 读 registry.yaml，本地文件，无需 gh
  issues/route.ts         # gh issue/pr list，一次调用喂给多张卡片
  coord-service/route.ts  # 代理 coord-service /status，失败要优雅降级
```

沿用 `apps/web/app/(app)/admin/users/page.tsx` 的既有约定：page.tsx 做
`requireSysAdmin()` 门禁 + 401 跳转登录 / 403 内联 forbidden 提示；client 组件负责数据获取
与轮询；每张卡片各自实现 loading（`data-testid="loading"`，骨架屏）/ empty
（`data-testid="empty"`）/ error（`data-testid="err-<card>"`，`role="alert"`）三态，
不做单一全局错误态——比如 coord-service 拿不到不该连累 Review Queue 卡片。

### 三个 API 路由，各自的数据形状
1. **`/registry`**：直接读 `.harness/agents/registry.yaml`（`yaml.parse`，同 `sync-github.ts`
   已用的包），按 kind 分组返回。本地文件读取，免费，可以缓存 60s。
2. **`/issues`**：`gh issue list --state all --json number,labels,title,body,updatedAt
   --limit 500` + `gh pr list --state open --json number,title,labels,mergeable,
   reviewDecision,statusCheckRollup,updatedAt --limit 100`——**一次调用同时喂给
   Review Queue / Stale Leases / Coordinators 的 lease 新鲜度三张卡片**，不要每张卡片各自
   发一次 `gh`。沿用 `.harness/scripts/lib/sh.ts` 的 `spawnSync` 包装方式，**不引入
   Octokit**——这是本仓库现有 GitHub 自动化的一致约定。加 25s TTL 的内存缓存防止
   连续轮询打爆 `gh`。
3. **`/coord-service`**：服务端 `fetch("https://coord-service-staging.boardx.workers.dev
   /status")`，无需 token（该端点设计为公开只读）。必须 `try/catch` + 短超时
   （如 `AbortSignal.timeout(3000)`），失败时返回 `{available: false}` 而不是让整个
   dashboard 报错——coord-service 目前仍是可选基础设施（ADR-006）。

三个路由独立、并行请求，而不是合并成一个 summary 路由：各自缓存策略不同、失败模式独立，
`gh` 变慢不该拖累永远很快的 registry 读取，也符合本仓库现有 API 路由的粒度习惯
（`/api/admin/users`、`/api/admin/teams`、`/api/admin/stats` 都是各自独立）。

### 轮询节奏
默认 45 秒（客户端 `useEffect` + `setInterval`，卸载时清理）——本仓库 admin 区域此前没有
轮询先例，这是个新模式，但足够轻量。如果用户觉得不够"实时"，可以调低到 20-30s，代价是
`gh` 调用更频繁（已有 25s 缓存兜底，不会线性增长请求量）。

## 4. v1 范围 vs 明确推迟到 v2

**v1（本次实现）**：上表 5 张卡片、纯只读可视化、45s 轮询、三个独立 API 路由、
coord-service 优雅降级、**全程无任何直接执行的变更动作**。

**明确推迟到 v2**：
- 任何"一键执行"按钮（回收 stale lease、强制过期 D1 claim）——v2 要把这些设计成
  有审计轨迹（谁点的、什么时候）的 POST 路由，因为这些是真实的控制面变更，不是可视化。
- 历史/趋势视图（claim 持续时长走势、review 吞吐量图表）——v1 只做实时快照。
- 精确的"上次活动时间"（v1 用 issue/PR 的 `updatedAt` 近似；精确应该解析
  `claimed-by:<id> at <ISO8601>` 心跳评论，但那是每个 issue 一次 `gh` 调用的 N+1 问题，
  先不做，等确认真的需要再加）。
- coord-service token 的一键签发——这要等 coordinator 层级扩容真正开始（3 个已知修复 +
  一轮干净 soak 之后）才有意义，现在做了也没人能用。

## 5. 流程提示

这是内部 harness 工具，不是终端用户产品 feature。建议**不**走正式 `has_ui` phase 的人工
UI 签核关卡（ADR-003）——直接按内部工具的方式建、边用边迭代。但这是给用户的建议，最终
是否要正式立项走 `pnpm harness new-phase --ui` 由用户决定。

## 6. 待人类/architecture-coordinator 确认的开放问题

- 轮询间隔 45s 是否合适，还是需要更快/更慢。
- 是否要走正式 phase 立项（见第 5 节）。
- Dashboard 部署所在环境是否已配置 `gh` 认证或 `GH_TOKEN`/`GITHUB_TOKEN`——本地开发环境
  用的是个人账号认证，生产环境如果没配好，`/issues` 路由会失败，需要在实现前确认。
- `registry.yaml` 目前没有 `active` 字段（注销阶段需要）——是否要作为本提案的一部分新增
  这个 schema 字段。

## 7. 交给 architecture-coordinator 的实现请求

请 review 本提案，确认第 6 节的开放问题后，实现：
1. 上述 UI 代码（page/组件/API 路由），遵循 `apps/web/app/(app)/admin/users/page.tsx`
   的既有约定。
2. 如果第 6 节确认需要，给 `registry.yaml` 加 `active` 字段（schema 变更，走正常 PR）。
3. 完成后开 PR，coord-main 负责最终 review + 合并（本提案不代替 review）。
