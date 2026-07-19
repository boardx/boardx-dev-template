# Intents 原语 v1（coord/0.1.3）— 三层意图消息协议 wire format

> p30/F09（UC-11：三层 agent 对话与升级）。意图消息＝一类特殊 `CoordEvent`（`type`
> 前缀 `intent.`），复用 events.md 的信封与 append-only 存储——不是新的存储路径，
> 是 events 的一个语义子集 + 一层 GitHub 双写 + 一个聚合读端点。参考实现与校验器
> 在 `packages/coord-protocol`（`INTENT_TYPES`/`validateIntentRequest`）。

## 为什么需要它

三层拓扑（sub-agent → module-coordinator → coord-main → 👤）需要一种**结构化**、
**可查证**、**可聚合成线程**的对话协议，而不是散落在 issue 评论里的自然语言。
六类消息覆盖上行汇报、下行派工、升级拍板三个方向：

```
下行（人拍板 → coord 广播 → module → sub 自动继续）
  intent.assign ──────────────────────────────────▶
  intent.accept ◀──────────────────────────────────  （接收方确认，闭合下行一环）

上行（sub 汇报/卡点 → module → coord → 👤 拍板）
  intent.progress / intent.blocker ─────────────────▶
  intent.escalate ───────────────────────────────────▶ （进入「等待拍板」）
  intent.decide ◀──────────────────────────────────── （👤 拍板，闭合上行一环）
```

## 六类消息 payload

| type | payload 必填字段 | 说明 |
|---|---|---|
| `intent.assign` | `target_agent_id`、`target_resource_id` | 下行广播；`note` 可选。`target_resource_id` 复用 lease.md 资源命名。 |
| `intent.accept` | （无） | 接收方确认收到 assign；`note` 可选。 |
| `intent.progress` | `summary`（非空） | 上行进度汇报，无阻断语义。 |
| `intent.blocker` | `reason`（≥10 字符） | 上行卡点。规格与 andon 的 `reason` 相同——须含可查证锚点（events.md §Andon）。 |
| `intent.escalate` | `reason`（≥10 字符） | 上行升级至人类拍板点；线程状态转「等待拍板」。`escalated_to` 可选。 |
| `intent.decide` | `reason`（≥10 字符）、`issue_ref` | 人类拍板；闭合上行一环。`issue_ref` 是可查证锚点（`#123` 或 `owner/repo#123`，语义同 P23 postmortem 铁律——拍板不能是裸口头承诺）。`decision` 可选，∈ `approved \| rejected \| changes_requested`。 |

信封字段（`protocol`/`event_id`/`resource_id`/`agent_id`/`at`）与普通事件完全一致
（见 events.md §Event 信封）；`resource_id` 是线程锚点，约定用 `issue:<n>` 挂在
规格/派工所在的 issue 上（feature:/module:/custom: 锚定的意图仍是合法事件，只是
v1 没有 issue 可双写评论，见下）。

## RepoHub 端点

### POST /v1/repos/{owner}/{repo}/intents — 发消息

```json
{
  "type": "intent.progress",
  "resource_id": "issue:698",
  "agent_id": "wrk-t1",
  "payload": { "summary": "F09 协议扩展已写完，跑测试中" }
}
```

校验单一出口：`validateIntentRequest`（与 `validateEvent` 的 `intent.*` 分支同源，
两处共用 `intentPayloadErrors`，规则只许改一处）。非法 → 422。成功 → 201 +
落库后的完整事件（`event_id`/`at` 由 DO 生成）。

**鉴权分层（gateway 层，DO 本身不管身份）**：

- `intent.decide` 是人类拍板动作，与 andon 同级门禁——独立 `COORD_ADMIN_TOKEN`，
  scoped token / `COORD_API_TOKEN` 万能钥匙**一律拒绝**（401）。这是防伪造的核心
  措施：没有这一档，任何持有仓库 scoped token 的 agent 都能自称"人类已拍板"，
  静默把等待拍板的线程标记为已闭环。
- 其余五类（assign/accept/progress/blocker/escalate）走 scoped token +
  `agent_id` 强绑定（auth.ts `bindScopedAgentRequest`，与 `/claims`、MCP 工具同一
  套 #721 语义）：scoped token 只能以自己的身份发消息，请求体里的 `agent_id` 若
  与 token 身份不符 → 403 `token_agent_mismatch`；缺省则注入 token 身份。
  `COORD_API_TOKEN` 万能钥匙维持自证语义（运维通道）。

### GET /v1/repos/{owner}/{repo}/intents?resource_id= — 读线程

```json
{
  "resource_id": "issue:698",
  "thread_status": "awaiting_decision",
  "events": [
    { "event_id": "evt_01J...", "type": "intent.blocker", "agent_id": "wrk-t1", "at": "...", "payload": { "reason": "..." } },
    { "event_id": "evt_01K...", "type": "intent.escalate", "agent_id": "module-coord", "at": "...", "payload": { "reason": "...", "escalated_to": "usam" } }
  ]
}
```

按 `resource_id` 过滤 `type LIKE 'intent.%'` 的事件，按 `event_id`（ULID，严格
递增）排序返回——这是 devportal talk tab 消费的聚合视图，也是 GitHub 镜像评论
之外的权威读路径（events 本身永远是唯一可信历史，双写只是可读性投影）。
读鉴权同 `/events`：scoped/ops 均可，无 bearer 401。

## 线程闭环状态推导

`thread_status ∈ open | awaiting_decision | closed`，纯函数推导（见
`packages/coord-repohub/src/intents.ts` `deriveThreadStatus`，按 `event_id`
排序后取最新）：

1. 若最新一条 `intent.escalate` **晚于**最新一条 `intent.decide`/`intent.accept`
   （或后者不存在）→ **`awaiting_decision`**（等待拍板，👤 尚未回应升级）。
2. 否则若存在 `intent.decide`/`intent.accept` → **`closed`**（已闭环）。
3. 否则（只有 assign/progress/blocker，从未升级/拍板过）→ **`open`**（进行中）。

注意：`closed` 之后的新一轮 `intent.assign`（下行广播，人拍板后 coord 继续派工）
**不会**把状态拉回 `awaiting_decision`——只有新的 `intent.escalate` 才会重新打开
等待拍板窗口。这是刻意设计：一条线程可以多轮「进行中 → 升级 → 拍板 → 继续」，
每一轮的边界由 escalate/decide 配对界定，assign/accept 是配对之间的执行细节。

## GitHub issue 双写

反向投影 cron（同 andon/lease 的流水线，`coord-projection`）把 `issue:N` 锚定
的每条 intent 事件投影为该 issue 下**一条独立评论**（`packages/coord-projection`
`project()` 新增 `issue_comment` 调用类型，`apply.ts` 打 `POST
/repos/{owner}/{repo}/issues/{n}/comments`）。

评论格式（`intentCommentBody`）：

```
📨 **intent.assign** · `coord-main` · 2026-07-19T00:00:00Z

- **target_agent_id**: wrk-t1
- **target_resource_id**: issue:698

<sub>coord intent · event_id=evt_01J...</sub>
```

**凭据**：复用 F06 反向投影既有的 GitHub App 认证栈（`coord-projection/src/
github-app.ts`，installation token，`GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`），
不新增任何长期密钥——与 commit status/check run 走同一 installation token。

**与 andon/lease 双写的关键差异（覆盖 vs 追加）**：andon/lease 投影是"状态驱动 +
按 sha 去重覆盖"（同一 PR 的 `coord/andon` status 反复投递、后者覆盖前者，重投
无害）；intent 投影是"一条事件 = 一条评论"，**不去重、不覆盖**。这意味着：

- 正常路径：at-least-once 投影 + 游标按批次推进——若某条 `issue_comment` 调用
  失败（GitHub 瞬断），本批次游标仍会推进（现有 `projection.ts` 的批次级推进
  模型，不是逐事件推进），该条评论**永久丢失**，不会像 andon/lease 那样在下个
  tick 靠状态快照自愈补投。这是已知的残留风险（v1 接受，见下）；events 本身
  仍是权威历史，devportal talk tab 走 `GET /intents` 读表可以完整看到，只有
  GitHub 镜像评论这一份"人类友好只读视图"可能有缺口。
- 二次投递若发生（理论上不会，因为失败即丢弃、成功不重放），会产生重复评论——
  与 andon/lease 的幂等覆盖语义不同，这里没有幂等保护，纯靠"游标只推进一次"
  的调用方保证兜底。

## 攻击面与伪造风险（PR body 摘要落点）

- **decide 伪造**：唯一的防线是 gateway 层的 `requireAdmin` 门禁（独立
  `COORD_ADMIN_TOKEN`，与 andon raise/clear 同级）。持有仓库 scoped token 的
  agent 无法发起 `intent.decide`——尝试会被 401 拒绝。风险收敛到「谁持有
  `COORD_ADMIN_TOKEN`」，与现有 andon 特权的信任边界完全一致，未引入新的
  权限模型。
- **其余五类的身份伪造**：与 `/claims`、tasks ack/complete 同一套 `agent_id`
  强绑定（#721），scoped token 不能自证他人身份。
- **GitHub 双写凭据**：复用既有 GitHub App installation token，未新增密钥；
  该 token 的信任边界与 F06 andon/lease 投影相同。
- **重放/丢失**：见上一节"覆盖 vs 追加"——intent 投影无幂等保护，游标按批次
  推进意味着单条评论投递失败即永久丢失（不影响 events 权威历史，只影响
  GitHub 镜像视图的完整性）。

## 与 events.md 的关系

`intent.*` 六类型已加入 `EVENT_TYPES` 封闭集合（coord/0.1.3，见
`docs/coord-platform/protocol/CHANGELOG.md`）；本文件是该子集的专属规格，
信封结构、订阅方式、append-only 约束全部继承 events.md，不重复定义。
