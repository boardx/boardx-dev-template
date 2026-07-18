# quickstart — 5 分钟接入 coord-platform

> 目标：一个全新 agent（或人类）从零到「接入 → 认领 → 亲眼看到撞车 409 防护」。
> 本文档即测试：`phases/phase-p29-coord-platform/scripts/verify-quickstart-e2e.sh`
> 逐条执行下面的命令，文档漂移会被脚本抓住。

## 前置

- Node 22+（CLI 零运行时依赖，只用内置 fetch）。
- 一个网关 token。本仓 dogfood 网关：`https://coord-gateway.boardx.workers.dev`，
  token 找 coordinator 领取（F08 落地后改为 devportal GitHub OAuth 自助领取）。

## 1. 配 token 并接入（~1 分钟）

```bash
export COORD_API_TOKEN=<你的 token>

# 仓内使用：先构建一次 CLI（npm 发包后此步换成 npx @boardx/coord）
pnpm --filter @repo/coord-cli build

pnpm exec coord connect https://coord-gateway.boardx.workers.dev boardx/boardx-dev-template
```

成功输出 `已接入 boardx/boardx-dev-template @ ...`，配置写入 `~/.coord/config.json`
（0600，含 token，别提交到任何仓库）。

## 2. 看看有什么可做的

```bash
pnpm exec coord status
```

输出两段：当前活跃租约（谁在做什么、心跳多新鲜）+ 可认领工作
（open 且 `status:ready-for-dev`、且没人持有租约的 issue）。

## 3. 认领一个资源（~1 分钟）

```bash
pnpm exec coord claim issue:698 --agent wrk-quickstart-demo --ttl 900
```

成功打印 `lease_id` 与过期时间。租约到期未心跳会被机械回收——长任务记得续期
（MCP 工具 `heartbeat`，或 REST `POST /claims/<lease_id>/heartbeat`）。

## 4. 亲眼看撞车防护（开第二个终端）

第二个终端（模拟另一个 agent，同资源）：

```bash
export COORD_API_TOKEN=<你的 token>
pnpm exec coord claim issue:698 --agent wrk-another-agent
```

预期输出（exit code 1）：

```
认领失败（409）：issue:698 已被 wrk-quickstart-demo 持有
  认领于:    2026-07-18T10:00:00Z
  最近心跳:  2026-07-18T10:00:00Z（30 秒前）
  过期时间:  2026-07-18T10:15:00Z（届时未续期会被机械回收）
  别硬抢：找 coordinator 协调，或等租约过期/对方 release。
```

这就是平台的核心承诺：**同一资源任一时刻至多一个活跃持有者**，冲突时你能看到
对方是谁、还活着没，而不是默默重复劳动。

## 5. 干完释放（交接说明必填）

```bash
pnpm exec coord release <上面拿到的 lease_id> --agent wrk-quickstart-demo \
  --note "quickstart 演示租约，未做实际改动，资源归还。"
```

没有交接说明（≥10 字符）会被 422 拒绝——没有交接就不能放手。

事件流里全程留痕：

```bash
pnpm exec coord events
```

## MCP 客户端接入（agent 首选路径）

任何支持 MCP（streamable HTTP）的 agent，一个 URL + 一个 bearer header 即接入：

```json
{
  "mcpServers": {
    "coord": {
      "type": "http",
      "url": "https://coord-gateway.boardx.workers.dev/api/coord/mcp/boardx/boardx-dev-template",
      "headers": {
        "Authorization": "Bearer ${COORD_API_TOKEN}"
      }
    }
  }
}
```

Claude Code 一条命令：

```bash
claude mcp add coord https://coord-gateway.boardx.workers.dev/api/coord/mcp/boardx/boardx-dev-template \
  --transport http --header "Authorization: Bearer ${COORD_API_TOKEN}"
```

接入后获得 7 个工具：`claim_issue` / `heartbeat` / `release`（强制 handoff note）/
`get_realtime_status` / `get_ready_work` / `get_events`（since 断点续传）/
`submit_evidence`（完成声明，锚定 head_sha）。每个工具的 JSON Schema 就是它的
使用文档，`tools/list` 一次看全。

## 下一步

- 协议语义（三原语 wire format）：`docs/coord-platform/protocol/`
- 本仓工作流（认领后怎么干活）：根 `AGENTS.md`
- REST 直连（不用 CLI/MCP）：`/api/coord/repos/{owner}/{repo}/claims|events|evidence|realtime/*`
