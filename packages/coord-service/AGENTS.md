# AGENTS.md — packages/coord-service 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
Cloudflare Workers + D1 协调服务。目标：把 agent 认领/心跳/交还这类需要真原子性的
协调事实，从 GitHub label（无 CAS，见 ADR-005 附近讨论）搬到一个 D1 表，GitHub issue
仍是人类可读的规范/叙述层，只做单向只读投影。当前处于 Phase 1（脚手架 + 本地开发，
不需要任何 Cloudflare 真实凭据）——详见会话内批准的实施计划；Phase 2 起才接触真实账号。

## 局部约束
- **身份永远从 token 反查，不从请求体读**：`auth.ts` 的 `requireAgent` 是唯一合法的
  身份来源；任何 route handler 都不得信任请求体里自称的 `agent_id`。
- **`uq_active_claim`（`claims(resource_id) WHERE status='in_progress'`）是唯一的原子性
  保证**——认领必须是一次 `INSERT`，靠唯一索引冲突判定"已被占用"，不允许先
  `SELECT` 再 `INSERT` 的 check-then-act 写法（那样自己就把原子性写没了）。
- **`events` 表只增不改**：应用层不暴露任何 `UPDATE`/`DELETE`，它是未来"协调层面
  发生过什么"的唯一可信历史。
- **不用框架**：路由是手写的 method+path matcher（`router.ts`），不引入 Hono/itty-router——
  接口只有 6 条，跟这仓库 `packages/data` 的"显式 SQL、不用 ORM"风格一致。
- **GitHub 侧只用 `fetch` + PAT，不 shell 出 `gh`**：Workers 运行时没有子进程/shell，
  这是硬约束，不是风格选择（`sync-github.ts` 那种 `gh` CLI shell-out 方式在这里行不通）。
- **不动 label，只发评论 + `agent:<id>` label**：`sync-github.ts` 已经拥有
  `status:*`/`sprint:*`/`area:*` 这些 label（`github-sync.yaml` 的 `status_actions`
  从不写 `agent:*`），新 projector 只能用它没碰过的 `agent:<id>` label + 评论，
  避免两个 projector 打架。
- **测试用 `@cloudflare/vitest-pool-workers`**，不要手搭 miniflare 脚本——它在真实
  Workers 运行时里跑 vitest，D1 binding 是真的（含唯一索引冲突行为），零云端凭据。
