#!/usr/bin/env bash
# F07 端到端验证：逐条执行 docs/coord-platform/quickstart.md 的命令打活体网关
# （文档即测试——文档漂移会在这里被抓住）。
# 需要 env：COORD_API_TOKEN（secrets 激活后才能真跑；未激活时本脚本 fail-fast 并说明）。
# 可选 env：COORD_GATEWAY_URL（默认 dogfood 网关）、COORD_REPO（默认本仓）。
set -euo pipefail

GATEWAY_URL="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${COORD_REPO:-boardx/boardx-dev-template}"
# 用专属演示资源，避免与真实工作租约互撞（custom: 前缀是协议合法命名）
RESOURCE="custom:quickstart-e2e-$$"
AGENT_A="wrk-quickstart-demo"
AGENT_B="wrk-another-agent"

if [[ -z "${COORD_API_TOKEN:-}" ]]; then
  echo "缺少 COORD_API_TOKEN——secrets 激活后重跑。" >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

echo "== quickstart §1：构建 CLI 并 connect =="
pnpm --filter @repo/coord-cli build
pnpm exec coord connect "$GATEWAY_URL" "$REPO"

echo "== quickstart §2：status =="
pnpm exec coord status

echo "== quickstart §3：claim（agent A）=="
CLAIM_OUT="$(pnpm exec coord claim "$RESOURCE" --agent "$AGENT_A" --ttl 900)"
echo "$CLAIM_OUT"
LEASE_ID="$(echo "$CLAIM_OUT" | grep 'lease_id:' | awk '{print $2}')"
[[ -n "$LEASE_ID" ]] || { echo "没拿到 lease_id" >&2; exit 1; }

echo "== quickstart §4：撞车 409（agent B 同资源，预期失败且输出含持有者）=="
set +e
CONFLICT_OUT="$(pnpm exec coord claim "$RESOURCE" --agent "$AGENT_B" 2>&1)"
CONFLICT_CODE=$?
set -e
[[ $CONFLICT_CODE -ne 0 ]] || { echo "预期 409 撞车，但第二次 claim 成功了——原子性坏了" >&2; exit 1; }
echo "$CONFLICT_OUT" | grep -q "$AGENT_A" || { echo "409 输出未包含当前持有者" >&2; exit 1; }
echo "$CONFLICT_OUT" | grep -q "最近心跳" || { echo "409 输出未包含租约新鲜度" >&2; exit 1; }
echo "撞车防护验证通过：409 + 持有者 + 新鲜度"

echo "== quickstart §5：release（交接说明必填）=="
set +e
pnpm exec coord release "$LEASE_ID" --agent "$AGENT_A" --note "short" >/dev/null 2>&1
SHORT_CODE=$?
set -e
[[ $SHORT_CODE -ne 0 ]] || { echo "过短 handoff note 未被拒绝" >&2; exit 1; }
pnpm exec coord release "$LEASE_ID" --agent "$AGENT_A" \
  --note "quickstart e2e 演示租约，未做实际改动，资源归还。"

echo "== quickstart §5b：events 留痕可见（沿 --since 续传翻页直到找到）=="
FOUND=0; SINCE=""
for _ in $(seq 1 50); do
  if [[ -n "$SINCE" ]]; then OUT="$(pnpm exec coord events --since "$SINCE")"; else OUT="$(pnpm exec coord events)"; fi
  if echo "$OUT" | grep -q "$RESOURCE"; then FOUND=1; break; fi
  NEXT="$(echo "$OUT" | sed -n 's/.*--since \(evt_[A-Za-z0-9]*\)$/\1/p')"
  [[ -n "$NEXT" && "$NEXT" != "$SINCE" ]] || break
  SINCE="$NEXT"
done
[[ $FOUND -eq 1 ]] || { echo "事件流未见本次租约留痕" >&2; exit 1; }

echo "== MCP 面：initialize + tools/list（一个 URL + bearer header）=="
MCP_URL="$GATEWAY_URL/api/coord/mcp/${REPO}"
INIT="$(curl -sf -X POST "$MCP_URL" \
  -H "Authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"quickstart-e2e","version":"0.0.1"}}}')"
echo "$INIT" | grep -q '"coord-platform"' || { echo "MCP initialize 未返回 serverInfo" >&2; exit 1; }
TOOLS="$(curl -sf -X POST "$MCP_URL" \
  -H "Authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')"
for t in claim_issue heartbeat release get_realtime_status get_ready_work get_events submit_evidence; do
  echo "$TOOLS" | grep -q "\"$t\"" || { echo "MCP tools/list 缺工具 $t" >&2; exit 1; }
done
echo "MCP 面验证通过：7 工具齐全"

echo
echo "verify-quickstart-e2e：全部通过 ✅"
