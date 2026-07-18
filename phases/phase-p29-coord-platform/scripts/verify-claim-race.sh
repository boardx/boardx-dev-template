#!/usr/bin/env bash
# F05 e2e：对活体网关并发 20 个 claim，断言恰好 1×201 + 19×409；
# 随后验证 TTL(60s) 过期由 DO alarm 机械回收、资源可再认领。
# 需要：COORD_API_TOKEN（env）；可选 COORD_GATEWAY_URL / REPO。
set -euo pipefail
BASE="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
: "${COORD_API_TOKEN:?需要 env COORD_API_TOKEN}"
RES="custom:race-test-$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

claim() { # $1=agent $2=ttl → 输出 http code，body 存 $TMP/$1.json
  curl -s -o "$TMP/$1.json" -w '%{http_code}' -m 30 \
    -X POST "$BASE/api/coord/repos/$REPO/claims" \
    -H "authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
    -d "{\"protocol\":\"coord/0.1\",\"resource_id\":\"$RES\",\"resource_type\":\"custom\",\"agent_id\":\"$1\",\"ttl_seconds\":$2}"
}

echo "==> 并发 20 claim @ $RES"
for i in $(seq 1 20); do claim "race-$i" 60 > "$TMP/code_$i" & done
wait
c201=0; c409=0
for i in $(seq 1 20); do
  code="$(cat "$TMP/code_$i")"
  case "$code" in 201) c201=$((c201+1));; 409) c409=$((c409+1));; *) echo "意外状态码 $code (race-$i)"; exit 1;; esac
done
echo "201=$c201 409=$c409"
[ "$c201" -eq 1 ] && [ "$c409" -eq 19 ] || { echo "✗ 原子性断言失败"; exit 1; }

echo "==> 等待 TTL(60s) 过期 + alarm 回收"
sleep 75
code="$(claim "race-after-expiry" 60)"
echo "过期后再 claim -> $code"
[ "$code" = "201" ] || { echo "✗ 过期回收后应可再认领（得到 $code）"; exit 1; }

# 清理：释放收尾租约（handoff note 纪律）
lease_id="$(python3 -c "import json;print(json.load(open('$TMP/race-after-expiry.json'))['lease_id'])")"
curl -s -o /dev/null -m 30 -X POST "$BASE/api/coord/repos/$REPO/claims/$lease_id/release" \
  -H "authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
  -d '{"protocol":"coord/0.1","agent_id":"race-after-expiry","handoff_note":"e2e race 测试完毕，资源清理释放。"}'
echo "✓ F05 e2e 通过：原子撞车防护 + TTL 机械回收 + 强制交接释放"
