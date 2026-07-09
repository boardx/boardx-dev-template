# coord-service 人类操作手册（app / API / 数据怎么用）

> 面向**人类**（仓库所有者/运维），不是 agent。agent 侧的使用约定见
> `coordinator-sop.md` / 各 SKILL.md；架构决策见 ADR-006/008/009。
> 2026-07-08 起（ADR-009），这套东西是 agent 协调的**唯一权威**——GitHub issue
> 上不再有租约评论可看，你看协调状态就靠本文的三个入口。

## 0. 一分钟认识它

```
┌─ 你（人类）────────────────────────────────────────────┐
│  ① Web 仪表盘 /admin/coordination（最省事）              │
│  ② curl /status（公开只读 API）                          │
│  ③ Cloudflare Dash 的 D1 Console（直接查 SQL，最底层）    │
└──────────────┬─────────────────────────────────────────┘
               ▼
   Cloudflare Worker: coord-service-staging
   https://coord-service-staging.boardx.workers.dev
               │  （每 5 分钟 cron：sweeper 自动回收过期租约）
               ▼
   D1 数据库: coord-service-staging
   表：agents（身份+token哈希） claims（租约） events（只增历史） verdicts
               ▲
   agent 会话通过 pnpm harness lock-* / module-lock-* 读写（需 token）
```

## 1. 看协调状态的三种方式

### ① Web 仪表盘（推荐日常使用）

打开应用的 **`/admin/coordination`**（需要以 SysAdmin 登录）。三张卡：

| 卡片 | 内容 |
|---|---|
| Coordinators | registry.yaml 的身份名录（谁被注册过、active 与否） |
| Active Claims | **谁此刻持有什么租约**、心跳多久前、ttl（30 秒自动刷新） |
| Recent Events | 最近 50 条协调事件（claim/release/heartbeat/expire + 叙述层 cycle-plan/cycle-result/andon），按类型着色 |

前置条件：apps/web 的部署环境要配 `COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev`
——没配时卡片会显示 "COORD_SERVICE_URL is not configured"，这是提示不是故障。

### ② /status API（公开只读，脚本/快速检查用）

无需任何凭据：

```bash
curl -s https://coord-service-staging.boardx.workers.dev/status | jq
```

返回 `active_claims`（当前所有 in_progress 租约）+ `recent_events`（最近 50 条）
+ `generated_at`。几个常用过滤：

```bash
# 谁在当 coord-main？（空数组 = 席位空缺）
curl -s .../status | jq '.active_claims[] | select(.resource_id=="role:coord-main")'

# 所有协调者租约的心跳时间
curl -s .../status | jq '.active_claims[] | {resource_id, agent_id, last_heartbeat_at}'

# 最近有没有租约被 sweeper 强制过期（值得关注的异常信号）
curl -s .../status | jq '.recent_events[] | select(.type=="expire")'
```

### ③ Cloudflare Dash 的 D1 Console（查历史/审计用）

dash.cloudflare.com → **Storage & Databases → D1 → `coord-service-staging`** → Console 标签，
直接跑 SQL。常用查询：

```sql
-- 某个角色的完整租约历史（含已释放/已过期的）
SELECT * FROM claims WHERE resource_id='role:coord-main' ORDER BY claimed_at DESC LIMIT 20;

-- 协调层最近 100 条事件（events 表只增不改，是唯一可信历史）
SELECT * FROM events ORDER BY id DESC LIMIT 100;

-- 有哪些注册身份、谁被停用了
SELECT id, kind, active, created_at FROM agents ORDER BY kind, id;
```

命令行等价（需要 `packages/coord-service/.env.cloudflare`，见 §3）：

```bash
cd packages/coord-service
sh -c 'set -a; . ./.env.cloudflare; set +a; npx wrangler d1 execute coord-service-staging \
  --remote --env staging --command "SELECT ..." --json'
```

## 1.5 HTTP API 全表（写操作都要 Bearer token）

根路由 `GET /` 返回服务简介 + 这张端点清单。完整表：

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/` | 公开 | 服务简介 + 端点清单 |
| GET | `/status` | 公开 | active_claims + 最近 50 事件（见 §1②） |
| GET | `/claims?resource_id=&status=` | 公开 | 查租约 |
| POST | `/claims` | token | 原子认领租约（撞 `uq_active_claim` → 409） |
| POST | `/claims/:id/heartbeat` | token（须持有者） | 续约（刷新 last_heartbeat_at） |
| POST | `/claims/:id/release` | token（须持有者） | 交还租约 |
| POST | `/verdicts` | token（须 `kind: reviewer`） | 记一条 review verdict |
| POST | `/events` | token（andon 须 coordinator 层） | 写一条**叙述层事件**，见下 |

### 叙述层事件 `POST /events`（ADR-009 后站会/停线信号的家）

GitHub 协调面退役后，原本发在 issue 上的**站会**（cycle-plan/cycle-result）和
**Andon 停线信号**改写进 D1 events 表。只接受这三种叙述类型；claim 生命周期类型
（claim/heartbeat/release/expire/verdict/merge）手写一律 400（防伪造审计历史）。

```bash
# 站会：发本周期的 cycle-plan（任意已认证身份都能发自己的）
curl -s -X POST .../events -H "Authorization: Bearer $COORD_SERVICE_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"type":"cycle-plan","resource_id":"cycle:2026-07-09T00:00Z",
       "payload":{"commit":["ship X"],"carry":[],"blocked":[]}}'

# Andon：main 打挂时发停线信号（**仅 coordinator 层身份**，worker 发会 403——
# 防止普通 worker 伪造 stop 拉停整个 fleet 或伪造 clear 解除合法停线）
curl -s -X POST .../events -H "Authorization: Bearer $COORD_SERVICE_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"type":"andon","resource_id":"andon:main","payload":{"signal":"stop","reason":"main typecheck red"}}'
```

写进去的叙述事件在 `GET /status` 的 recent_events 和仪表盘 Recent Events 卡片里可见。

## 2. 凭据（token）管理

### token 怎么发到 agent 会话（实际现状，非自动）

**没有一个自动生成的中央凭据文件。** `seed-agents.ts` 只在生成那一刻把新 token
**打印到 stdout 一次**（`console.log`，见下），不落任何文件。分发是人工的：谁跑的
seed，谁负责把每个 token 写进对应 agent 会话能读到的本地文件，再让会话 source。

2026-07-08 的 8 身份分发实际就是这么做的：每个身份一个独立文件（mode 600、
放在 git worktree 之外），文件内容两行——

```bash
# <coord-id>.env（gitignored 或放在仓库树外，绝不进 git）
export COORD_SERVICE_URL="https://coord-service-staging.boardx.workers.dev"
export COORD_SERVICE_TOKEN="<该身份的 token>"
```

agent 会话每次跑 lock 命令前 `source` 它即可。分发时只把**文件路径**贴到总线
（如各自 lease issue / #323），**token 值绝不贴**。

> 一个自动写中央 `coord-credentials.json` 的便利脚本尚未实现——现状是"seed 打印
> → 人工分发到 per-session 文件"。要做成自动的话是独立改进，别假设那个 json 已存在。

### 给新身份发 token（registry.yaml 加了新 agent 之后）

```bash
cd packages/coord-service
npx tsx scripts/seed-agents.ts        # 幂等：只给 D1 里还没有的 id 生成新行+新 token
```

**token 只在生成那一刻打印一次**（stdout），立刻按上面的方式分发进 per-session
文件，别贴进 issue/PR/聊天记录。

### 轮换（token 疑似泄漏 / 丢失时）

轮换 = `UPDATE agents SET token_hash='<新token的sha256hex>' WHERE id='<id>'`——
**永远不要 DELETE**（会孤立该身份的 claims/events 历史）。

⚠️ **治理要求（铁律 #8 同级）**：轮换是对共享协调基础设施的变更，每次执行前需要
人类明确授权——即使执行者认为"这个 token 反正丢了、轮换无害"。2026-07-08 的
8 身份轮换即按此流程执行（会话内人类逐次确认）。

## 3. 部署与运维

前置：`packages/coord-service/.env.cloudflare`（gitignored）里放 Cloudflare API
token（`CLOUDFLARE_API_TOKEN=...`，需要 Workers + D1 权限）。

```bash
cd packages/coord-service

# 部署 Worker（改了 src/ 之后）
sh -c 'set -a; . ./.env.cloudflare; set +a; npx wrangler deploy --env staging'

# 应用新的 D1 迁移（migrations/ 加了新文件之后）
sh -c 'set -a; . ./.env.cloudflare; set +a; npx wrangler d1 migrations apply coord-service-staging --remote --env staging'

# 实时看 Worker 日志（排查请求为什么 401/500）
sh -c 'set -a; . ./.env.cloudflare; set +a; npx wrangler tail --env staging'

# 本地跑测试（不碰任何云端资源）
pnpm --filter @repo/coord-service test
```

**cron**：sweeper 每 5 分钟跑一次，把 `last_heartbeat_at + ttl_seconds < now` 的
in_progress 租约标记为 expired 并写一条 expire 事件——不需要人干预，这就是
"心跳断了租约自动回收"的机械保证。

**projector 保持熄灭**（ADR-009）：staging 环境**不要**配置 `GITHUB_TOKEN`/`GITHUB_REPO`
这两个 secret。配了它就会开始往 GitHub 投影评论——那是被人类决定退役的行为。

## 4. 故障排查速查

| 症状 | 原因 | 处置 |
|---|---|---|
| agent 报 `COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置` | 会话没 source 凭据 | 按 §2 的用法 export 两个变量；这是 ADR-009 有意的强制换轨，不是 bug |
| agent 调用返回 401 | token 错/被轮换过 | 从凭据文件重新取；确认取的是自己身份的 token |
| acquire 返回 409 | 别的会话刚抢先认领 | 正常的原子判定结果，不要重试抢占；`/status` 看谁拿到了 |
| acquire 报 fail-closed 拒绝 | Worker/D1 不可达 | `curl /status` 验证；Cloudflare 侧故障时协调暂停是设计行为（ADR-009 接受的代价）；人类确认后可 `--force` |
| 租约显示被持有但会话早就没了 | 心跳断了但 ttl（默认 6h）未到 | 等 sweeper 到点回收，或 D1 Console 手动 `UPDATE claims SET status='expired' WHERE id=<n>`（这属于共享基础设施变更，先在总线留言） |
| dashboard 卡片显示 unconfigured | apps/web 没配 COORD_SERVICE_URL | 部署环境加该变量，重启 |
| dashboard 卡片报 Couldn't reach | Worker 不可达/超时 | 同 fail-closed 行；`wrangler tail` 看日志 |

## 5. 安全纪律（public 仓库）

- token/API key **只**存在于：D1 的 hash 列、本地 gitignored 文件、Cloudflare secret。
  任何时候不进 git、不进 issue/PR/评论（总线全球可读）。
- `.env.cloudflare` 与各 per-session 的 `<coord-id>.env` 凭据文件都必须 gitignored
  或放在仓库树外——不要为了"备份"把它们复制到仓库内会被 git 追踪的路径。
- 发现泄漏：立即按 §2 轮换受影响身份 + 在总线留一条（不含新 token）说明轮换原因。
