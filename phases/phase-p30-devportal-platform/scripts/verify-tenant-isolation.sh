#!/usr/bin/env bash
# verify-tenant-isolation.sh — p30/F04 端到端验证（活体）。
#
# 断言（实现前定下的完成契约）：
#   1. 向两个项目命名空间（boardx/boardx-dev-template vs
#      agentic-harness/agentic-harness-template）各写一条 talk；
#   2. 交叉读：对方命名空间的消息在本仓 /talk 列表中不可见（空/不含）；
#      需求单条跨仓 GET 断言 404；
#   3. 并发写入互不阻塞（N3 隔离：两写并行发出，各自 201）。
#
# 【G6 后补断言段】真实租户 #2 soak：agentic-harness-template 仓装好 GitHub App
# （人工前置步骤）后，追加 webhook→镜像→/realtime 同型抽查；见文件尾 TODO 段。
#
# 需要：COORD_API_TOKEN（env）；可选 COORD_GATEWAY_URL / REPO_A / REPO_B。
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail
BASE="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO_A="${REPO_A:-boardx/boardx-dev-template}"
REPO_B="${REPO_B:-agentic-harness/agentic-harness-template}"
: "${COORD_API_TOKEN:?需要 env COORD_API_TOKEN}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STAMP="$(date +%s)"

talk_post() { # $1=repo $2=agent $3=body $4=outfile → http code
  curl -s -o "$4" -w '%{http_code}' -m 30 \
    -X POST "$BASE/api/coord/repos/$1/talk" \
    -H "authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
    -d "{\"agent_id\":\"$2\",\"body\":\"$3\"}"
}

echo "==> 并发向两命名空间各写一条 talk（N3：互不阻塞）"
talk_post "$REPO_A" "iso-verify-a" "隔离验证 A@$STAMP" "$TMP/a.json" > "$TMP/code_a" &
talk_post "$REPO_B" "iso-verify-b" "隔离验证 B@$STAMP" "$TMP/b.json" > "$TMP/code_b" &
wait
CODE_A="$(cat "$TMP/code_a")"; CODE_B="$(cat "$TMP/code_b")"
echo "A=$CODE_A B=$CODE_B"
[ "$CODE_A" = "201" ] && [ "$CODE_B" = "201" ] || { echo "✗ 并发写入失败（A=$CODE_A B=$CODE_B）"; exit 1; }
MSG_A="$(python3 -c "import json;print(json.load(open('$TMP/a.json'))['message']['message_id'])")"
MSG_B="$(python3 -c "import json;print(json.load(open('$TMP/b.json'))['message']['message_id'])")"
echo "msg_a=$MSG_A msg_b=$MSG_B"

echo "==> 交叉读：A 的消息不得出现在 B 的 /talk，反之亦然"
curl -s -m 30 -H "authorization: Bearer $COORD_API_TOKEN" \
  "$BASE/api/coord/repos/$REPO_A/talk?limit=500" > "$TMP/list_a.json"
curl -s -m 30 -H "authorization: Bearer $COORD_API_TOKEN" \
  "$BASE/api/coord/repos/$REPO_B/talk?limit=500" > "$TMP/list_b.json"
python3 - "$TMP/list_a.json" "$TMP/list_b.json" "$MSG_A" "$MSG_B" <<'PY'
import json, sys
la = {m["message_id"] for m in json.load(open(sys.argv[1]))["messages"]}
lb = {m["message_id"] for m in json.load(open(sys.argv[2]))["messages"]}
msg_a, msg_b = sys.argv[3], sys.argv[4]
assert msg_a in la, "A 仓应能读到自己刚写的消息"
assert msg_b in lb, "B 仓应能读到自己刚写的消息"
assert msg_a not in lb, f"隔离破洞：A 的 {msg_a} 泄漏到 B 仓"
assert msg_b not in la, f"隔离破洞：B 的 {msg_b} 泄漏到 A 仓"
print("✓ talk 交叉读隔离成立")
PY

echo "==> 跨仓需求单条 GET 断言 404（需求也按项目分片）"
REQ_CODE="$(curl -s -o "$TMP/req.json" -w '%{http_code}' -m 30 \
  -X POST "$BASE/api/coord/repos/$REPO_A/requirements" \
  -H "authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' \
  -d "{\"agent_id\":\"iso-verify-a\",\"title\":\"隔离验证需求@$STAMP\",\"body\":\"\"}")"
[ "$REQ_CODE" = "201" ] || { echo "✗ A 仓需求提交失败（$REQ_CODE）"; exit 1; }
REQ_ID="$(python3 -c "import json;print(json.load(open('$TMP/req.json'))['requirement']['id'])")"
CROSS="$(curl -s -o /dev/null -w '%{http_code}' -m 30 \
  -H "authorization: Bearer $COORD_API_TOKEN" \
  "$BASE/api/coord/repos/$REPO_B/requirements/$REQ_ID")"
[ "$CROSS" = "404" ] || { echo "✗ 隔离破洞：A 的需求 $REQ_ID 在 B 仓返回 $CROSS（应 404）"; exit 1; }
echo "✓ 需求跨仓 GET = 404"

echo "✓ p30/F04 租户隔离验证通过：两项目命名空间工作区数据互不可见 + 并发写互不阻塞"

# ---------------------------------------------------------------------------
# TODO【G6 后补断言段 · 真实租户 #2 soak】
# 前置（人工）：agentic-harness/agentic-harness-template 仓安装 GitHub App
# （App 4328933），webhook 打到本 gateway。接入后在此追加：
#   - 在租户 #2 仓真实开/关一个 issue → 断言 $REPO_B 的 /realtime/issues
#     出现镜像且 $REPO_A 的镜像不含它（webhook→Queues→DO 全链路分片）；
#   - 断言两仓 /events 流互不包含对方 delivery 产生的 mirror.updated。
# 在 App 安装完成前，本段保持注释——不做假绿断言。
# ---------------------------------------------------------------------------
